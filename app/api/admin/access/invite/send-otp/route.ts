import { NextRequest, NextResponse } from "next/server";
import { sendAdminInviteOtpEmail } from "@/lib/email/sendAdminInviteOtpEmail";
import {
  generateOtp,
  getInviteOtpState,
  getInviteSession,
  hashOtp,
  InviteOtpState,
  OTP_MAX_RESENDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  setInviteOtpState,
  verifyInviteToken,
} from "@/lib/invite/adminInvite";

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

    const now = Date.now();
    const existingState = await getInviteOtpState(payload.inviteId);
    if (existingState && existingState.cooldownUntil > now) {
      const waitSec = Math.ceil((existingState.cooldownUntil - now) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSec}s before requesting a new OTP.` },
        { status: 429 },
      );
    }
    if (existingState && existingState.resendCount >= OTP_MAX_RESENDS) {
      return NextResponse.json(
        { error: "OTP resend limit reached for this invite." },
        { status: 429 },
      );
    }

    const otp = generateOtp();
    const expiresAt = now + OTP_TTL_MINUTES * 60 * 1000;
    const state: InviteOtpState = {
      otpHash: hashOtp(otp),
      attempts: 0,
      resendCount: (existingState?.resendCount ?? 0) + 1,
      cooldownUntil: now + OTP_RESEND_COOLDOWN_SECONDS * 1000,
      expiresAt,
    };
    await setInviteOtpState(payload.inviteId, state);

    await sendAdminInviteOtpEmail({
      to: session.email,
      teamName: session.teamName,
      otp,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send OTP.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
