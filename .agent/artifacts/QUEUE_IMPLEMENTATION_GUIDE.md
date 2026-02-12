# Queue System Implementation Guide

> **Status:** ✅ Infrastructure Complete  
> **Next Steps:** Integration with Show Management UI

---

## 📦 What Was Implemented

### 1. **Core Infrastructure**
- ✅ Redis client (`lib/clients/redis.ts`)
- ✅ Ably client (`lib/clients/ably.ts`)
- ✅ Queue types (`lib/types/queue.ts`)

### 2. **Queue Management**
- ✅ Initialize queue (`lib/queue/initializeQueue.ts`)
- ✅ Close/pause queue (`lib/queue/closeQueue.ts`)
- ✅ Server action (`lib/actions/updateShowStatus.ts`)

### 3. **API Endpoints**
- ✅ Ably token auth (`app/api/ably/auth/route.ts`)

### 4. **Testing**
- ✅ Test script (`lib/queue/test-queue.ts`)

---

## 🧪 Testing the Implementation

### Run the Test Script

```bash
node --experimental-strip-types lib/queue/test-queue.ts
```

This will:
1. Initialize a test queue
2. Add a test user
3. Get queue statistics
4. Close the queue
5. Verify cleanup

---

## 🔌 Integration with Show Management

### Option A: Update Existing Show Form

Add a status dropdown to your show edit form:

```typescript
// In your show edit component
import { updateShowStatus } from '@/lib/actions/updateShowStatus';

async function handleStatusChange(showId: string, newStatus: ShowStatus) {
  const result = await updateShowStatus(showId, newStatus);
  
  if (result.success) {
    toast.success(result.message);
    // Show queue results
    result.queueResults.forEach(qr => {
      console.log(`Queue ${qr.showScopeId}: ${qr.message}`);
    });
  }
}
```

### Option B: Create Status Management Page

Create a dedicated page for managing show status:

**File:** `app/(admin-user)/(dashboard)/shows/[showId]/status/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { updateShowStatus } from '@/lib/actions/updateShowStatus';
import { ShowStatus } from '@prisma/client';

export default function ShowStatusPage({ params }: { params: { showId: string } }) {
  const [status, setStatus] = useState<ShowStatus>('DRAFT');
  const [loading, setLoading] = useState(false);

  const handleUpdateStatus = async () => {
    setLoading(true);
    try {
      const result = await updateShowStatus(params.showId, status);
      alert(result.message);
    } catch (error) {
      alert('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Manage Show Status</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value as ShowStatus)}>
        <option value="DRAFT">Draft</option>
        <option value="UPCOMING">Upcoming</option>
        <option value="OPEN">Open (Queue Active)</option>
        <option value="ON_GOING">On Going</option>
        <option value="CLOSED">Closed</option>
        <option value="CANCELLED">Cancelled</option>
        <option value="POSTPONED">Postponed</option>
      </select>
      <button onClick={handleUpdateStatus} disabled={loading}>
        Update Status
      </button>
    </div>
  );
}
```

---

## 🎯 Queue Lifecycle Flow

### When Admin Changes Show Status to "OPEN"

1. **Server Action Triggered**
   ```typescript
   updateShowStatus(showId, 'OPEN')
   ```

2. **For Each Schedule:**
   - Initialize Redis keys:
     - `seatwise:seq:{showId}:{schedId}` = 0
     - `seatwise:metrics:avg_service_ms:{showId}:{schedId}` = 60000
   
3. **Queue is Ready**
   - Users can now join the queue
   - Ably channels are created on-demand

### When Admin Changes Status to "CLOSED"

1. **Server Action Triggered**
   ```typescript
   updateShowStatus(showId, 'CLOSED')
   ```

2. **For Each Schedule:**
   - Get all users in queue
   - Publish `QUEUE_CLOSED` event to public channel
   - Notify each user on private channel
   - Delete all Redis keys

3. **Queue is Cleaned Up**
   - All data removed
   - Users notified

---

## 📊 Monitoring Queue Status

### Get Queue Statistics

```typescript
import { getShowQueueStatus } from '@/lib/actions/updateShowStatus';

const status = await getShowQueueStatus(showId);

console.log(status.queueStatuses);
// [
//   {
//     schedId: 'sched-1',
//     schedDate: '2026-03-15',
//     queueSize: 42,
//     avgServiceMs: 60000,
//     estimatedWaitTime: 2520000 // 42 minutes
//   }
// ]
```

### Display in Admin Dashboard

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getShowQueueStatus } from '@/lib/actions/updateShowStatus';

export function QueueMonitor({ showId }: { showId: string }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      const result = await getShowQueueStatus(showId);
      setStats(result);
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, [showId]);

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h2>Queue Status</h2>
      {stats.queueStatuses.map((qs) => (
        <div key={qs.schedId}>
          <h3>{qs.schedDate}</h3>
          <p>Queue Size: {qs.queueSize}</p>
          <p>Avg Wait: {Math.round(qs.avgServiceMs / 1000)}s</p>
          <p>Est Total Wait: {Math.round(qs.estimatedWaitTime / 60000)}m</p>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔐 Security Considerations

### 1. **Ably Token Authentication**

Clients should NEVER use the API key directly. Instead:

```typescript
// Client-side code
import * as Ably from 'ably';

const ably = new Ably.Realtime({
  authUrl: '/api/ably/auth',
  authMethod: 'POST',
  authParams: {
    ticketId: 'user-ticket-id',
    showScopeId: 'show-123:sched-456'
  }
});
```

### 2. **Validate User Permissions**

Before issuing tokens, verify:
- User is authenticated
- User has a valid ticket for this show
- Queue is active

Update `app/api/ably/auth/route.ts`:

```typescript
// Add session validation
const session = cookies().get('session')?.value;
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Verify ticket ownership
const ticket = await redis.get(`seatwise:ticket:${showScopeId}:${ticketId}`);
if (!ticket) {
  return NextResponse.json({ error: 'Invalid ticket' }, { status: 403 });
}
```

---

## 🚀 Next Steps

### Phase 1: Basic Integration (Current)
- [x] Queue initialization on OPEN status
- [x] Queue cleanup on CLOSED status
- [ ] Add status dropdown to show management UI
- [ ] Test with real show data

### Phase 2: User Queue Joining (Next)
- [ ] Create "Join Queue" API endpoint
- [ ] Implement ticket generation
- [ ] Add user to Redis queue
- [ ] Return initial rank and ETA

### Phase 3: Heartbeat Polling
- [ ] Create "Get Queue Status" API endpoint
- [ ] Implement adaptive polling on client
- [ ] Display rank and ETA to user

### Phase 4: Real-time Notifications
- [ ] Implement queue transition logic
- [ ] Send "Your Turn" notifications via Ably
- [ ] Handle active session management

### Phase 5: Seat Selection
- [ ] Integrate with existing seatmap
- [ ] Validate active session
- [ ] Reserve seats
- [ ] Complete booking

---

## 📝 Environment Variables

Make sure these are set in your `.env`:

```env
# Upstash Redis
UPSTASH_REDIS_REST_URL="https://sensible-iguana-54893.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AdZtAAIncDI0NTMxZDAwZjRkOTU0ZTc0YmE5OWRmYzhmNmY2YjRiM3AyNTQ4OTM"

# Ably
ABLY_API_KEY="LmYW6w.IBTdQw:T7ZWjR_AfbteRQSRYkZGW6N2dkBkRI5IyNee0OOH7ag"
```

---

## 🐛 Troubleshooting

### Queue Not Initializing

**Check:**
1. Redis connection: `await redis.ping()`
2. Environment variables are set
3. Show has schedules attached

### Ably Connection Failing

**Check:**
1. API key is valid
2. Token auth endpoint is accessible
3. Client has correct `showScopeId`

### Redis Keys Not Cleaning Up

**Check:**
1. `closeQueueChannel` is being called
2. Redis connection is stable
3. Check Redis directly: `await redis.keys('seatwise:*')`

---

## 📚 References

- [Queue System Design](./QUEUE_SYSTEM_DESIGN.md)
- [Upstash Redis Docs](https://docs.upstash.com/redis)
- [Ably Docs](https://ably.com/docs)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

---

*Last Updated: 2026-02-13*
