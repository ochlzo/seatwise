import { NextResponse } from "next/server";

import { getHold, makeMember, promoteNext } from "@/lib/queue";
import { getNow, queueKeys, redis, userKeys } from "@/lib/redis";

export const runtime = "edge";

type JoinBody = {
  pageId?: string;
  userId?: string;
  sessionId?: string;
  name?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as JoinBody;
  const { pageId, userId, sessionId, name } = body;

  if (!pageId || !userId || !sessionId || !name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const member = makeMember(userId, sessionId);
  const now = getNow();

  const activeKey = userKeys.activeSession(userId);
  const lockResult = await redis.set(activeKey, sessionId, {
    nx: true,
    ex: 120,
  });

  if (!lockResult) {
    const currentSession = await redis.get<string>(activeKey);
    if (currentSession && currentSession !== sessionId) {
      return NextResponse.json(
        { error: "Another tab is active for this account." },
        { status: 409 }
      );
    }

    await redis.set(activeKey, sessionId, { ex: 120 });
  }

  const presenceKey = queueKeys.presence(pageId);
  await redis.zadd(presenceKey, { score: now, member });

  const lineKey = queueKeys.line(pageId);
  const existingScore = await redis.zscore(lineKey, member);

  if (existingScore == null) {
    const seq = await redis.incr(queueKeys.seq(pageId));
    await redis.zadd(lineKey, { score: seq, member });
  }

  await redis.set(
    queueKeys.meta(pageId, member),
    JSON.stringify({
      name,
      joinedAt: now,
    }),
    {
      ex: 7200,
    }
  );

  await promoteNext(pageId);

  const hold = await getHold(pageId);
  const isActive = hold?.member === member;

  return NextResponse.json({ ok: true, active: isActive });
}
