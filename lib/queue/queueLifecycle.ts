import { randomUUID } from "node:crypto";
import { redis } from "@/lib/clients/redis";
import { ably } from "@/lib/clients/ably";
import type { ActiveSession, QueueActiveEvent, QueueMoveEvent, TicketData } from "@/lib/types/queue";

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

const hasValidActiveSession = async (showScopeId: string): Promise<boolean> => {
  const activePattern = `seatwise:active:${showScopeId}:*`;
  const activeKeys = (await redis.keys(activePattern)) as string[];
  if (!Array.isArray(activeKeys) || activeKeys.length === 0) {
    return false;
  }

  const now = Date.now();
  let hasActive = false;

  for (const activeKey of activeKeys) {
    const raw = await redis.get(activeKey);
    const active = parseJson<ActiveSession>(raw);

    if (!active || active.expiresAt <= now) {
      await redis.del(activeKey);
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
  const activeKey = `seatwise:active:${showScopeId}:${session.ticketId}`;
  const ticketKey = `seatwise:ticket:${showScopeId}:${session.ticketId}`;
  const userTicketKey = `seatwise:user_ticket:${showScopeId}`;

  await redis.del(activeKey);
  await redis.hdel(userTicketKey, session.userId);
  await redis.del(ticketKey);

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
