import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/clients/redis";
import {
  getInviteOtpState,
  getInviteSession,
  hashOtp,
  inviteOtpKey,
  OTP_MAX_ATTEMPTS,
  setInviteOtpState,
  setInviteSession,
  verifyInviteToken,
} from "@/lib/invite/adminInvite";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; otp?: string };
    const token = body.token?.trim();
    const otp = body.otp?.trim();
    if (!token || !otp) {
      return NextResponse.json({ error: "token and otp are required." }, { status: 400 });
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

    const state = await getInviteOtpState(payload.inviteId);
    if (!state || Date.now() >= state.expiresAt) {
      return NextResponse.json({ error: "OTP has expired. Request a new OTP." }, { status: 410 });
    }

    if (state.attempts >= OTP_MAX_ATTEMPTS) {
      return NextResponse.json({ error: "OTP attempts exceeded." }, { status: 429 });
    }

    const hashed = hashOtp(otp);
    if (hashed !== state.otpHash) {
      const nextState = { ...state, attempts: state.attempts + 1 };
      await setInviteOtpState(payload.inviteId, nextState);
      return NextResponse.json({ error: "Incorrect OTP." }, { status: 400 });
    }

    await redis.del(inviteOtpKey(payload.inviteId));
    await setInviteSession({
      ...session,
      otpVerified: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify OTP.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
