import {
  GHOST_GRACE_MS,
  HOLD_MS,
  PRESENCE_STALE_MS,
  getNow,
  makeMember,
  queueKeys,
  redis,
  HoldRecord,
} from "./redis";

export async function promoteNext(pageId: string) {
  const lockKey = queueKeys.lock(pageId);
  const locked = await redis.set(lockKey, "1", { nx: true, px: 2000 });
  if (!locked) {
    return;
  }

  try {
    const holdKey = queueKeys.hold(pageId);
    const holdRaw = await redis.get<string>(holdKey);
    if (holdRaw) {
      return;
    }

    const now = getNow();
    await pruneExpiredGhosts(pageId, now);

    const lineKey = queueKeys.line(pageId);
    const presenceKey = queueKeys.presence(pageId);
    const ghostKey = queueKeys.ghosts(pageId);
    const members = await redis.zrange<string[]>(lineKey, 0, 49);

    for (const member of members) {
      const ghostScore = await redis.zscore<number>(ghostKey, member);
      if (ghostScore != null) {
        if (ghostScore <= now) {
          await redis.zrem(ghostKey, member);
          await redis.zrem(lineKey, member);
          continue;
        }

        // Member currently ghosted, skip but leave in queue for grace window.
        continue;
      }

      const lastSeen = await redis.zscore<number>(presenceKey, member);
      if (lastSeen != null && lastSeen > now - PRESENCE_STALE_MS) {
        const hold: HoldRecord = {
          member,
          startedAt: now,
          expiresAt: now + HOLD_MS,
        };

        await redis.zrem(lineKey, member);
        await redis.zrem(ghostKey, member);
        await redis.set(holdKey, JSON.stringify(hold), {
          ex: Math.max(1, Math.ceil(HOLD_MS / 1000)),
        });
        break;
      }

      await redis.zadd(ghostKey, {
        score: now + GHOST_GRACE_MS,
        member,
      });
    }
  } finally {
    await redis.del(lockKey);
  }
}

export async function pruneExpiredGhosts(pageId: string, now = getNow()) {
  const ghostKey = queueKeys.ghosts(pageId);
  const expired = await redis.zrange<string[]>(ghostKey, 0, now, {
    byScore: true,
  });
  if (!expired.length) {
    return;
  }

  const lineKey = queueKeys.line(pageId);
  await Promise.all(
    expired.map(async (member) => {
      await redis.zrem(ghostKey, member);
      await redis.zrem(lineKey, member);
    }),
  );
}

export async function getHold(pageId: string): Promise<HoldRecord | null> {
  const holdKey = queueKeys.hold(pageId);
  const holdRaw = await redis.get<string>(holdKey);
  if (!holdRaw) {
    return null;
  }

  try {
    return JSON.parse(holdRaw) as HoldRecord;
  } catch {
    return null;
  }
}

export function parseMember(member: string) {
  const [userId, sessionId] = member.split(":");
  return { userId, sessionId };
}

export { makeMember };
