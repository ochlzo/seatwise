import { NextResponse } from "next/server";

import { getHold, makeMember, promoteNext } from "@/lib/queue";
import { queueKeys, redis } from "@/lib/redis";

export const runtime = "edge";

type LeaveBody = {
  pageId?: string;
  userId?: string;
  sessionId?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as LeaveBody;
  const { pageId, userId, sessionId } = body;

  if (!pageId || !userId || !sessionId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const member = makeMember(userId, sessionId);

  const lineKey = queueKeys.line(pageId);
  const presenceKey = queueKeys.presence(pageId);
  const ghostKey = queueKeys.ghosts(pageId);

  await Promise.all([
    redis.zrem(lineKey, member),
    redis.zrem(ghostKey, member),
    redis.zrem(presenceKey, member),
  ]);

  const hold = await getHold(pageId);
  if (hold?.member === member) {
    await redis.del(queueKeys.hold(pageId));
    await promoteNext(pageId);
  }

  return NextResponse.json({ ok: true });
}
