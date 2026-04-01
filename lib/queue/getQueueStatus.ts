import { redis } from "@/lib/clients/redis";
import type { ActiveSession, QueuePauseReason, TicketData } from "@/lib/types/queue";
import { isActiveSessionLive } from "./activeSessionPolicy";
import { getQueuePauseState } from "./closeQueue";
import { ensureQueueProgress } from "./queueLifecycle";
import { resolveVisibleQueueRank } from "./visibleRank";

export type QueueHeartbeatStatus =
  | "waiting"
  | "active"
  | "paused"
  | "expired"
  | "closed"
  | "not_joined";

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
  expiresAt?: number | null;
  pauseReason?: QueuePauseReason;
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
  const userTicketKey = `seatwise:user_ticket:${showScopeId}`;
  const ticketId = (await redis.hget(userTicketKey, userId)) as string | null;

  if (!ticketId) {
    return {
      success: true,
      status: "not_joined",
      showScopeId,
      message: "You are not currently in this queue.",
    };
  }

  const ticketKey = `seatwise:ticket:${showScopeId}:${ticketId}`;
  const ticketJson = await redis.get(ticketKey);
  const ticket = parseJson<TicketData>(ticketJson);

  const activeKey = `seatwise:active:${showScopeId}:${ticketId}`;
  const activeJson = await redis.get(activeKey);
  const activeSession = parseJson<ActiveSession>(activeJson);

  if (
    activeSession &&
    activeSession.userId === userId &&
    isActiveSessionLive(activeSession)
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

  // Self-heal the queue on every waiting-user heartbeat.
  //
  // ensureQueueProgress covers all three stall scenarios:
  //   A. Both pointer + active key expired simultaneously (mobile browser killed
  //      after ACTIVE_WINDOW_MS) — getCurrentActiveSession returns null from the
  //      no-pointer branch and cannot promote; ensureQueueProgress calls
  //      promoteNextInQueue directly to unstick the queue.
  //   B. Active key evicted before pointer (partial Redis eviction) — now
  //      handled inside getCurrentActiveSession with promoteNext: true, and
  //      ensureQueueProgress adds a second safety net.
  //   C. Session expiresAt is past but key still present — handled inside
  //      getCurrentActiveSession with promoteNext: true.
  //
  // The distributed promotion lock (nx: true, 3 s TTL) guarantees idempotency:
  // only one concurrent heartbeat wins the lock and promotes; the rest no-op.
  await ensureQueueProgress(showScopeId);

  // Re-read this user's own active session after ensureQueueProgress.
  //
  // WHY: ensureQueueProgress may have just promoted this user — which removes
  // them from the sorted set. If we proceed straight to resolveVisibleQueueRank,
  // it will find them absent from the sorted set, return null, and the "expired"
  // branch below would DELETE the active session that was just created for them.
  //
  // By re-reading the active key here, we catch the "just promoted on this very
  // heartbeat" case and return "active" before resolveVisibleQueueRank runs.
  const activeJsonAfterProgress = await redis.get(activeKey);
  const activeSessionAfterProgress = parseJson<ActiveSession>(activeJsonAfterProgress);
  if (
    activeSessionAfterProgress &&
    activeSessionAfterProgress.userId === userId &&
    isActiveSessionLive(activeSessionAfterProgress)
  ) {
    return {
      success: true,
      status: "active",
      showScopeId,
      ticketId,
      name: ticket?.name,
      activeToken: activeSessionAfterProgress.activeToken,
      expiresAt: activeSessionAfterProgress.expiresAt,
      message: "Your turn is active.",
    };
  }

  const rank = await resolveVisibleQueueRank({ showScopeId, ticketId });

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
  const avgServiceMsRaw = (await redis.get(avgServiceMsKey)) as
    | number
    | string
    | null;
  const avgServiceMs =
    typeof avgServiceMsRaw === "number"
      ? avgServiceMsRaw
      : typeof avgServiceMsRaw === "string"
        ? Number.parseInt(avgServiceMsRaw, 10)
        : DEFAULT_AVG_SERVICE_MS;

  const safeAvgServiceMs =
    Number.isFinite(avgServiceMs) && avgServiceMs > 0
      ? avgServiceMs
      : DEFAULT_AVG_SERVICE_MS;
  const etaMs = rank * safeAvgServiceMs;
  const pauseState = await getQueuePauseState(showScopeId);

  if (pauseState) {
    return {
      success: true,
      status: "paused",
      showScopeId,
      ticketId,
      name: ticket?.name,
      rank,
      etaMs,
      estimatedWaitMinutes: Math.ceil(etaMs / 60000),
      pauseReason: pauseState.reason,
      message: pauseState.message,
    };
  }

  return {
    success: true,
    status: "waiting",
    showScopeId,
    ticketId,
    name: ticket?.name,
    rank,
    etaMs,
    estimatedWaitMinutes: Math.ceil(etaMs / 60000),
    message: "Waiting in line.",
  };
}
