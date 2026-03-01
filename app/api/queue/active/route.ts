import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateActiveSession } from "@/lib/queue/validateActiveSession";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { showId, schedId, guestId, ticketId, activeToken } = body as {
      showId?: string;
      schedId?: string;
      guestId?: string;
      ticketId?: string;
      activeToken?: string;
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

    const schedule = await prisma.sched.findFirst({
      where: {
        sched_id: schedId,
        show_id: showId,
      },
      include: {
        show: {
          select: {
            show_name: true,
            show_status: true,
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
    const validation = await validateActiveSession({
      showScopeId,
      ticketId,
      userId: guestId,
      activeToken,
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: true,
        valid: false,
        reason: validation.reason,
        showName: schedule.show.show_name,
      });
    }

    return NextResponse.json({
      success: true,
      valid: true,
      showScopeId,
      showName: schedule.show.show_name,
      showStatus: schedule.show.show_status,
      session: validation.session,
    });
  } catch (error) {
    console.error("Error in /api/queue/active:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
