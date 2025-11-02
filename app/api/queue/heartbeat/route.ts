import { NextResponse } from "next/server";

import {
  GHOST_GRACE_MS,
  HOLD_MS,
  PRESENCE_STALE_MS,
  getNow,
  makeMember,
  queueKeys,
  redis,
  userKeys,
} from "@/lib/redis";
import { getHold, promoteNext, pruneExpiredGhosts } from "@/lib/queue";

export const runtime = "edge";

type HeartbeatBody = {
  pageId?: string;
  userId?: string;
  sessionId?: string;
};

type QueueState =
  | { state: "idle"; liveCount: number }
  | {
      state: "waiting";
      position: number;
      etaMs: number;
      liveCount: number;
    }
  | {
      state: "active";
      msLeft: number;
      liveCount: number;
    };

export async function POST(req: Request) {
  const body = (await req.json()) as HeartbeatBody;
  const { pageId, userId, sessionId } = body;

  if (!pageId || !userId || !sessionId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const member = makeMember(userId, sessionId);
  const now = getNow();

  const presenceKey = queueKeys.presence(pageId);
  const activeKey = userKeys.activeSession(userId);

  await redis.zadd(presenceKey, { score: now, member });
  await redis.set(activeKey, sessionId, { ex: 120 });
  await redis.zremrangebyscore(presenceKey, 0, now - PRESENCE_STALE_MS);

  await pruneExpiredGhosts(pageId, now);

  const lineKey = queueKeys.line(pageId);
  const ghostKey = queueKeys.ghosts(pageId);

  const frontMembers = await redis.zrange<string[]>(lineKey, 0, 49);
  if (frontMembers.length) {
    const presenceScores = await Promise.all(
      frontMembers.map((m) => redis.zscore(presenceKey, m))
    );
    const ghostScores = await Promise.all(
      frontMembers.map((m) => redis.zscore(ghostKey, m))
    );

    await Promise.all(
      frontMembers.map(async (m, index) => {
        const lastSeen = presenceScores[index];
        const ghostScore = ghostScores[index];

        if (lastSeen != null && lastSeen > now - PRESENCE_STALE_MS) {
          if (ghostScore != null) {
            await redis.zrem(ghostKey, m);
          }
          return;
        }

        const newGhostExpiry = now + GHOST_GRACE_MS;
        if (ghostScore == null || ghostScore < newGhostExpiry) {
          await redis.zadd(ghostKey, {
            score: newGhostExpiry,
            member: m,
          });
        }
      })
    );
  }

  let hold = await getHold(pageId);
  if (hold && hold.expiresAt <= now) {
    await redis.del(queueKeys.hold(pageId));
    hold = null;
  }

  if (!hold) {
    await promoteNext(pageId);
    hold = await getHold(pageId);
  }

  const ghostMembers = new Set(
    await redis.zrange<string[]>(ghostKey, "-inf", "+inf", { byScore: true })
  );
  const fullLine = await redis.zrange<string[]>(lineKey, 0, -1);

  const liveCount = await redis.zcount(
    presenceKey,
    now - PRESENCE_STALE_MS,
    "+inf"
  );

  if (hold && hold.member === member) {
    const ttl = await redis.pttl(queueKeys.hold(pageId));
    const msLeft = ttl && ttl > 0 ? ttl : Math.max(0, hold.expiresAt - now);
    const response: QueueState = {
      state: "active",
      msLeft,
      liveCount,
    };
    return NextResponse.json(response);
  }

  const index = fullLine.indexOf(member);
  if (index === -1) {
    const response: QueueState = {
      state: "idle",
      liveCount,
    };
    return NextResponse.json(response);
  }

  let visible = 1;
  for (let i = 0; i < index; i += 1) {
    const ahead = fullLine[i];
    if (!ghostMembers.has(ahead)) {
      visible += 1;
    }
  }

  const etaMs = Math.max(0, (visible - 1) * HOLD_MS);

  const response: QueueState = {
    state: "waiting",
    position: visible,
    etaMs,
    liveCount,
  };
  return NextResponse.json(response);
}
