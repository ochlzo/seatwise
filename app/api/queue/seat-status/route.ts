import { NextRequest, NextResponse } from "next/server";
import type { SeatStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

export async function GET(request: NextRequest) {
  try {
    const showId = request.nextUrl.searchParams.get("showId")?.trim() ?? "";
    const schedId = request.nextUrl.searchParams.get("schedId")?.trim() ?? "";

    if (!showId || !schedId) {
      return NextResponse.json(
        { success: false, error: "Missing showId or schedId." },
        { status: 400 },
      );
    }

    const schedule = await prisma.sched.findFirst({
      where: {
        sched_id: schedId,
        show_id: showId,
      },
      select: {
        sched_id: true,
        seatAssignments: {
          select: {
            seat_id: true,
            seat_status: true,
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: "Schedule not found." },
        { status: 404 },
      );
    }

    const seatStatusById: Record<string, SeatStatus> = {};
    for (const assignment of schedule.seatAssignments) {
      seatStatusById[assignment.seat_id] = assignment.seat_status;
    }

    return NextResponse.json({
      success: true,
      showScopeId: `${showId}:${schedId}`,
      seatStatusById,
    });
  } catch (error) {
    console.error("[queue/seat-status] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
