import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getQueueStatus } from "@/lib/queue/getQueueStatus";
import { promoteNextInQueue } from "@/lib/queue/queueLifecycle";

export async function GET(request: NextRequest) {
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

    const schedule = await prisma.sched.findFirst({
      where: {
        sched_id: schedId,
        show_id: showId,
      },
      include: {
        show: {
          select: {
            show_status: true,
            show_name: true,
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: "Schedule not found" },
        { status: 404 },
      );
    }

    const showScopeId = `${showId}:${schedId}`;

    if (schedule.show.show_status !== "OPEN") {
      return NextResponse.json({
        success: true,
        status: "closed",
        showScopeId,
        showName: schedule.show.show_name,
        message: "This show is not currently accepting reservations.",
      });
    }

    await promoteNextInQueue({ showScopeId });

    const status = await getQueueStatus({
      showScopeId,
      userId: guestId,
    });

    return NextResponse.json({
      ...status,
      showName: schedule.show.show_name,
    });
  } catch (error) {
    console.error("Error in /api/queue/status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
