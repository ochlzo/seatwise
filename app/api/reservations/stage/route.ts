import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { sendReservationStatusUpdateEmail } from "@/lib/email/sendReservationStatusUpdateEmail";
import { prisma } from "@/lib/prisma";

type StageTargetStatus = "CONFIRMED" | "CANCELLED";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const formatScheduleLabel = (dateValue: Date, startValue: Date, endValue: Date) => {
  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateValue);
  const timeLabel = new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${dateLabel}, ${timeLabel.format(startValue)} - ${timeLabel.format(endValue)}`;
};

const normalizeIds = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      )
    : [];

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

    const body = (await request.json()) as {
      reservationIds?: unknown;
      targetStatus?: StageTargetStatus;
    };

    const reservationIds = normalizeIds(body.reservationIds);
    const targetStatus = body.targetStatus;

    if (reservationIds.length === 0) {
      return NextResponse.json({ error: "Missing reservationIds" }, { status: 400 });
    }

    if (targetStatus !== "CONFIRMED" && targetStatus !== "CANCELLED") {
      return NextResponse.json({ error: "Invalid targetStatus" }, { status: 400 });
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        reservation_id: { in: reservationIds },
      },
      include: {
        show: {
          select: {
            team_id: true,
            show_name: true,
          },
        },
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
                seat: {
                  select: { seat_number: true },
                },
              },
            },
          },
        },
      },
    });

    if (reservations.length !== reservationIds.length) {
      return NextResponse.json({ error: "One or more reservations were not found" }, { status: 404 });
    }

    const forbiddenReservation = reservations.find(
      (reservation) =>
        !adminContext.isSuperadmin && reservation.show.team_id !== adminContext.teamId,
    );
    if (forbiddenReservation) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invalidReservation = reservations.find((reservation) =>
      targetStatus === "CONFIRMED"
        ? reservation.status === "CONFIRMED"
        : reservation.status === "CANCELLED",
    );
    if (invalidReservation) {
      return NextResponse.json(
        {
          error:
            targetStatus === "CONFIRMED"
              ? "One or more reservations are already confirmed"
              : "One or more reservations are already rejected",
        },
        { status: 400 },
      );
    }

    const paymentUpdates = reservations
      .filter((reservation) => reservation.payment)
      .map((reservation) => ({
        paymentId: reservation.payment!.payment_id,
        status:
          targetStatus === "CONFIRMED"
            ? PaymentStatus.PAID
            : reservation.payment!.status === "PAID"
              ? PaymentStatus.REFUNDED
              : PaymentStatus.FAILED,
        paidAt:
          targetStatus === "CONFIRMED"
            ? new Date()
            : reservation.payment!.status === "PAID"
              ? reservation.payment!.paid_at
              : null,
      }));

    const seatAssignmentIds =
      targetStatus === "CANCELLED"
        ? reservations.flatMap((reservation) =>
            reservation.reservedSeats.map((row) => row.seat_assignment_id),
          )
        : [];

    await prisma.$transaction(async (tx) => {
      await tx.reservation.updateMany({
        where: { reservation_id: { in: reservationIds } },
        data: { status: targetStatus },
      });

      for (const paymentUpdate of paymentUpdates) {
        await tx.payment.update({
          where: { payment_id: paymentUpdate.paymentId },
          data: {
            status: paymentUpdate.status,
            paid_at: paymentUpdate.paidAt,
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

    const emailGroups = new Map<
      string,
      {
        to: string;
        customerName: string;
        lineItems: Array<{
          showName: string;
          scheduleLabel: string;
          seatNumbers: string[];
          amount: string;
        }>;
      }
    >();

    for (const reservation of reservations) {
      const key = reservation.email.trim().toLowerCase();
      const existing = emailGroups.get(key);
      const lineItem = {
        showName: reservation.show.show_name,
        scheduleLabel: formatScheduleLabel(
          reservation.sched.sched_date,
          reservation.sched.sched_start_time,
          reservation.sched.sched_end_time,
        ),
        seatNumbers: reservation.reservedSeats.map(
          (row) => row.seatAssignment.seat.seat_number,
        ),
        amount: formatCurrency(Number(reservation.payment?.amount ?? 0)),
      };

      if (!existing) {
        emailGroups.set(key, {
          to: reservation.email,
          customerName: `${reservation.first_name} ${reservation.last_name}`.trim(),
          lineItems: [lineItem],
        });
        continue;
      }

      existing.lineItems.push(lineItem);
    }

    const emailResults = await Promise.allSettled(
      Array.from(emailGroups.values()).map(async (group) => {
        await sendReservationStatusUpdateEmail({
          to: group.to,
          customerName: group.customerName,
          targetStatus,
          lineItems: group.lineItems,
        });
      }),
    );

    const emailFailures = emailResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    for (const failure of emailFailures) {
      console.error("[reservations/stage] Failed to send stage email:", failure.reason);
    }

    return NextResponse.json({
      success: true,
      reservationIds,
      newStatus: targetStatus,
      email: {
        attemptedCount: emailResults.length,
        sentCount: emailResults.length - emailFailures.length,
        failedCount: emailFailures.length,
        sent: emailFailures.length === 0,
      },
    });
  } catch (error) {
    console.error("[reservations/stage] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
