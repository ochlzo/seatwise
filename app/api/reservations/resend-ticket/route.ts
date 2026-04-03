import { NextRequest, NextResponse } from "next/server";

import { redis } from "@/lib/clients/redis";
import { sendIssuedTicketEmail } from "@/lib/email/sendIssuedTicketEmail";
import { prisma } from "@/lib/prisma";
import { issueReservationTicket } from "@/lib/tickets/issueReservationTicket";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 30;

const normalize = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const getCooldownKey = (showId: string, reservationNumber: string, email: string) =>
  `seatwise:reservation_ticket_resend:${showId}:${reservationNumber}:${email}`;

const getLockKey = (showId: string, reservationNumber: string, email: string) =>
  `seatwise:reservation_ticket_resend:lock:${showId}:${reservationNumber}:${email}`;

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
        status: "CONFIRMED",
      },
      select: {
        reservation_id: true,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { success: false, error: "Issued ticket record not found." },
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

    const lockKey = getLockKey(showId, reservationNumber, email);
    const lockSet = await redis.set(lockKey, String(now), {
      nx: true,
      ex: 15,
    });

    if (!lockSet) {
      return NextResponse.json(
        { success: false, error: "Request in progress. Please retry." },
        { status: 429 },
      );
    }

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
        request.nextUrl.origin ||
        "http://localhost:3000";

      const issuedTicket = await issueReservationTicket({
        reservationId: reservation.reservation_id,
        baseUrl,
      });

      await sendIssuedTicketEmail({
        to: issuedTicket.email,
        customerName: issuedTicket.customerName,
        reservationNumber: issuedTicket.reservationNumber,
        showName: issuedTicket.showName,
        venue: issuedTicket.venue,
        scheduleLabel: issuedTicket.scheduleLabel,
        seatLabels: issuedTicket.seatLabels,
        ticketAttachments: issuedTicket.ticketPdfs.map((ticket) => ({
          filename: ticket.ticketPdfFilename,
          contentType: "application/pdf",
          content: ticket.ticketPdf,
        })),
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
    console.error("[reservations/resend-ticket] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to resend e-ticket." },
      { status: 500 },
    );
  }
}
