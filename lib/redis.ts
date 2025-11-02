import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

export const HOLD_MS = Number.parseInt(process.env.HOLD_MS ?? "30000", 10);
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const PRESENCE_STALE_MS = 90_000;
export const GHOST_GRACE_MS = 90_000;

export const queueKeys = {
  seq: (pageId: string) => `q:${pageId}:seq`,
  line: (pageId: string) => `q:${pageId}:line`,
  hold: (pageId: string) => `q:${pageId}:hold`,
  presence: (pageId: string) => `q:${pageId}:presence`,
  ghosts: (pageId: string) => `q:${pageId}:ghosts`,
  lock: (pageId: string) => `q:${pageId}:lock`,
  meta: (pageId: string, member: string) => `q:${pageId}:meta:${member}`,
};

export const userKeys = {
  activeSession: (userId: string) => `user:activeSession:${userId}`,
};

export type HoldRecord = {
  member: string;
  startedAt: number;
  expiresAt: number;
};

export function makeMember(userId: string, sessionId: string) {
  return `${userId}:${sessionId}`;
}

export function getNow() {
  return Date.now();
}
