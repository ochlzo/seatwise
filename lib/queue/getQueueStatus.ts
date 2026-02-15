import { redis } from "@/lib/clients/redis";
import type { ActiveSession, TicketData } from "@/lib/types/queue";

export type QueueHeartbeatStatus = "waiting" | "active" | "expired" | "closed" | "not_joined";

export interface QueueHeartbeatResult {
  success: boolean;
  status: QueueHeartbeatStatus;
  showScopeId: string;
  ticketId?: string;
  name?: string;
  rank?: number;
  etaMs?: number;
  estimatedWaitMinutes?: number;
  activeToken?: string;
  expiresAt?: number;
  message?: string;
}

interface GetQueueStatusParams {
  showScopeId: string;
  userId: string;
}

const DEFAULT_AVG_SERVICE_MS = 60000;

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

export async function getQueueStatus({
  showScopeId,
  userId,
}: GetQueueStatusParams): Promise<QueueHeartbeatResult> {
  const pausedKey = `seatwise:paused:${showScopeId}`;
  const isPaused = await redis.get<number | string>(pausedKey);
  if (isPaused) {
    return {
      success: true,
      status: "closed",
      showScopeId,
      message: "Queue is currently paused for this show.",
    };
  }

  const userTicketKey = `seatwise:user_ticket:${showScopeId}`;
  const ticketId = await redis.hget<string>(userTicketKey, userId);

  if (!ticketId) {
    return {
      success: true,
      status: "not_joined",
      showScopeId,
      message: "You are not currently in this queue.",
    };
  }

  const ticketKey = `seatwise:ticket:${showScopeId}:${ticketId}`;
  const ticketJson = await redis.get<string>(ticketKey);
  const ticket = parseJson<TicketData>(ticketJson);

  const activeKey = `seatwise:active:${showScopeId}:${ticketId}`;
  const activeJson = await redis.get<string>(activeKey);
  const activeSession = parseJson<ActiveSession>(activeJson);

  if (
    activeSession &&
    activeSession.userId === userId &&
    activeSession.expiresAt > Date.now()
  ) {
    return {
      success: true,
      status: "active",
      showScopeId,
      ticketId,
      name: ticket?.name,
      activeToken: activeSession.activeToken,
      expiresAt: activeSession.expiresAt,
      message: "Your turn is active.",
    };
  }

  const queueKey = `seatwise:queue:${showScopeId}`;
  const rank = await redis.zrank(queueKey, ticketId);

  if (rank === null) {
    await redis.hdel(userTicketKey, userId);
    await redis.del(ticketKey);
    await redis.del(activeKey);

    return {
      success: true,
      status: "expired",
      showScopeId,
      ticketId,
      name: ticket?.name,
      message: "Your queue ticket is no longer active.",
    };
  }

  const avgServiceMsKey = `seatwise:metrics:avg_service_ms:${showScopeId}`;
  const avgServiceMsRaw = await redis.get<number | string>(avgServiceMsKey);
  const avgServiceMs =
    typeof avgServiceMsRaw === "number"
      ? avgServiceMsRaw
      : typeof avgServiceMsRaw === "string"
        ? Number.parseInt(avgServiceMsRaw, 10)
        : DEFAULT_AVG_SERVICE_MS;

  const safeAvgServiceMs =
    Number.isFinite(avgServiceMs) && avgServiceMs > 0 ? avgServiceMs : DEFAULT_AVG_SERVICE_MS;
  const oneBasedRank = rank + 1;
  const etaMs = oneBasedRank * safeAvgServiceMs;

  return {
    success: true,
    status: "waiting",
    showScopeId,
    ticketId,
    name: ticket?.name,
    rank: oneBasedRank,
    etaMs,
    estimatedWaitMinutes: Math.ceil(etaMs / 60000),
    message: "Waiting in queue.",
  };
}
