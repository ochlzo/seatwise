import type { QueuePauseReason, QueuePauseState } from "@/lib/types/queue";

export const WALK_IN_QUEUE_PAUSE_MESSAGE =
  "Please wait, we are currently accommodating walk ins";

const POSTPONED_QUEUE_PAUSE_MESSAGE =
  "This show has been postponed. Queue is temporarily paused.";

const DEFAULT_PAUSE_REASON: QueuePauseReason = "postponed";

export const getQueuePauseMessage = (reason: QueuePauseReason) =>
  reason === "walk_in" ? WALK_IN_QUEUE_PAUSE_MESSAGE : POSTPONED_QUEUE_PAUSE_MESSAGE;

export const createQueuePauseState = (
  reason: QueuePauseReason = DEFAULT_PAUSE_REASON,
): QueuePauseState => ({
  reason,
  message: getQueuePauseMessage(reason),
  pausedAt: Date.now(),
});

export const parseQueuePauseState = (value: unknown): QueuePauseState | null => {
  const fallbackPauseState = (): QueuePauseState => ({
    reason: DEFAULT_PAUSE_REASON,
    message: getQueuePauseMessage(DEFAULT_PAUSE_REASON),
    pausedAt: Date.now(),
  });

  if (value == null) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parseQueuePauseState(parsed) ?? fallbackPauseState();
    } catch {
      return fallbackPauseState();
    }
  }

  if (typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<QueuePauseState>;
  const reason = candidate.reason === "walk_in" ? "walk_in" : DEFAULT_PAUSE_REASON;
  const message =
    typeof candidate.message === "string" && candidate.message.trim().length > 0
      ? candidate.message
      : getQueuePauseMessage(reason);
  const pausedAt =
    typeof candidate.pausedAt === "number" && Number.isFinite(candidate.pausedAt)
      ? candidate.pausedAt
      : Date.now();

  return {
    reason,
    message,
    pausedAt,
  };
};

export const shouldClearWalkInPauseState = ({
  pauseState,
  hasLiveActiveSession,
}: {
  pauseState: QueuePauseState | null;
  hasLiveActiveSession: boolean;
}) => pauseState?.reason === "walk_in" && !hasLiveActiveSession;
