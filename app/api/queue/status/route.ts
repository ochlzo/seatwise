import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getQueueStatus } from "@/lib/queue/getQueueStatus";
import { promoteNextInQueue } from "@/lib/queue/queueLifecycle";

export async function GET(request: NextRequest) {
  try {
    const { adminAuth } = await import("@/lib/firebaseAdmin");
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);

    const user = await prisma.user.findUnique({
      where: { firebase_uid: decodedToken.uid },
      select: { user_id: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const showId = request.nextUrl.searchParams.get("showId");
    const schedId = request.nextUrl.searchParams.get("schedId");

    if (!showId || !schedId) {
      return NextResponse.json(
        { success: false, error: "Missing showId or schedId" },
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
      userId: user.user_id,
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
