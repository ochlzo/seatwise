import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getQueueStatus } from "@/lib/queue/getQueueStatus";
import { createRouteTimer, isRouteTimingEnabled } from "@/lib/server/timing";
import {
  isSchedStatusReservable,
  getEffectiveSchedStatus,
  getEffectiveShowStatus,
} from "@/lib/shows/effectiveStatus";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

export async function GET(request: NextRequest) {
  const timer = createRouteTimer("/api/queue/status", {
    enabled: isRouteTimingEnabled(request),
  });

  try {
    const showId = request.nextUrl.searchParams.get("showId");
    const schedId = request.nextUrl.searchParams.get("schedId");
    const guestId = request.nextUrl.searchParams.get("guestId");

    if (!showId || !schedId || !guestId) {
      return NextResponse.json(
        { success: false, error: "Missing showId, schedId, or guestId" },
        { status: 400 },
      );
    }

    const schedule = await timer.time("postgres.schedule_lookup", () =>
      prisma.sched.findFirst({
        where: {
          sched_id: schedId,
          show_id: showId,
        },
        select: {
          sched_id: true,
          sched_date: true,
          sched_start_time: true,
          sched_end_time: true,
          status: true,
          show: {
            select: {
              show_status: true,
              show_name: true,
            },
          },
        },
      }),
    );

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: "Schedule not found" },
        { status: 404 },
      );
    }

    const showScopeId = `${showId}:${schedId}`;

    const effectiveShowStatus = getEffectiveShowStatus({
      show_status: schedule.show.show_status,
      scheds: [schedule],
    });
    const effectiveSchedStatus = getEffectiveSchedStatus(schedule);

    if (
      effectiveShowStatus !== "OPEN" &&
      effectiveShowStatus !== "ON_GOING" &&
      effectiveShowStatus !== "DRY_RUN"
    ) {
      return NextResponse.json({
        success: true,
        status: "closed",
        showScopeId,
        showName: schedule.show.show_name,
        message: "This show is not currently accepting reservations.",
      });
    }

    if (!isSchedStatusReservable(effectiveSchedStatus)) {
      return NextResponse.json({
        success: true,
        status: "closed",
        showScopeId,
        showName: schedule.show.show_name,
        message: "This schedule is not currently accepting reservations.",
      });
    }

    const status = await timer.time("redis.get_queue_status", () =>
      getQueueStatus({
        showScopeId,
        userId: guestId,
      }),
    );

    timer.flush({
      showScopeId,
      status: status.status,
      promotedFromHeartbeat: false,
    });

    return NextResponse.json({
      ...status,
      showName: schedule.show.show_name,
    });
  } catch (error) {
    console.error("Error in /api/queue/status:", error);
    timer.flush({ error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
