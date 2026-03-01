import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/clients/redis";
import { ably } from "@/lib/clients/ably";
import type { ActiveSession, QueueMoveEvent } from "@/lib/types/queue";
import { completeActiveSessionAndPromoteNext, promoteNextInQueue } from "@/lib/queue/queueLifecycle";

const parseJson = <T>(value: unknown): T | null => {
  if (value == null) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as T;
  }
  return null;
};

const parseTerminateBody = async (request: NextRequest): Promise<{
  showId?: string;
  schedId?: string;
  guestId?: string;
  ticketId?: string;
  activeToken?: string;
} | null> => {
  try {
      return (await request.json()) as {
        showId?: string;
        schedId?: string;
        guestId?: string;
        ticketId?: string;
        activeToken?: string;
      };
  } catch {
    try {
      const text = await request.text();
      if (!text) return null;
      return JSON.parse(text) as {
        showId?: string;
        schedId?: string;
        guestId?: string;
        ticketId?: string;
        activeToken?: string;
      };
    } catch {
      return null;
    }
  }
};

const publishQueueMoveEvent = async (showScopeId: string) => {
  const seqKey = `seatwise:seq:${showScopeId}`;
  const seq = await redis.incr(seqKey);
  const event: QueueMoveEvent = {
    type: "QUEUE_MOVE",
    departedRank: 0,
    seq,
  };
  await ably.channels.get(`seatwise:${showScopeId}:public`).publish("queue-event", event);
};

export async function POST(request: NextRequest) {
  try {
    const body = await parseTerminateBody(request);
    const showId = body?.showId;
    const schedId = body?.schedId;
    const guestId = body?.guestId;

    if (!showId || !schedId || !guestId) {
      return NextResponse.json(
        { success: false, error: "Missing showId, schedId, or guestId" },
        { status: 400 },
      );
    }

    const showScopeId = `${showId}:${schedId}`;
    const userTicketKey = `seatwise:user_ticket:${showScopeId}`;
    const resolvedTicketId =
      body?.ticketId ||
      ((await redis.hget(userTicketKey, guestId)) as string | null);

    if (!resolvedTicketId) {
      return NextResponse.json({
        success: true,
        showScopeId,
        terminated: false,
        message: "No active queue ticket found for this user.",
      });
    }

    const queueKey = `seatwise:queue:${showScopeId}`;
    const activeKey = `seatwise:active:${showScopeId}:${resolvedTicketId}`;
    const ticketKey = `seatwise:ticket:${showScopeId}:${resolvedTicketId}`;
    const activeRaw = await redis.get(activeKey);
    const activeSession = parseJson<ActiveSession>(activeRaw);

    if (
      activeSession &&
      activeSession.userId === guestId &&
      (!body?.activeToken || body.activeToken === activeSession.activeToken)
    ) {
      const promotion = await completeActiveSessionAndPromoteNext({
        showScopeId,
        session: activeSession,
      });

      return NextResponse.json({
        success: true,
        showScopeId,
        ticketId: resolvedTicketId,
        terminated: true,
        mode: "active",
        promoted: promotion.promoted,
      });
    }

    const removedFromQueue = await redis.zrem(queueKey, resolvedTicketId);
    await redis.del(activeKey, ticketKey);
    const currentlyMappedTicketId = (await redis.hget(userTicketKey, guestId)) as string | null;
    if (currentlyMappedTicketId === resolvedTicketId) {
      await redis.hdel(userTicketKey, guestId);
    }

    if (removedFromQueue > 0) {
      await publishQueueMoveEvent(showScopeId);
    }

    const promotion = await promoteNextInQueue({ showScopeId });

    return NextResponse.json({
      success: true,
      showScopeId,
      ticketId: resolvedTicketId,
      terminated: removedFromQueue > 0,
      mode: "waiting",
      promoted: promotion.promoted,
    });
  } catch (error) {
    console.error("[queue/terminate] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

