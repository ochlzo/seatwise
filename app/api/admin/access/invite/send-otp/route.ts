import { NextRequest, NextResponse } from "next/server";
import { sendAdminInviteOtpEmail } from "@/lib/email/sendAdminInviteOtpEmail";
import {
  doesInviteMatchSession,
  generateOtp,
  getInviteOtpState,
  getInviteSession,
  hashOtp,
  INVITE_CLAIM_COOKIE,
  InviteOtpState,
  OTP_MAX_RESENDS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  setInviteOtpState,
  verifyInviteToken,
  parseInviteClaimCookie,
  inviteClaimKey,
  withInviteOtpLock,
} from "@/lib/invite/adminInvite";
import { redis } from "@/lib/clients/redis";

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
    if (!doesInviteMatchSession(payload, session)) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
    }

    const claimCookie = parseInviteClaimCookie(request.cookies.get(INVITE_CLAIM_COOKIE)?.value);
    if (!claimCookie || claimCookie.inviteId !== payload.inviteId) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 403 });
    }
    const currentClaim = await redis.get(inviteClaimKey(payload.inviteId));
    if (typeof currentClaim !== "string" || currentClaim !== claimCookie.claimId) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 403 });
    }

    const now = Date.now();
    const outcome = await withInviteOtpLock(payload.inviteId, async () => {
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
        teamName: session.teamName ?? "Seatwise",
        otp,
      });

      return NextResponse.json({ success: true });
    });

    if (!outcome) {
      return NextResponse.json(
        { error: "Request in progress. Please retry." },
        { status: 429 },
      );
    }
    return outcome;
  } catch (error) {
    return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
  }
}
