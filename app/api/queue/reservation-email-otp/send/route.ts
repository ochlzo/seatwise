import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateActiveSession } from "@/lib/queue/validateActiveSession";
import {
  buildReservationEmailOtpState,
  generateReservationEmailOtp,
  hashReservationEmailOtp,
  normalizeReservationEmail,
  type ReservationEmailOtpSession,
  type ReservationEmailOtpState,
} from "@/lib/reservations/reservationEmailOtp";
import {
  clearReservationEmailOtpState,
  getReservationEmailOtpSession,
  getReservationEmailOtpState,
  setReservationEmailOtpSession,
  setReservationEmailOtpState,
  withReservationEmailOtpLock,
} from "@/lib/reservations/reservationEmailOtpStore";
import { sendReservationEmailOtpEmail } from "@/lib/email/sendReservationEmailOtpEmail";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

const OTP_PEPPER = process.env.ADMIN_OTP_PEPPER ?? "";

if (!OTP_PEPPER) {
  throw new Error("ADMIN_OTP_PEPPER is not configured.");
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_RESENDS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
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
    };

    const showId = body.showId?.trim();
    const schedId = body.schedId?.trim();
    const guestId = body.guestId?.trim();
    const ticketId = body.ticketId?.trim();
    const activeToken = body.activeToken?.trim();
    const email = body.email ? normalizeReservationEmail(body.email) : "";

    if (!showId || !schedId || !guestId || !ticketId || !activeToken || !email) {
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

    const activeSession = validation.session;
    if (!validation.valid || !activeSession) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
    }

    const schedule = await prisma.sched.findFirst({
      where: {
        sched_id: schedId,
        show_id: showId,
      },
      select: {
        show: {
          select: {
            show_name: true,
          },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 404 });
    }

    const now = Date.now();
    const response = await withReservationEmailOtpLock(showScopeId, ticketId, async () => {
      const existingSession = await getReservationEmailOtpSession(showScopeId, ticketId);
      const existingState = await getReservationEmailOtpState(showScopeId, ticketId);
      if (existingSession && existingSession.email === email && existingSession.otpVerified) {
        await clearReservationEmailOtpState(showScopeId, ticketId);
        return NextResponse.json({ success: true, verified: true });
      }

      if (
        existingState &&
        existingSession &&
        existingSession.email === email &&
        now < existingState.cooldownUntil
      ) {
        const waitSeconds = Math.max(1, Math.ceil((existingState.cooldownUntil - now) / 1000));
        return NextResponse.json(
          {
            error: `Please wait ${waitSeconds}s before requesting a new code.`,
            cooldownUntil: existingState.cooldownUntil,
          },
          { status: 429 },
        );
      }

      if (
        existingSession &&
        existingSession.email === email &&
        (existingState?.resendCount ?? 0) >= OTP_MAX_RESENDS
      ) {
        return NextResponse.json(
          { error: "OTP resend limit reached for this reservation." },
          { status: 429 },
        );
      }

      const otp = generateReservationEmailOtp();
      const expiresAt = activeSession.expiresAt ?? now + OTP_TTL_MINUTES * 60 * 1000;
      const session: ReservationEmailOtpSession = {
        showScopeId,
        ticketId,
        guestId,
        activeToken,
        email,
        otpVerified: false,
        expiresAt,
      };
      const state: ReservationEmailOtpState = buildReservationEmailOtpState({
        otpHash: hashReservationEmailOtp(otp, OTP_PEPPER),
        now,
        ttlMinutes: OTP_TTL_MINUTES,
        cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
        existingState:
          existingSession && existingSession.email === email ? existingState : null,
      });

      await setReservationEmailOtpSession(session);
      await setReservationEmailOtpState(showScopeId, ticketId, state);
      await sendReservationEmailOtpEmail({
        to: email,
        showName: schedule.show.show_name,
        otp,
      });

      return NextResponse.json({
        success: true,
        cooldownUntil: state.cooldownUntil,
        expiresAt: state.expiresAt,
      });
    });

    if (!response) {
      return NextResponse.json(
        { error: "Request in progress. Please retry." },
        { status: 429 },
      );
    }

    return response;
  } catch (error) {
    console.error("[queue/reservation-email-otp/send] Error:", error);
    return NextResponse.json({ error: INVITE_UNAVAILABLE_ERROR }, { status: 400 });
  }
}
