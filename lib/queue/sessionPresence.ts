import { redis } from "@/lib/clients/redis";

export const QUEUE_PRESENCE_TTL_SECONDS = 30;

export const getQueuePresenceKey = (showScopeId: string, userId: string) =>
  `seatwise:presence:${showScopeId}:${userId}`;

export async function touchQueuePresence({
  showScopeId,
  userId,
  ttlSeconds = QUEUE_PRESENCE_TTL_SECONDS,
}: {
  showScopeId: string;
  userId: string;
  ttlSeconds?: number;
}) {
  if (!showScopeId || !userId) {
    return false;
  }

  await redis.set(getQueuePresenceKey(showScopeId, userId), String(Date.now()), {
    ex: Math.max(1, Math.floor(ttlSeconds)),
  });

  return true;
}

export async function hasFreshQueuePresence({
  showScopeId,
  userId,
}: {
  showScopeId: string;
  userId: string;
}) {
  if (!showScopeId || !userId) {
    return false;
  }

  const presence = await redis.get(getQueuePresenceKey(showScopeId, userId));
  return presence !== null;
}

export async function clearQueuePresence({
  showScopeId,
  userId,
}: {
  showScopeId: string;
  userId: string;
}) {
  if (!showScopeId || !userId) {
    return false;
  }

  await redis.del(getQueuePresenceKey(showScopeId, userId));
  return true;
}
