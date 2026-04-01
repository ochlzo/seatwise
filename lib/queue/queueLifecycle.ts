import { randomUUID } from "node:crypto";
import { redis } from "@/lib/clients/redis";
import { ably } from "@/lib/clients/ably";
import { isActiveSessionLive, isPersistentActiveSession } from "@/lib/queue/activeSessionPolicy";
import { clearWalkInPauseState } from "@/lib/queue/closeQueue";
import {
  getActiveSessionKey,
  getActiveSessionPointerKey,
  getQueueKey,
  getTicketKey,
  getUserTicketKey,
} from "@/lib/queue/queueKeys";
import type {
  ActiveSession,
  QueueActiveEvent,
  QueueMoveEvent,
  QueueSessionExpiredEvent,
  TicketData,
} from "@/lib/types/queue";

const ACTIVE_WINDOW_MS = 1 * 60 * 1000;
const PROMOTION_LOCK_TTL_SECONDS = 3;
const DEFAULT_AVG_SERVICE_MS = 60_000;

interface PromoteNextParams {
  showScopeId: string;
}

interface CompleteActiveSessionParams {
  showScopeId: string;
  session: ActiveSession;
}

interface ExpireQueueSessionParams {
  showScopeId: string;
  ticketId: string;
  userId?: string | null;
  reason?: string;
  promoteNext?: boolean;
}

export interface PromoteNextResult {
  promoted: boolean;
  activeSession?: ActiveSession;
  ticket?: TicketData;
}

const parseJson = <T>(value: unknown): T | null => {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as T;
  }
  return null;
};

const EXPIRED_SESSION_MESSAGE = "Your active reservation window has expired. Rejoin the queue.";
const ACTIVE_SESSION_TTL_SECONDS = Math.ceil(ACTIVE_WINDOW_MS / 1000);

const resolveUserIdForTicket = async ({
  showScopeId,
  ticketId,
  userId,
}: {
  showScopeId: string;
  ticketId: string;
  userId?: string | null;
}): Promise<string | null> => {
  if (userId) {
    return userId;
  }

  const ticketKey = getTicketKey(showScopeId, ticketId);
  const ticketRaw = await redis.get(ticketKey);
  const ticket = parseJson<TicketData>(ticketRaw);
  return ticket?.userId ?? null;
};

const setCurrentActiveSession = async ({
  showScopeId,
  session,
}: {
  showScopeId: string;
  session: ActiveSession;
}) => {
  const activeKey = getActiveSessionKey(showScopeId, session.ticketId);
  const pointerKey = getActiveSessionPointerKey(showScopeId);

  await redis.set(activeKey, JSON.stringify(session));

  if (isPersistentActiveSession(session)) {
    await redis.persist(activeKey);
    await redis.set(pointerKey, session.ticketId);
    return;
  }

  await redis.expire(activeKey, ACTIVE_SESSION_TTL_SECONDS);
  await redis.set(pointerKey, session.ticketId, {
    ex: ACTIVE_SESSION_TTL_SECONDS,
  });
};

const clearCurrentActiveSessionPointer = async ({
  showScopeId,
  ticketId,
}: {
  showScopeId: string;
  ticketId: string;
}) => {
  const pointerKey = getActiveSessionPointerKey(showScopeId);
  const pointedTicketId = (await redis.get(pointerKey)) as string | null;

  if (pointedTicketId === ticketId) {
    await redis.del(pointerKey);
  }
};

const cleanupQueueTicketArtifacts = async ({
  showScopeId,
  ticketId,
  userId,
}: {
  showScopeId: string;
  ticketId: string;
  userId?: string | null;
}) => {
  const resolvedUserId = await resolveUserIdForTicket({
    showScopeId,
    ticketId,
    userId,
  });

  const activeKey = getActiveSessionKey(showScopeId, ticketId);
  const ticketKey = getTicketKey(showScopeId, ticketId);
  const userTicketKey = getUserTicketKey(showScopeId);

  await redis.del(activeKey, ticketKey);
  await clearCurrentActiveSessionPointer({ showScopeId, ticketId });
  if (resolvedUserId) {
    const currentlyMappedTicketId = (await redis.hget(userTicketKey, resolvedUserId)) as string | null;
    if (currentlyMappedTicketId === ticketId) {
      await redis.hdel(userTicketKey, resolvedUserId);
    }
  }
};

const publishSessionExpiredEvent = async ({
  showScopeId,
  ticketId,
  reason,
}: {
  showScopeId: string;
  ticketId: string;
  reason?: string;
}) => {
  try {
    const event: QueueSessionExpiredEvent = {
      type: "SESSION_EXPIRED",
      message: reason ?? EXPIRED_SESSION_MESSAGE,
      timestamp: Date.now(),
      disconnect: true,
    };

    await ably.channels
      .get(`seatwise:${showScopeId}:private:${ticketId}`)
      .publish("queue-event", event);
  } catch (error) {
    console.error(`Failed to publish SESSION_EXPIRED for ${showScopeId}/${ticketId}:`, error);
  }
};

export async function expireQueueSession({
  showScopeId,
  ticketId,
  userId,
  reason,
  promoteNext = true,
}: ExpireQueueSessionParams): Promise<PromoteNextResult> {
  await cleanupQueueTicketArtifacts({ showScopeId, ticketId, userId });
  await publishSessionExpiredEvent({ showScopeId, ticketId, reason });

  if (!promoteNext) {
    return { promoted: false };
  }

  await clearWalkInPauseState(showScopeId);
  return promoteNextInQueue({ showScopeId });
}

export async function persistWalkInActiveSession({
  showScopeId,
  session,
}: {
  showScopeId: string;
  session: ActiveSession;
}) {
  const persistentSession: ActiveSession = {
    ...session,
    mode: "walk_in",
    expiresAt: null,
  };

  await setCurrentActiveSession({
    showScopeId,
    session: persistentSession,
  });

  return persistentSession;
}

export const getCurrentActiveSession = async (
  showScopeId: string,
): Promise<ActiveSession | null> => {
  const pointerKey = getActiveSessionPointerKey(showScopeId);
  const pointedTicketId = (await redis.get(pointerKey)) as string | null;

  if (!pointedTicketId) {
    return null;
  }

  const now = Date.now();
  const activeKey = getActiveSessionKey(showScopeId, pointedTicketId);
  const raw = await redis.get(activeKey);
  const active = parseJson<ActiveSession>(raw);

  if (!active) {
    // The active key was evicted (by Redis TTL or memory pressure) but the
    // pointer key survived. Clean up artifacts and promote the next user so
    // the queue does not stall. The promotion lock keeps this idempotent even
    // if multiple concurrent heartbeats hit this branch simultaneously.
    await cleanupQueueTicketArtifacts({
      showScopeId,
      ticketId: pointedTicketId,
    });
    await expireQueueSession({
      showScopeId,
      ticketId: pointedTicketId,
      promoteNext: true,
    });
    return null;
  }

  if (!isActiveSessionLive(active, now)) {
    const expiredTicketId = active.ticketId || pointedTicketId;

    // promoteNext: true — when a mobile user closes their browser and the
    // ACTIVE_WINDOW_MS elapses, no client-side terminate ever fires. Any
    // subsequent heartbeat from a waiting user (via getQueueStatus) will hit
    // this path and trigger promotion. The distribute promotion lock in
    // promoteNextInQueue ensures only one concurrent caller wins.
    await expireQueueSession({
      showScopeId,
      ticketId: expiredTicketId,
      userId: active.userId,
      promoteNext: true,
    });
    return null;
  }

  return active;
};

const publishQueueMoveEvent = async (showScopeId: string) => {
  try {
    const seqKey = `seatwise:seq:${showScopeId}`;
    const seq = await redis.incr(seqKey);
    const event: QueueMoveEvent = {
      type: "QUEUE_MOVE",
      departedRank: 0,
      seq,
    };
    await ably.channels.get(`seatwise:${showScopeId}:public`).publish("queue-event", event);
  } catch (error) {
    console.error(`Failed to publish QUEUE_MOVE for ${showScopeId}:`, error);
  }
};

const publishActiveEvent = async (
  showScopeId: string,
  ticketId: string,
  session: ActiveSession,
) => {
  try {
    const event: QueueActiveEvent = {
      type: "ACTIVE",
      activeToken: session.activeToken,
      expiresAt: session.expiresAt,
    };
    await ably.channels
      .get(`seatwise:${showScopeId}:private:${ticketId}`)
      .publish("queue-event", event);
  } catch (error) {
    console.error(`Failed to publish ACTIVE for ${showScopeId}/${ticketId}:`, error);
  }
};

export async function promoteNextInQueue({
  showScopeId,
}: PromoteNextParams): Promise<PromoteNextResult> {
  const lockKey = `seatwise:promote_lock:${showScopeId}`;
  const lockToken = randomUUID();
  const lockResult = await redis.set(lockKey, lockToken, {
    nx: true,
    ex: PROMOTION_LOCK_TTL_SECONDS,
  });

  if (!lockResult) {
    return { promoted: false };
  }

  try {
    const pausedKey = `seatwise:paused:${showScopeId}`;
    const paused = (await redis.get(pausedKey)) as number | string | null;
    if (paused) {
      return { promoted: false };
    }

    const activeSession = await getCurrentActiveSession(showScopeId);
    if (activeSession) {
      return { promoted: false };
    }

    const queueKey = getQueueKey(showScopeId);

    for (let attempts = 0; attempts < 10; attempts += 1) {
      const head = (await redis.zrange(queueKey, 0, 0)) as string[];
      const ticketId = Array.isArray(head) ? head[0] : null;
      if (!ticketId) {
        return { promoted: false };
      }

      const ticketKey = getTicketKey(showScopeId, ticketId);
      const ticketRaw = await redis.get(ticketKey);
      const ticket = parseJson<TicketData>(ticketRaw);

      if (!ticket || !ticket.userId) {
        await redis.zrem(queueKey, ticketId);
        await redis.del(ticketKey);
        continue;
      }

      const now = Date.now();
      const activeSession: ActiveSession = {
        userId: ticket.userId,
        ticketId,
        activeToken: randomUUID(),
        startedAt: now,
        expiresAt: now + ACTIVE_WINDOW_MS,
        mode: "online",
      };

      await setCurrentActiveSession({
        showScopeId,
        session: activeSession,
      });
      await redis.zrem(queueKey, ticketId);

      await publishQueueMoveEvent(showScopeId);
      await publishActiveEvent(showScopeId, ticketId, activeSession);

      return {
        promoted: true,
        activeSession,
        ticket,
      };
    }

    return { promoted: false };
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Ensures the queue makes forward progress on every waiting-user heartbeat.
 *
 * Covers all three stall scenarios that `getCurrentActiveSession` alone cannot
 * fully address:
 *
 *  A. Both `active_pointer` and `active` key expired together after Redis TTL
 *     (the most common mobile-browser-close scenario). `getCurrentActiveSession`
 *     returns null from branch A and no promotion fires — this function catches
 *     that case by calling `promoteNextInQueue` whenever `getCurrentActiveSession`
 *     returns null and the queue is non-empty.
 *
 *  B. Active key evicted before pointer (partial eviction). Now handled inside
 *     `getCurrentActiveSession` itself (see patch above), but `ensureQueueProgress`
 *     adds a second safety net.
 *
 *  C. Session expired with key still present (expiresAt in the past). Already
 *     handled inside `getCurrentActiveSession` (promoteNext: true).
 *
 * Race-safety: `promoteNextInQueue` acquires a distributed lock (`nx: true`).
 * Only one concurrent caller promotes; the rest return `{ promoted: false }`.
 * Walk-in persistent sessions and paused queues are guarded inside
 * `promoteNextInQueue` — this function does not bypass either guard.
 */
export async function ensureQueueProgress(showScopeId: string): Promise<void> {
  const activeSession = await getCurrentActiveSession(showScopeId);

  // If there is a live active session (online or walk-in), nothing to do.
  if (activeSession) {
    return;
  }

  // No active session — attempt to promote the next waiting user.
  // promoteNextInQueue internally re-checks for:
  //   • an active pause (postponed or walk_in)
  //   • a live active session (double-check inside the lock)
  // so this call is fully idempotent and safe to call from concurrent requests.
  await promoteNextInQueue({ showScopeId });
}

export async function completeActiveSessionAndPromoteNext({
  showScopeId,
  session,
}: CompleteActiveSessionParams): Promise<PromoteNextResult> {
  await cleanupQueueTicketArtifacts({
    showScopeId,
    ticketId: session.ticketId,
    userId: session.userId,
  });

  const avgServiceMsKey = `seatwise:metrics:avg_service_ms:${showScopeId}`;
  const rawAvg = (await redis.get(avgServiceMsKey)) as number | string | null;
  const currentAvg =
    typeof rawAvg === "number"
      ? rawAvg
      : typeof rawAvg === "string"
        ? Number.parseInt(rawAvg, 10)
        : DEFAULT_AVG_SERVICE_MS;

  const safeCurrentAvg =
    Number.isFinite(currentAvg) && currentAvg > 0 ? currentAvg : DEFAULT_AVG_SERVICE_MS;
  const thisUserTimeMs = Math.max(1000, Date.now() - session.startedAt);
  const newAvg = Math.round(safeCurrentAvg * 0.9 + thisUserTimeMs * 0.1);
  await redis.set(avgServiceMsKey, newAvg);

  await clearWalkInPauseState(showScopeId);
  return promoteNextInQueue({ showScopeId });
}
