import { NextRequest, NextResponse } from "next/server";
import type { SchedStatus, ShowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateActiveSession } from "@/lib/queue/validateActiveSession";
import { createRouteTimer, isRouteTimingEnabled } from "@/lib/server/timing";
import {
  isSchedStatusReservable,
  getEffectiveSchedStatus,
  getEffectiveShowStatus,
} from "@/lib/shows/effectiveStatus";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

export async function POST(request: NextRequest) {
  const timer = createRouteTimer("/api/queue/active", {
    enabled: isRouteTimingEnabled(request),
  });

  try {
    const body = await request.json();
    const { showId, schedId, guestId, ticketId, activeToken, scheduleSnapshot } = body as {
      showId?: string;
      schedId?: string;
      guestId?: string;
      ticketId?: string;
      activeToken?: string;
      scheduleSnapshot?: {
        schedId?: string;
        schedDate?: string;
        schedStartTime?: string;
        schedEndTime?: string;
        schedStatus?: SchedStatus | null;
        showName?: string;
        showStatus?: ShowStatus;
      };
    };

    if (!showId || !schedId || !guestId || !ticketId || !activeToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing showId, schedId, guestId, ticketId, or activeToken",
        },
        { status: 400 },
      );
    }

    const trustedScheduleSnapshot =
      scheduleSnapshot &&
      scheduleSnapshot.schedId === schedId &&
      typeof scheduleSnapshot.schedDate === "string" &&
      typeof scheduleSnapshot.schedStartTime === "string" &&
      typeof scheduleSnapshot.schedEndTime === "string" &&
      typeof scheduleSnapshot.showName === "string" &&
      typeof scheduleSnapshot.showStatus === "string"
        ? {
            sched_id: schedId,
            sched_date: new Date(scheduleSnapshot.schedDate),
            sched_start_time: new Date(scheduleSnapshot.schedStartTime),
            sched_end_time: new Date(scheduleSnapshot.schedEndTime),
            status: scheduleSnapshot.schedStatus ?? null,
            show: {
              show_name: scheduleSnapshot.showName,
              show_status: scheduleSnapshot.showStatus,
            },
          }
        : null;

    const schedule =
      trustedScheduleSnapshot ??
      (await timer.time("postgres.schedule_lookup", () =>
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
                show_name: true,
                show_status: true,
              },
            },
          },
        }),
      ));

    if (!schedule) {
      timer.flush({ status: 404, reason: "schedule_not_found" });
      return NextResponse.json(
        { success: false, error: "Schedule not found" },
        { status: 404 },
      );
    }

    const showScopeId = `${showId}:${schedId}`;
    const validation = await timer.time("redis.validate_active_session", () =>
      validateActiveSession({
        showScopeId,
        ticketId,
        userId: guestId,
        activeToken,
      }),
    );

    if (!validation.valid) {
      timer.flush({
        showScopeId,
        valid: false,
        reason: validation.reason,
        usedTrustedScheduleSnapshot: trustedScheduleSnapshot != null,
      });
      return NextResponse.json({
        success: true,
        valid: false,
        reason: validation.reason,
        showName: schedule.show.show_name,
      });
    }

    const effectiveShowStatus = getEffectiveShowStatus({
      show_status: schedule.show.show_status,
      scheds: [schedule],
    });
    const effectiveSchedStatus = getEffectiveSchedStatus(schedule);

    if (!isSchedStatusReservable(effectiveSchedStatus)) {
      timer.flush({
        showScopeId,
        valid: false,
        reason: "closed",
        usedTrustedScheduleSnapshot: trustedScheduleSnapshot != null,
      });
      return NextResponse.json({
        success: true,
        valid: false,
        reason: "closed",
        showName: schedule.show.show_name,
      });
    }

    timer.flush({
      showScopeId,
      valid: true,
      showStatus: effectiveShowStatus,
      usedTrustedScheduleSnapshot: trustedScheduleSnapshot != null,
    });

    return NextResponse.json({
      success: true,
      valid: true,
      showScopeId,
      showName: schedule.show.show_name,
      showStatus: effectiveShowStatus,
      session: validation.session,
    });
  } catch (error) {
    console.error("Error in /api/queue/active:", error);
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
