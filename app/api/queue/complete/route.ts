import { NextResponse } from "next/server";

import { makeMember, promoteNext, getHold } from "@/lib/queue";
import { queueKeys, redis } from "@/lib/redis";

export const runtime = "edge";

type CompleteBody = {
  pageId?: string;
  userId?: string;
  sessionId?: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as CompleteBody;
  const { pageId, userId, sessionId } = body;

  if (!pageId || !userId || !sessionId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const member = makeMember(userId, sessionId);
  const hold = await getHold(pageId);

  if (!hold || hold.member !== member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await redis.del(queueKeys.hold(pageId));
  await promoteNext(pageId);

  return NextResponse.json({ ok: true });
}
