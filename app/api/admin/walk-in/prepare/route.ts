import { NextRequest, NextResponse } from "next/server";

import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { redis } from "@/lib/clients/redis";
import { getQueuePauseState, pauseQueueChannel } from "@/lib/queue/closeQueue";
import { getQueueStatus } from "@/lib/queue/getQueueStatus";
import { joinQueue } from "@/lib/queue/joinQueue";
import {
  getCurrentActiveSession,
  persistWalkInActiveSession,
  promoteNextInQueue,
} from "@/lib/queue/queueLifecycle";
import { prisma } from "@/lib/prisma";
import {
  getEffectiveSchedStatus,
  getEffectiveShowStatus,
  isSchedStatusReservable,
} from "@/lib/shows/effectiveStatus";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

const WALK_IN_PRIORITY_SCORE = 0;

const buildAdminQueueName = (teamName: string | null) =>
  teamName ? `Walk-in (${teamName})` : "Walk-in Admin";

const clearStaleAdminTicketArtifacts = async ({
  showScopeId,
  userId,
  ticketId,
}: {
  showScopeId: string;
  userId: string;
  ticketId: string;
}) => {
  await redis.hdel(`seatwise:user_ticket:${showScopeId}`, userId);
  await redis.del(`seatwise:ticket:${showScopeId}:${ticketId}`);
};

export async function POST(request: NextRequest) {
  try {
    let adminContext;
    try {
      adminContext = await getCurrentAdminContext();
    } catch (error) {
      if (error instanceof AdminContextError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      showId?: string;
      schedId?: string;
    };

    const showId = typeof body.showId === "string" ? body.showId.trim() : "";
    const schedId = typeof body.schedId === "string" ? body.schedId.trim() : "";

    if (!showId || !schedId) {
      return NextResponse.json({ error: "Missing showId or schedId" }, { status: 400 });
    }

    const schedule = await prisma.sched.findFirst({
      where: {
        sched_id: schedId,
        show_id: showId,
        show: adminContext.isSuperadmin
          ? undefined
          : { team_id: adminContext.teamId ?? "__NO_TEAM__" },
      },
      select: {
        sched_id: true,
        sched_date: true,
        sched_start_time: true,
        sched_end_time: true,
        status: true,
        show: {
          select: {
            show_name: true,
            show_status: true,
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const effectiveShowStatus = getEffectiveShowStatus({
      show_status: schedule.show.show_status,
      scheds: [schedule],
    });
    const effectiveSchedStatus = getEffectiveSchedStatus(schedule);

    if (effectiveShowStatus !== "OPEN" && effectiveShowStatus !== "ON_GOING") {
      return NextResponse.json(
        { error: "This show is not currently accepting reservations.", code: "show_unavailable" },
        { status: 409 },
      );
    }

    if (!isSchedStatusReservable(effectiveSchedStatus)) {
      return NextResponse.json(
        { error: "This schedule is not currently accepting reservations.", code: "schedule_unavailable" },
        { status: 409 },
      );
    }

    const showScopeId = `${showId}:${schedId}`;
    const currentActiveSession = await getCurrentActiveSession(showScopeId);

    if (currentActiveSession?.userId === adminContext.userId) {
      const activeWalkInSession = await persistWalkInActiveSession({
        showScopeId,
        session: currentActiveSession,
      });
      const pauseState = await getQueuePauseState(showScopeId);
      if (pauseState?.reason !== "walk_in") {
        await pauseQueueChannel(showScopeId, "walk_in");
      }

      return NextResponse.json({
        success: true,
        state: "active_and_paused",
        showScopeId,
        showName: schedule.show.show_name,
        ticketId: activeWalkInSession.ticketId,
        activeToken: activeWalkInSession.activeToken,
        expiresAt: activeWalkInSession.expiresAt,
        message: "Walk-in reservation room is active. Queue will stay paused until you finalize or exit.",
      });
    }

    const pauseState = await getQueuePauseState(showScopeId);
    if (pauseState) {
      return NextResponse.json(
        {
          success: false,
          code: pauseState.reason === "walk_in" ? "walk_in_in_progress" : "queue_paused",
          error: pauseState.message,
        },
        { status: 409 },
      );
    }

    const userTicketKey = `seatwise:user_ticket:${showScopeId}`;
    let currentTicketId = (await redis.hget(userTicketKey, adminContext.userId)) as string | null;

    if (currentTicketId) {
      const existingRank = await redis.zrank(`seatwise:queue:${showScopeId}`, currentTicketId);
      if (existingRank === null) {
        await clearStaleAdminTicketArtifacts({
          showScopeId,
          userId: adminContext.userId,
          ticketId: currentTicketId,
        });
        currentTicketId = null;
      }
    }

    const queueTicketResult =
      currentTicketId == null
        ? await joinQueue({
            showScopeId,
            userId: adminContext.userId,
            userName: buildAdminQueueName(adminContext.teamName),
            queueScore: WALK_IN_PRIORITY_SCORE,
          })
        : null;

    if (queueTicketResult && !queueTicketResult.success) {
      return NextResponse.json(
        {
          success: false,
          code: "queue_join_failed",
          error: queueTicketResult.error ?? "Failed to place admin in queue.",
        },
        { status: 500 },
      );
    }

    if (currentActiveSession && currentActiveSession.userId !== adminContext.userId) {
      const queueStatus = await getQueueStatus({
        showScopeId,
        userId: adminContext.userId,
      });

      return NextResponse.json({
        success: true,
        state: "queued",
        showScopeId,
        showName: schedule.show.show_name,
        ticketId: queueStatus.ticketId,
        rank: queueStatus.rank,
        estimatedWaitMinutes: queueStatus.estimatedWaitMinutes,
        message: "Another customer is currently active. The walk-in sale will begin as soon as the room is free.",
      });
    }

    const promotion = await promoteNextInQueue({ showScopeId });
    const activeAfterPromotion = promotion.activeSession ?? (await getCurrentActiveSession(showScopeId));

    if (activeAfterPromotion?.userId === adminContext.userId) {
      const activeWalkInSession = await persistWalkInActiveSession({
        showScopeId,
        session: activeAfterPromotion,
      });
      await pauseQueueChannel(showScopeId, "walk_in");

      return NextResponse.json({
        success: true,
        state: "active_and_paused",
        showScopeId,
        showName: schedule.show.show_name,
        ticketId: activeWalkInSession.ticketId,
        activeToken: activeWalkInSession.activeToken,
        expiresAt: activeWalkInSession.expiresAt,
        message: "Walk-in reservation room is active. Queue will stay paused until you finalize or exit.",
      });
    }

    const queueStatus = await getQueueStatus({
      showScopeId,
      userId: adminContext.userId,
    });

    return NextResponse.json({
      success: true,
      state: "queued",
      showScopeId,
      showName: schedule.show.show_name,
      ticketId: queueStatus.ticketId,
      rank: queueStatus.rank,
      estimatedWaitMinutes: queueStatus.estimatedWaitMinutes,
      message: "Walk-in is queued and will start once the current room is available.",
    });
  } catch (error) {
    console.error("[admin/walk-in/prepare] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
