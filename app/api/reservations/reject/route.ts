import { after, NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { buildReservationStatusEmailGroups } from "@/lib/email/reservationStatusEmailPayload";
import { sendReservationStatusUpdateEmail } from "@/lib/email/sendReservationStatusUpdateEmail";
import { createRouteTimer, isRouteTimingEnabled } from "@/lib/server/timing";
import { syncScheduleCapacityStatuses } from "@/lib/shows/effectiveStatus";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

type RejectRequestBody = {
  reservationId?: string;
  reservationIds?: string[];
};

const getReservationIds = (body: RejectRequestBody) => {
  const ids = Array.isArray(body.reservationIds)
    ? body.reservationIds
    : body.reservationId
      ? [body.reservationId]
      : [];

  return ids
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
};

export async function POST(request: NextRequest) {
  const timer = createRouteTimer("/api/reservations/reject", {
    enabled: isRouteTimingEnabled(request),
  });

  try {
    let adminContext;
    try {
      adminContext = await timer.time("auth.get_admin_context", () =>
        getCurrentAdminContext(),
      );
    } catch (error) {
      if (error instanceof AdminContextError) {
        timer.flush({ status: error.status, error: error.message });
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      timer.flush({ status: 401, error: "Unauthorized" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as RejectRequestBody;
    const reservationIds = getReservationIds(body);

    if (reservationIds.length === 0) {
      return NextResponse.json({ error: "Missing reservationId" }, { status: 400 });
    }

    const reservations = await timer.time("postgres.load_reservations", () =>
      prisma.reservation.findMany({
        where: { reservation_id: { in: reservationIds } },
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
      }),
    );

    if (reservations.length !== reservationIds.length) {
      return NextResponse.json({ error: "One or more reservations were not found" }, { status: 404 });
    }

    for (const reservation of reservations) {
      if (!adminContext.isSuperadmin && reservation.show.team_id !== adminContext.teamId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (reservation.status === "CANCELLED") {
        return NextResponse.json(
          { error: "One or more reservations are already rejected" },
          { status: 400 },
        );
      }
    }

    const seatAssignmentIds = reservations.flatMap((reservation) =>
      reservation.reservedSeats.map((row) => row.seat_assignment_id),
    );
    const schedIds = Array.from(new Set(reservations.map((reservation) => reservation.sched_id)));

    await timer.time("postgres.reject_reservations", () =>
      prisma.$transaction(async (tx) => {
        for (const reservation of reservations) {
          await tx.reservation.update({
            where: { reservation_id: reservation.reservation_id },
            data: { status: "CANCELLED" },
          });

          if (reservation.payment) {
            await tx.payment.update({
              where: { payment_id: reservation.payment.payment_id },
              data: {
                status: reservation.payment.status === "PAID" ? "REFUNDED" : "FAILED",
                paid_at:
                  reservation.payment.status === "PAID"
                    ? reservation.payment.paid_at
                    : null,
              },
            });
          }
        }

        if (seatAssignmentIds.length > 0) {
          await tx.seatAssignment.updateMany({
            where: {
              seat_assignment_id: { in: seatAssignmentIds },
            },
            data: { seat_status: "OPEN" },
          });
          await syncScheduleCapacityStatuses(tx, schedIds);
        }
      }),
    );

    after(async () => {
      const emailGroups = buildReservationStatusEmailGroups(
        reservations.map((reservation) => ({
          ...reservation,
          reservation_number: reservation.reservation_number,
        })),
      );

      const results = await Promise.allSettled(
        emailGroups.map((emailGroup) =>
          sendReservationStatusUpdateEmail({
            to: emailGroup.to,
            customerName: emailGroup.customerName,
            targetStatus: "CANCELLED",
            lineItems: emailGroup.lineItems,
          }),
        ),
      );

      const failedCount = results.filter((result) => result.status === "rejected").length;
      if (failedCount > 0) {
        console.error("[reservations/reject] post-response email failures:", results);
      }
    });

    timer.flush({
      reservationCount: reservationIds.length,
      responseMode: "email_queued",
    });

    return NextResponse.json({
      success: true,
      reservationIds,
      newStatus: "CANCELLED",
    });
  } catch (error) {
    console.error("[reservations/reject] Error:", error);
    timer.flush({ error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
