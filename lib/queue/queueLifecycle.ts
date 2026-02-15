import { randomUUID } from "node:crypto";
import { redis } from "@/lib/clients/redis";
import { ably } from "@/lib/clients/ably";
import type {
  ActiveSession,
  QueueActiveEvent,
  QueueMoveEvent,
  QueueSessionExpiredEvent,
  TicketData,
} from "@/lib/types/queue";

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
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

  const ticketKey = `seatwise:ticket:${showScopeId}:${ticketId}`;
  const ticketRaw = await redis.get(ticketKey);
  const ticket = parseJson<TicketData>(ticketRaw);
  return ticket?.userId ?? null;
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

  const activeKey = `seatwise:active:${showScopeId}:${ticketId}`;
  const ticketKey = `seatwise:ticket:${showScopeId}:${ticketId}`;
  const userTicketKey = `seatwise:user_ticket:${showScopeId}`;

  await redis.del(activeKey, ticketKey);
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

const extractTicketIdFromActiveKey = (showScopeId: string, activeKey: string): string | null => {
  const prefix = `seatwise:active:${showScopeId}:`;
  if (!activeKey.startsWith(prefix)) {
    return null;
  }

  const ticketId = activeKey.slice(prefix.length).trim();
  return ticketId.length > 0 ? ticketId : null;
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

  return promoteNextInQueue({ showScopeId });
}

const hasValidActiveSession = async (showScopeId: string): Promise<boolean> => {
  const activePattern = `seatwise:active:${showScopeId}:*`;
  const activeKeys = (await redis.keys(activePattern)) as string[];
  if (!Array.isArray(activeKeys) || activeKeys.length === 0) {
    return false;
  }

  const now = Date.now();
  let hasActive = false;

  for (const activeKey of activeKeys) {
    const ticketIdFromKey = extractTicketIdFromActiveKey(showScopeId, activeKey);
    const raw = await redis.get(activeKey);
    const active = parseJson<ActiveSession>(raw);

    if (!active) {
      if (ticketIdFromKey) {
        await cleanupQueueTicketArtifacts({
          showScopeId,
          ticketId: ticketIdFromKey,
        });
      } else {
        await redis.del(activeKey);
      }
      continue;
    }

    if (active.expiresAt <= now) {
      const expiredTicketId = active.ticketId || ticketIdFromKey;
      if (!expiredTicketId) {
        await redis.del(activeKey);
        continue;
      }

      await expireQueueSession({
        showScopeId,
        ticketId: expiredTicketId,
        userId: active.userId,
        promoteNext: false,
      });
      continue;
    }

    hasActive = true;
  }

  return hasActive;
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

    const hasActive = await hasValidActiveSession(showScopeId);
    if (hasActive) {
      return { promoted: false };
    }

    const queueKey = `seatwise:queue:${showScopeId}`;

    for (let attempts = 0; attempts < 10; attempts += 1) {
      const head = (await redis.zrange(queueKey, 0, 0)) as string[];
      const ticketId = Array.isArray(head) ? head[0] : null;
      if (!ticketId) {
        return { promoted: false };
      }

      const ticketKey = `seatwise:ticket:${showScopeId}:${ticketId}`;
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
      };

      const activeKey = `seatwise:active:${showScopeId}:${ticketId}`;
      await redis.set(activeKey, JSON.stringify(activeSession));
      await redis.expire(activeKey, Math.ceil(ACTIVE_WINDOW_MS / 1000));
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

  return promoteNextInQueue({ showScopeId });
}
