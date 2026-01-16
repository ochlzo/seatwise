# Seatwise Queuing System Design (Revised)

## 1. Architecture Overview

Hybrid **Pull (Heartbeat)** + **Push (Realtime)** for scalability and responsiveness.

- **Next.js (Backend):** Logic, validation, Redis writes, Ably Auth token minting
- **Upstash Redis (Source of Truth):** Queue order, active sessions, metrics
- **Ably (Realtime):**

  - Instant “Your turn” notifications (private channel)
  - Global low-cost broadcasts (queue movement, snapshots)
  - **Occupancy** for live viewer counts (preferred)
  - **Presence** only when member identity is required (optional)

---

## 2. Redis Data Structures

All keys are scoped per page / venue / event using `{pageId}`.

| Key                                        | Type                  | Description                                                        |
| ------------------------------------------ | --------------------- | ------------------------------------------------------------------ |
| `seatwise:queue:{pageId}`                  | ZSET                  | Waiting line. `member = ticketId`, `score = server join timestamp` |
| `seatwise:ticket:{pageId}:{ticketId}`      | STRING (JSON) or HASH | Enriched ticket data (userId, sid, name, avatar, joinedAt)         |
| `seatwise:user_ticket:{pageId}`            | HASH                  | `userId → ticketId` (join idempotency / dedupe)                    |
| `seatwise:active:{pageId}:{ticketId}`      | STRING (JSON) w/ TTL  | Active session record (userId, expiresAt, activeToken, startedAt)  |
| `seatwise:metrics:avg_service_ms:{pageId}` | STRING (Int)          | Rolling average service time                                       |
| `seatwise:seq:{pageId}`                    | STRING (Int)          | Monotonic broadcast sequence number                                |

### Enriched Ticket Schema

Stored separately (not as the ZSET member).

```json
{
  "ticketId": "tkt_abc123",
  "userId": "user_uid_123",
  "sid": "session_xyz_789",
  "name": "Alice",
  "avatar": "https://cloudinary.com/alice.jpg",
  "joinedAt": 1737000000000
}
```

**Why this design**

- Reliable `ZRANK`, `ZREM`, and updates (no exact JSON matching)
- Easy deduplication and reconnect handling
- Ticket data can change without rewriting queue order

---

## 3. Ably Channel Topology

### Public Channel

```
seatwise:{pageId}:public
```

Used for:

- Queue movement events (`QUEUE_MOVE`)
- Optional lightweight snapshots
- Occupancy-based viewer counts

### Private Channel (Per User)

```
seatwise:{pageId}:private:{ticketId}
```

Used for:

- Instant "ACTIVE" turn notifications

> Ably Auth restricts users to subscribe **only** to their own private channel.

### Live Viewer Counts

- **Preferred:** Ably **Occupancy** on the public channel
- **Optional:** Ably **Presence** when identity is needed (friends, staff, moderation)

---

## 4. Workflows

### A. Joining the Queue (Ticket Creation)

1. User clicks **Join**
2. Backend:

   - Fetch user profile once (name, avatar)
   - Generate `ticketId`
   - Enforce idempotency via `seatwise:user_ticket:{pageId}`
   - Store ticket blob
   - Add `ticketId` to `seatwise:queue:{pageId}` with server timestamp
   - Fetch initial rank via `ZRANK`

3. Response:

```json
{
  "status": "waiting",
  "ticketId": "tkt_abc123",
  "rank": 5,
  "name": "Alice",
  "avatar": "..."
}
```

---

### B. Waiting in Line (Heartbeat / Pull)

Clients poll with adaptive intervals.

**Backend Logic**

1. Rank: `ZRANK seatwise:queue:{pageId} ticketId`
2. Neighbors (only when needed):

   - `ZRANGE seatwise:queue:{pageId} start stop`
   - Batch fetch ticket blobs via `MGET`

3. Speed: `GET seatwise:metrics:avg_service_ms:{pageId}`
4. ETA: `rank * avgServiceMs`

**Frontend UX**

- Rubber-band ETA timer
- Visual line (neighbors only)

---

### C. Transition (Queue → Active) — Atomic

This is the only instant, high-risk operation.

**Trigger**

- Active slot opens (finish, timeout, or worker tick)

**Redis Lua Script (Single Transaction)**

1. `ZPOPMIN seatwise:queue:{pageId}`
2. Generate `activeToken` and `expiresAt`
3. `SET seatwise:active:{pageId}:{ticketId} <json> EX 300`
4. Return `{ ticketId, activeToken, expiresAt }`

**After Success**

- Publish Ably private message:

```json
{
  "type": "ACTIVE",
  "activeToken": "...",
  "expiresAt": 1737000000000
}
```

---

### D. Active Session (Hard Timer + Fencing Token)

**Frontend**

- Displays hard countdown to `expiresAt`

**Backend Validation (Every Booking Request)**

- Active key exists
- Token matches (`activeToken`)
- TTL not expired

> Fencing token prevents stale tabs or duplicate clients from booking.

---

### E. Departure (Finish / Expire / Abandon)

1. Remove or let active key expire
2. Update metrics:

```
NewAvg = OldAvg * 0.9 + ThisUserTime * 0.1
```

3. Broadcast queue movement:

```json
{
  "type": "QUEUE_MOVE",
  "departedRank": 0,
  "seq": 1042
}
```

4. Trigger next transition if capacity allows

---

## 5. Realtime UX Strategy

### Optimistic Push Updates

- On `QUEUE_MOVE`, decrement local rank if applicable
- Never trigger mass refetch

### Drift Correction

- Heartbeat remains the source of truth
- Any missed push is corrected on next poll

### Optional Snapshot Event

Occasionally publish:

```json
{
  "type": "SNAPSHOT",
  "seq": 1050,
  "avgServiceMs": 42000,
  "headCount": 238
}
```

---

## 6. Live Viewers

### Preferred: Occupancy

- Accurate-enough real-time counts
- Minimal overhead

### Optional: Presence

- Only when member identity is required
- Treat as eventually consistent
- Re-enter on reconnect if needed

---

## 7. Thundering Herd Prevention

- Broadcast only small events
- No server-triggered refetches
- Adaptive polling spreads load naturally

---

## 8. Visual Queue Rendering

- `ZRANGE` → ticketIds
- Batch fetch ticket blobs
- No N+1 queries

---

**Summary**

- Redis remains the single source of truth
- Ably provides instant UX without load spikes
- Atomic transitions + fencing tokens guarantee correctness
- Occupancy handles scale-friendly live counts
