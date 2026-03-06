import { NextRequest, NextResponse } from "next/server";
import {
  ensureInviteClaim,
  getInviteSession,
  INVITE_CLAIM_COOKIE,
  verifyInviteToken,
} from "@/lib/invite/adminInvite";

const INVITE_UNAVAILABLE_ERROR = "Invite link is invalid or unavailable.";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
    }

    const payload = verifyInviteToken(token);
    const session = await getInviteSession(payload.inviteId);
    if (!session) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 410 });
    }
    if (session.consumed) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 410 });
    }
    if (session.email !== payload.email || session.teamId !== payload.teamId) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
    }
    if (Date.now() >= session.expiresAt) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 410 });
    }

    const claimResult = await ensureInviteClaim(
      payload.inviteId,
      session.expiresAt,
      request.cookies.get(INVITE_CLAIM_COOKIE)?.value,
    );
    if (!claimResult.ok || !claimResult.claimCookieValue) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 410 });
    }

    const response = NextResponse.json({
      success: true,
      invite: {
        inviteId: session.inviteId,
        email: session.email,
        teamName: session.teamName,
        expiresAt: session.expiresAt,
        otpVerified: session.otpVerified,
      },
    });

    response.cookies.set({
      name: INVITE_CLAIM_COOKIE,
      value: claimResult.claimCookieValue,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(session.expiresAt),
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
  }
}
