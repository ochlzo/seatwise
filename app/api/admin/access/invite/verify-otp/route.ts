import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/clients/redis";
import {
  getInviteOtpState,
  getInviteSession,
  hashOtp,
  INVITE_CLAIM_COOKIE,
  inviteClaimKey,
  inviteOtpKey,
  OTP_MAX_ATTEMPTS,
  parseInviteClaimCookie,
  setInviteOtpState,
  setInviteSession,
  verifyInviteToken,
  withInviteOtpLock,
} from "@/lib/invite/adminInvite";
import crypto from "crypto";

const INVITE_UNAVAILABLE_ERROR = "Invite link is invalid or unavailable.";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string; otp?: string };
    const token = body.token?.trim();
    const otp = body.otp?.trim();
    if (!token || !otp) {
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

    const claimCookie = parseInviteClaimCookie(request.cookies.get(INVITE_CLAIM_COOKIE)?.value);
    if (!claimCookie || claimCookie.inviteId !== payload.inviteId) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 403 });
    }
    const currentClaim = await redis.get(inviteClaimKey(payload.inviteId));
    if (typeof currentClaim !== "string" || currentClaim !== claimCookie.claimId) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 403 });
    }

    const outcome = await withInviteOtpLock(payload.inviteId, async () => {
      const state = await getInviteOtpState(payload.inviteId);
      if (!state || Date.now() >= state.expiresAt) {
        return NextResponse.json({ error: "Verification code expired. Request a new code." }, { status: 410 });
      }

      if (state.attempts >= OTP_MAX_ATTEMPTS) {
        return NextResponse.json({ error: "Verification attempts exceeded." }, { status: 429 });
      }

      const hashed = hashOtp(otp);
      const hashedBuffer = Buffer.from(hashed, "utf8");
      const storedBuffer = Buffer.from(state.otpHash, "utf8");
      const isMatch =
        hashedBuffer.length === storedBuffer.length &&
        crypto.timingSafeEqual(hashedBuffer, storedBuffer);
      if (!isMatch) {
        const nextState = { ...state, attempts: state.attempts + 1 };
        await setInviteOtpState(payload.inviteId, nextState);
        return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
      }

      await redis.del(inviteOtpKey(payload.inviteId));
      await setInviteSession({
        ...session,
        otpVerified: true,
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
