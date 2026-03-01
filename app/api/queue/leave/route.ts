import { NextRequest, NextResponse } from "next/server";
import { validateActiveSession } from "@/lib/queue/validateActiveSession";
import { completeActiveSessionAndPromoteNext } from "@/lib/queue/queueLifecycle";

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
        { success: false, error: "Missing showId, schedId, guestId, ticketId, or activeToken" },
        { status: 400 },
      );
    }

    const showScopeId = `${showId}:${schedId}`;
    const validation = await validateActiveSession({
      showScopeId,
      ticketId,
      userId: guestId,
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

