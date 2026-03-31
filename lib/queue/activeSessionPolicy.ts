import type { ActiveSession } from "../types/queue.ts";

export function isPersistentActiveSession(session: Pick<ActiveSession, "mode" | "expiresAt">) {
  return session.mode === "walk_in" && session.expiresAt === null;
}

export function isActiveSessionLive(
  session: Pick<ActiveSession, "mode" | "expiresAt">,
  now = Date.now(),
) {
  if (isPersistentActiveSession(session)) {
    return true;
  }

  return typeof session.expiresAt === "number" && session.expiresAt > now;
}
