import { NextRequest, NextResponse } from "next/server";
import { getInviteSession, verifyInviteToken } from "@/lib/invite/adminInvite";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "token is required." }, { status: 400 });
    }

    const payload = verifyInviteToken(token);
    const session = await getInviteSession(payload.inviteId);
    if (!session) {
      return NextResponse.json({ error: "Invite session not found or expired." }, { status: 410 });
    }
    if (session.consumed) {
      return NextResponse.json({ error: "Invite already consumed." }, { status: 410 });
    }
    if (session.email !== payload.email || session.teamId !== payload.teamId) {
      return NextResponse.json({ error: "Invite token does not match session." }, { status: 400 });
    }
    if (Date.now() >= session.expiresAt) {
      return NextResponse.json({ error: "Invite has expired." }, { status: 410 });
    }

    return NextResponse.json({
      success: true,
      invite: {
        inviteId: session.inviteId,
        email: session.email,
        teamName: session.teamName,
        expiresAt: session.expiresAt,
        otpVerified: session.otpVerified,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to validate invite.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

