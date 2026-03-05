import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";

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
        show: { select: { team_id: true } },
        payment: true,
        reservedSeats: {
          select: { seat_assignment_id: true },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (!adminContext.isSuperadmin && reservation.show.team_id !== adminContext.teamId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (reservation.status === "CANCELLED") {
      return NextResponse.json({ error: "Reservation is already rejected" }, { status: 400 });
    }

    const seatAssignmentIds = reservation.reservedSeats.map((row) => row.seat_assignment_id);

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
            paid_at: reservation.payment.status === "PAID" ? reservation.payment.paid_at : null,
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
      }
    });

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
