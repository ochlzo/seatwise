import { NextRequest, NextResponse } from "next/server";
import {
  clearReservationEmailOtpState,
  getReservationEmailOtpSession,
  getReservationEmailOtpState,
  setReservationEmailOtpSession,
  setReservationEmailOtpState,
  withReservationEmailOtpLock,
} from "@/lib/reservations/reservationEmailOtpStore";
import {
  normalizeReservationEmail,
  verifyReservationEmailOtpHash,
} from "@/lib/reservations/reservationEmailOtp";
import { validateActiveSession } from "@/lib/queue/validateActiveSession";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

const OTP_PEPPER = process.env.ADMIN_OTP_PEPPER ?? "";

if (!OTP_PEPPER) {
  throw new Error("ADMIN_OTP_PEPPER is not configured.");
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_MAX_ATTEMPTS = 5;
const INVITE_UNAVAILABLE_ERROR = "Reservation verification is unavailable.";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      showId?: string;
      schedId?: string;
      guestId?: string;
      ticketId?: string;
      activeToken?: string;
      email?: string;
      otp?: string;
    };

    const showId = body.showId?.trim();
    const schedId = body.schedId?.trim();
    const guestId = body.guestId?.trim();
    const ticketId = body.ticketId?.trim();
    const activeToken = body.activeToken?.trim();
    const otp = body.otp?.trim();
    const email = body.email ? normalizeReservationEmail(body.email) : "";

    if (!showId || !schedId || !guestId || !ticketId || !activeToken || !email || !otp) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const showScopeId = `${showId}:${schedId}`;
    const validation = await validateActiveSession({
      showScopeId,
      ticketId,
      userId: guestId,
      activeToken,
    });

    if (!validation.valid || !validation.session) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
    }

    const outcome = await withReservationEmailOtpLock(showScopeId, ticketId, async () => {
      const session = await getReservationEmailOtpSession(showScopeId, ticketId);
      const state = await getReservationEmailOtpState(showScopeId, ticketId);

      if (!session || !state) {
        return NextResponse.json(
          { error: "Verification code expired. Request a new code." },
          { status: 410 },
        );
      }

      if (session.email !== email || session.guestId !== guestId || session.activeToken !== activeToken) {
        return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
      }

      if (session.otpVerified) {
        return NextResponse.json({ success: true });
      }

      if (Date.now() >= state.expiresAt) {
        return NextResponse.json(
          { error: "Verification code expired. Request a new code." },
          { status: 410 },
        );
      }

      if (state.attempts >= OTP_MAX_ATTEMPTS) {
        return NextResponse.json(
          { error: "Verification attempts exceeded." },
          { status: 429 },
        );
      }

      if (!verifyReservationEmailOtpHash(otp, state.otpHash, OTP_PEPPER)) {
        await setReservationEmailOtpSession({
          ...session,
          otpVerified: false,
        });
        await setReservationEmailOtpState(showScopeId, ticketId, {
          ...state,
          attempts: state.attempts + 1,
        });
        return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
      }

      await setReservationEmailOtpSession({
        ...session,
        otpVerified: true,
      });
      await clearReservationEmailOtpState(showScopeId, ticketId);

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
    console.error("[queue/reservation-email-otp/verify] Error:", error);
    return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
  }
}
