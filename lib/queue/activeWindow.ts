import type { ActiveSession } from "@/lib/types/queue";

export const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

export function getActiveWindowDeadline(now = Date.now()): number {
  return now + ACTIVE_WINDOW_MS;
}

export function renewActiveWindowSession(
  session: ActiveSession,
  now = Date.now(),
): ActiveSession {
  return {
    ...session,
    expiresAt: getActiveWindowDeadline(now),
  };
}
