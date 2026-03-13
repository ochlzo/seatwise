import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateActiveSession } from "@/lib/queue/validateActiveSession";
import { completeActiveSessionAndPromoteNext } from "@/lib/queue/queueLifecycle";
import { sendReservationSubmittedEmail } from "@/lib/email/sendReservationSubmittedEmail";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const normalize = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PH_PHONE_REGEX = /^09\d{9}$/;
const RESERVATION_NUMBER_MAX_ATTEMPTS = 50;
const RESERVATION_TRANSACTION_TIMEOUT_MS = 15_000;

const generateReservationNumber = () =>
  Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0");

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      showId?: string;
      schedId?: string;
      guestId?: string;
      ticketId?: string;
      activeToken?: string;
      seatIds?: string[];
      screenshotUrl?: string;
      firstName?: string;
      lastName?: string;
      address?: string;
      email?: string;
      phoneNumber?: string;
    };

    const {
      showId,
      schedId,
      guestId,
      ticketId,
      activeToken,
      seatIds = [],
      screenshotUrl,
      firstName,
      lastName,
      address,
      email,
      phoneNumber,
    } = body;

    if (!showId || !schedId || !guestId || !ticketId || !activeToken) {
      return NextResponse.json(
        { success: false, error: "Missing queue session identifiers." },
        { status: 400 },
      );
    }

    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please select at least one seat." },
        { status: 400 },
      );
    }

    const contact = {
      firstName: normalize(firstName),
      lastName: normalize(lastName),
      address: normalize(address),
      email: normalize(email).toLowerCase(),
      phoneNumber: normalize(phoneNumber),
    };

    if (
      !contact.firstName ||
      !contact.lastName ||
      !contact.address ||
      !contact.email ||
      !contact.phoneNumber
    ) {
      return NextResponse.json(
        { success: false, error: "Complete contact details are required." },
        { status: 400 },
      );
    }

    if (!EMAIL_REGEX.test(contact.email)) {
      return NextResponse.json({ success: false, error: "Invalid email address." }, { status: 400 });
    }

    if (!PH_PHONE_REGEX.test(contact.phoneNumber)) {
      return NextResponse.json(
        { success: false, error: "Phone number must start with 09 and be 11 digits." },
        { status: 400 },
      );
    }

    const schedule = await prisma.sched.findFirst({
      where: { sched_id: schedId, show_id: showId },
      include: {
        show: { select: { show_name: true } },
      },
    });

    if (!schedule) {
      return NextResponse.json({ success: false, error: "Schedule not found" }, { status: 404 });
    }

    const showScopeId = `${showId}:${schedId}`;
    const validation = await validateActiveSession({
      showScopeId,
      ticketId,
      userId: guestId,
      activeToken,
    });

    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        { success: false, error: "Active session is invalid or expired", reason: validation.reason },
        { status: 400 },
      );
    }

    const assignments = await prisma.seatAssignment.findMany({
      where: {
        sched_id: schedId,
        seat_id: { in: seatIds },
      },
      include: {
        seat: { select: { seat_number: true } },
        set: {
          select: {
            seatCategory: { select: { price: true } },
          },
        },
      },
    });

    if (assignments.length !== seatIds.length) {
      return NextResponse.json(
        { success: false, error: "Some selected seats are unavailable." },
        { status: 400 },
      );
    }

    const seatAssignmentIds = assignments.map((item) => item.seat_assignment_id);
    const seatNumbers = assignments.map((item) => item.seat.seat_number);
    const totalAmount = assignments.reduce(
      (sum, item) => sum + Number(item.set.seatCategory.price),
      0,
    );

    let reservation:
      | {
          reservationId: string;
          reservationNumber: string;
          seatNumbers: string[];
          totalAmount: number;
        }
      | null = null;

    for (
      let attempt = 1;
      attempt <= RESERVATION_NUMBER_MAX_ATTEMPTS;
      attempt += 1
    ) {
      const reservationNumber = generateReservationNumber();

      try {
        reservation = await prisma.$transaction(async (tx) => {
          const reservedSeats = await tx.seatAssignment.updateMany({
            where: {
              seat_assignment_id: { in: seatAssignmentIds },
              seat_status: "OPEN",
            },
            data: { seat_status: "RESERVED" },
          });

          if (reservedSeats.count !== seatAssignmentIds.length) {
            throw new Error("One or more selected seats are already reserved.");
          }

          const created = (await tx.reservation.create({
            data: {
              reservation_number: reservationNumber,
              guest_id: guestId,
              show_id: showId,
              sched_id: schedId,
              first_name: contact.firstName,
              last_name: contact.lastName,
              address: contact.address,
              email: contact.email,
              phone_number: contact.phoneNumber,
              status: "PENDING",
            },
          } as any)) as { reservation_id: string; reservation_number: string };

          await tx.reservedSeat.createMany({
            data: seatAssignmentIds.map((seatAssignmentId) => ({
              reservation_id: created.reservation_id,
              seat_assignment_id: seatAssignmentId,
            })),
          });

          await tx.payment.create({
            data: {
              reservation_id: created.reservation_id,
              amount: totalAmount,
              method: "GCASH",
              status: "PENDING",
              screenshot_url: screenshotUrl || null,
            },
          });

          return {
            reservationId: created.reservation_id,
            reservationNumber: created.reservation_number,
            seatNumbers,
            totalAmount,
          };
        }, { timeout: RESERVATION_TRANSACTION_TIMEOUT_MS });
        break;
      } catch (error) {
        const isUniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002";

        const conflictTargets = isUniqueConflict
          ? Array.isArray(error.meta?.target)
            ? error.meta.target.map(String)
            : []
          : [];

        const isReservationNumberConflict =
          isUniqueConflict &&
          (conflictTargets.includes("Reservation_show_id_reservation_number_key") ||
            (conflictTargets.includes("show_id") &&
              conflictTargets.includes("reservation_number")));

        if (isReservationNumberConflict) {
          continue;
        }

        throw error;
      }
    }

    if (!reservation) {
      throw new Error(
        "Failed to generate a unique reservation number. Please try again.",
      );
    }

    const promotion = await completeActiveSessionAndPromoteNext({
      showScopeId,
      session: validation.session,
    });

    let emailSent = true;
    try {
      await sendReservationSubmittedEmail({
        to: contact.email,
        customerName: `${contact.firstName} ${contact.lastName}`.trim(),
        reservationNumber: reservation.reservationNumber,
        showName: schedule.show.show_name,
        scheduleLabel: new Date(schedule.sched_date).toLocaleDateString(),
        seatNumbers: reservation.seatNumbers,
        totalAmount: formatCurrency(reservation.totalAmount),
      });
    } catch (error) {
      emailSent = false;
      console.error("[queue/complete] failed to send email:", error);
    }

    return NextResponse.json({
      success: true,
      reservationId: reservation.reservationId,
      reservationNumber: reservation.reservationNumber,
      showScopeId,
      showName: schedule.show.show_name,
      reservedCount: reservation.seatNumbers.length,
      emailSent,
      promoted: promotion.promoted,
      next: promotion.activeSession
        ? {
            ticketId: promotion.activeSession.ticketId,
            activeToken: promotion.activeSession.activeToken,
            expiresAt: promotion.activeSession.expiresAt,
          }
        : null,
    });
  } catch (error) {
    console.error("[queue/complete] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
