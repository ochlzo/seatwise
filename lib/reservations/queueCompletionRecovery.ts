const RECOVERY_REASONS = new Set([
  "missing",
  "expired",
  "ticket_mismatch",
  "token_mismatch",
]);

export const QUEUE_SESSION_RECOVERY_MESSAGE =
  "Your active reservation window ended before checkout completed. Rejoin the queue to try again.";

export function isQueueCompletionSessionRecovery({
  status,
  reason,
  error,
}: {
  status: number;
  reason?: string | null;
  error?: string | null;
}) {
  if (status !== 400) {
    return false;
  }

  if (reason && RECOVERY_REASONS.has(reason)) {
    return true;
  }

  return (
    typeof error === "string" &&
    /active session is invalid or expired/i.test(error)
  );
}
