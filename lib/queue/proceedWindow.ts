import type { ActiveSession } from "@/lib/types/queue";

export const PROCEED_WINDOW_MS = 1 * 60 * 1000;

export function getProceedWindowDeadline(now = Date.now()): number {
  return now + PROCEED_WINDOW_MS;
}

export function renewProceedWindowSession(
  session: ActiveSession,
  now = Date.now(),
): ActiveSession {
  return {
    ...session,
    expiresAt: getProceedWindowDeadline(now),
  };
}
