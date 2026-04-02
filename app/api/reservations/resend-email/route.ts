import { NextRequest, NextResponse } from "next/server";

import { redis } from "@/lib/clients/redis";
import { sendReservationSubmittedEmail } from "@/lib/email/sendReservationSubmittedEmail";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 30;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const normalize = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const getCooldownKey = (showId: string, reservationNumber: string, email: string) =>
  `seatwise:reservation_email_resend:${showId}:${reservationNumber}:${email}`;

const getLockKey = (showId: string, reservationNumber: string, email: string) =>
  `seatwise:reservation_email_resend:lock:${showId}:${reservationNumber}:${email}`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      showId?: string;
      reservationNumber?: string;
      email?: string;
    };

    const showId = normalize(body.showId);
    const reservationNumber = normalize(body.reservationNumber);
    const email = normalize(body.email).toLowerCase();

    if (!showId || !reservationNumber || !email) {
      return NextResponse.json(
        { success: false, error: "Missing reservation details." },
        { status: 400 },
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address." },
        { status: 400 },
      );
    }

    const reservation = await prisma.reservation.findFirst({
      where: {
        show_id: showId,
        reservation_number: reservationNumber,
        email,
      },
      select: {
        first_name: true,
        last_name: true,
        reservation_number: true,
        show: {
          select: {
            show_name: true,
          },
        },
        sched: {
          select: {
            sched_date: true,
          },
        },
        payment: {
          select: {
            amount: true,
            screenshot_url: true,
          },
        },
        reservedSeats: {
          select: {
            seatAssignment: {
              select: {
                seat: {
                  select: {
                    seat_number: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { success: false, error: "Reservation not found." },
        { status: 404 },
      );
    }

    const cooldownKey = getCooldownKey(showId, reservationNumber, email);
    const now = Date.now();
    const existingCooldownRaw = (await redis.get(cooldownKey)) as string | number | null;
    const existingCooldown =
      typeof existingCooldownRaw === "string" || typeof existingCooldownRaw === "number"
        ? Number(existingCooldownRaw)
        : Number.NaN;

    if (Number.isFinite(existingCooldown) && existingCooldown > now) {
      const waitSeconds = Math.max(1, Math.ceil((existingCooldown - now) / 1000));
      return NextResponse.json(
        {
          success: false,
          error: `Please wait ${waitSeconds}s before requesting a new email.`,
          cooldownUntil: existingCooldown,
        },
        { status: 429 },
      );
    }

    const seatNumbers = reservation.reservedSeats
      .map((row) => row.seatAssignment?.seat?.seat_number)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    if (seatNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: "Reservation seats could not be loaded." },
        { status: 500 },
      );
    }

    const customerName = `${reservation.first_name} ${reservation.last_name}`.trim();
    const scheduleLabel = new Date(reservation.sched.sched_date).toLocaleDateString();
    const totalAmount = formatCurrency(Number(reservation.payment?.amount ?? 0));

    const lockKey = getLockKey(showId, reservationNumber, email);
    const lockSet = await redis.set(lockKey, String(now), {
      nx: true,
      ex: 15,
    });

    if (!lockSet) {
      return NextResponse.json(
        {
          success: false,
          error: "Request in progress. Please retry.",
        },
        { status: 429 },
      );
    }

    try {
      await sendReservationSubmittedEmail({
        to: email,
        customerName,
        reservationNumber: reservation.reservation_number,
        showName: reservation.show.show_name,
        scheduleLabel,
        seatNumbers,
        totalAmount,
        proofImageUrl: reservation.payment?.screenshot_url ?? null,
      });

      const cooldownUntil = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      await redis.set(cooldownKey, String(cooldownUntil), {
        ex: RESEND_COOLDOWN_SECONDS,
      });

      return NextResponse.json({
        success: true,
        cooldownUntil,
      });
    } finally {
      await redis.del(lockKey);
    }
  } catch (error) {
    console.error("[reservations/resend-email] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to resend reservation email." },
      { status: 500 },
    );
  }
}
