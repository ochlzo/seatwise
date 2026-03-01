import { NextRequest, NextResponse } from "next/server";
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      return NextResponse.json({ success: false, error: "Invalid email address." }, { status: 400 });
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

    const reservation = await prisma.$transaction(async (tx) => {
      const assignments = await tx.seatAssignment.findMany({
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
        throw new Error("Some selected seats are unavailable.");
      }

      const notOpen = assignments.find((item) => item.seat_status !== "OPEN");
      if (notOpen) {
        throw new Error(`Seat ${notOpen.seat.seat_number} is already reserved.`);
      }

      const totalAmount = assignments.reduce(
        (sum, item) => sum + Number(item.set.seatCategory.price),
        0,
      );

      const created = await tx.reservation.create({
        data: {
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
      });

      await tx.reservedSeat.createMany({
        data: assignments.map((item) => ({
          reservation_id: created.reservation_id,
          seat_assignment_id: item.seat_assignment_id,
        })),
      });

      await tx.seatAssignment.updateMany({
        where: { seat_assignment_id: { in: assignments.map((item) => item.seat_assignment_id) } },
        data: { seat_status: "RESERVED" },
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
        seatNumbers: assignments.map((item) => item.seat.seat_number),
        totalAmount,
      };
    });

    const promotion = await completeActiveSessionAndPromoteNext({
      showScopeId,
      session: validation.session,
    });

    let emailSent = true;
    try {
      await sendReservationSubmittedEmail({
        to: contact.email,
        customerName: `${contact.firstName} ${contact.lastName}`.trim(),
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
