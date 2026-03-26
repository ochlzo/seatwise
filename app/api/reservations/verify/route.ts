import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { buildReservationStatusEmailGroups } from "@/lib/email/reservationStatusEmailPayload";
import { sendReservationStatusUpdateEmail } from "@/lib/email/sendReservationStatusUpdateEmail";

// POST /api/reservations/verify - Admin-only: verify a reservation + payment
export async function POST(request: NextRequest) {
  try {
    let adminContext;
    try {
      adminContext = await getCurrentAdminContext();
    } catch (error) {
      if (error instanceof AdminContextError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { reservationId } = body as { reservationId?: string };

    if (!reservationId) {
      return NextResponse.json({ error: "Missing reservationId" }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { reservation_id: reservationId },
      include: {
        payment: true,
        show: { select: { team_id: true, show_name: true, venue: true } },
        sched: {
          select: {
            sched_date: true,
            sched_start_time: true,
            sched_end_time: true,
          },
        },
        reservedSeats: {
          select: {
            seatAssignment: {
              select: {
                seat: { select: { seat_number: true } },
              },
            },
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (
      !adminContext.isSuperadmin &&
      reservation.show.team_id !== adminContext.teamId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (reservation.status === "CONFIRMED") {
      return NextResponse.json(
        { error: "Reservation is already confirmed" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { reservation_id: reservationId },
        data: { status: "CONFIRMED" },
      });

      if (reservation.payment) {
        await tx.payment.update({
          where: { payment_id: reservation.payment.payment_id },
          data: {
            status: "PAID",
            paid_at: new Date(),
          },
        });
      }
    });

    const [emailGroup] = buildReservationStatusEmailGroups([
      {
        ...reservation,
        reservation_number: (reservation as { reservation_number: string })
          .reservation_number,
      },
    ]);

    if (emailGroup) {
      await sendReservationStatusUpdateEmail({
        to: emailGroup.to,
        customerName: emailGroup.customerName,
        targetStatus: "CONFIRMED",
        lineItems: emailGroup.lineItems,
      });
    }

    return NextResponse.json({
      success: true,
      reservationId,
      newStatus: "CONFIRMED",
    });
  } catch (error) {
    console.error("[reservations/verify] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
