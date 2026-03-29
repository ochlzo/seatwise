import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { buildReservationStatusEmailGroups } from "@/lib/email/reservationStatusEmailPayload";
import { sendReservationStatusUpdateEmail } from "@/lib/email/sendReservationStatusUpdateEmail";
import { syncScheduleCapacityStatuses } from "@/lib/shows/effectiveStatus";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

// POST /api/reservations/reject - Admin-only: reject a reservation and release seats
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
        show: { select: { team_id: true, show_name: true, venue: true } },
        sched: {
          select: {
            sched_date: true,
            sched_start_time: true,
            sched_end_time: true,
          },
        },
        payment: true,
        reservedSeats: {
          select: {
            seat_assignment_id: true,
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

    if (reservation.status === "CANCELLED") {
      return NextResponse.json({ error: "Reservation is already rejected" }, { status: 400 });
    }

    const seatAssignmentIds = reservation.reservedSeats.map(
      (row) => row.seat_assignment_id,
    );

    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { reservation_id: reservationId },
        data: { status: "CANCELLED" },
      });

      if (reservation.payment) {
        await tx.payment.update({
          where: { payment_id: reservation.payment.payment_id },
          data: {
            status: reservation.payment.status === "PAID" ? "REFUNDED" : "FAILED",
            paid_at:
              reservation.payment.status === "PAID" ? reservation.payment.paid_at : null,
          },
        });
      }

      if (seatAssignmentIds.length > 0) {
        await tx.seatAssignment.updateMany({
          where: {
            seat_assignment_id: { in: seatAssignmentIds },
          },
          data: { seat_status: "OPEN" },
        });
        await syncScheduleCapacityStatuses(tx, [reservation.sched_id]);
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
        targetStatus: "CANCELLED",
        lineItems: emailGroup.lineItems,
      });
    }

    return NextResponse.json({
      success: true,
      reservationId,
      newStatus: "CANCELLED",
    });
  } catch (error) {
    console.error("[reservations/reject] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
