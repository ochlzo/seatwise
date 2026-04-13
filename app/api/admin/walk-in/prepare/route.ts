import { NextRequest, NextResponse } from "next/server";

import {
  AdminContextError,
  getCurrentAdminContext,
} from "@/lib/auth/adminContext";
import { prisma } from "@/lib/prisma";
import { getEffectiveSchedStatus } from "@/lib/shows/effectiveStatus";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

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

    const effectiveSchedStatus = getEffectiveSchedStatus(schedule);
    const showStatus = schedule.show.show_status;

    if (
      showStatus !== "OPEN" &&
      showStatus !== "ON_GOING" &&
      showStatus !== "DRY_RUN"
    ) {
      return NextResponse.json(
        {
          error: "This show is not currently accepting reservations.",
          code: "show_unavailable",
          showStatus,
        },
        { status: 409 },
      );
    }

    if (effectiveSchedStatus === "FULLY_BOOKED") {
      return NextResponse.json(
        {
          error: "This schedule is not currently accepting reservations.",
          code: "schedule_unavailable",
          effectiveSchedStatus,
        },
        { status: 409 },
      );
    }

    const showScopeId = `${showId}:${schedId}`;

    return NextResponse.json({
      success: true,
      state: "ready",
      showScopeId,
      showName: schedule.show.show_name,
      message:
        "Walk-in reservation room is ready. You can proceed without joining the queue.",
    });
  } catch (error) {
    console.error("[admin/walk-in/prepare] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
