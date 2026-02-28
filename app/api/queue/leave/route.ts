import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { validateActiveSession } from "@/lib/queue/validateActiveSession";
import { completeActiveSessionAndPromoteNext } from "@/lib/queue/queueLifecycle";

export async function POST(request: NextRequest) {
  try {
    const { adminAuth } = await import("@/lib/firebaseAdmin");
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const user = await prisma.user.findUnique({
      where: { firebase_uid: decodedToken.uid },
      select: { user_id: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { showId, schedId, ticketId, activeToken } = body as {
      showId?: string;
      schedId?: string;
      ticketId?: string;
      activeToken?: string;
    };

    if (!showId || !schedId || !ticketId || !activeToken) {
      return NextResponse.json(
        { success: false, error: "Missing showId, schedId, ticketId, or activeToken" },
        { status: 400 },
      );
    }

    const showScopeId = `${showId}:${schedId}`;
    const validation = await validateActiveSession({
      showScopeId,
      ticketId,
      userId: user.user_id,
      activeToken,
    });

    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        { success: false, error: "Active session is invalid or expired", reason: validation.reason },
        { status: 400 },
      );
    }

    const promotion = await completeActiveSessionAndPromoteNext({
      showScopeId,
      session: validation.session,
    });

    return NextResponse.json({
      success: true,
      showScopeId,
      promoted: promotion.promoted,
      next: promotion.activeSession
        ? {
          ticketId: promotion.activeSession.ticketId,
          activeToken: promotion.activeSession.activeToken,
          expiresAt: promotion.activeSession.expiresAt,
        }
        : null,
    });
  } catch (error) {
    console.error("[queue/leave] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

