import { after, NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { sendIssuedTicketEmail } from "@/lib/email/sendIssuedTicketEmail";
import { createRouteTimer, isRouteTimingEnabled } from "@/lib/server/timing";
import { issueReservationTicket } from "@/lib/tickets/issueReservationTicket";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

type VerifyRequestBody = {
  reservationId?: string;
  reservationIds?: string[];
};

const getReservationIds = (body: VerifyRequestBody) => {
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
  const timer = createRouteTimer("/api/reservations/verify", {
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

    const body = (await request.json()) as VerifyRequestBody;
    const reservationIds = getReservationIds(body);

    if (reservationIds.length === 0) {
      return NextResponse.json({ error: "Missing reservationId" }, { status: 400 });
    }

    const reservations = await timer.time("postgres.load_reservations", () =>
      prisma.reservation.findMany({
        where: { reservation_id: { in: reservationIds } },
        include: {
          payment: true,
          show: { select: { team_id: true } },
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

      if (reservation.status === "CONFIRMED") {
        return NextResponse.json(
          { error: "One or more reservations are already confirmed" },
          { status: 400 },
        );
      }
    }

    const paidAt = new Date();
    await timer.time("postgres.confirm_reservations", () =>
      prisma.$transaction(async (tx) => {
        for (const reservation of reservations) {
          await tx.reservation.update({
            where: { reservation_id: reservation.reservation_id },
            data: {
              status: "CONFIRMED",
              ticket_delivery_error: null,
            },
          });

          if (reservation.payment) {
            await tx.payment.update({
              where: { payment_id: reservation.payment.payment_id },
              data: {
                status: "PAID",
                paid_at: paidAt,
              },
            });
          }
        }
      }),
    );

    after(async () => {
      const followUpTimer = createRouteTimer("/api/reservations/verify:after", {
        enabled: isRouteTimingEnabled(request),
        context: { reservationCount: reservationIds.length },
      });

      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
        request.nextUrl.origin ||
        "http://localhost:3000";

      const results = await Promise.allSettled(
        reservationIds.map(async (reservationId) => {
          const issuedTicket = await followUpTimer.time("ticket.issue", () =>
            issueReservationTicket({
              reservationId,
              baseUrl,
            }),
          );

          await followUpTimer.time("email.send_issued_ticket", () =>
            sendIssuedTicketEmail({
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
            }),
          );
        }),
      );

      const failures = results
        .map((result, index) => ({ result, reservationId: reservationIds[index] }))
        .filter(
          (
            item,
          ): item is {
            result: PromiseRejectedResult;
            reservationId: string;
          } => item.result.status === "rejected",
        );

      await Promise.all(
        failures.map(({ reservationId, result }) =>
          prisma.reservation.update({
            where: { reservation_id: reservationId },
            data: {
              ticket_delivery_error:
                result.reason instanceof Error
                  ? result.reason.message
                  : "Ticket delivery failed.",
            },
          }),
        ),
      ).catch((error) => {
        console.error(
          "[reservations/verify] failed to persist post-response delivery error:",
          error,
        );
      });

      if (failures.length > 0) {
        console.error("[reservations/verify] post-response delivery failures:", failures);
      }

      followUpTimer.flush({
        deliveredCount: reservationIds.length - failures.length,
        failedCount: failures.length,
      });
    });

    timer.flush({
      reservationCount: reservationIds.length,
      responseMode: "delivery_queued",
    });

    return NextResponse.json({
      success: true,
      reservationIds,
      newStatus: "CONFIRMED",
      email: {
        attemptedCount: reservationIds.length,
        sentCount: 0,
        failedCount: 0,
        sent: false,
        queued: true,
      },
    });
  } catch (error) {
    console.error("[reservations/verify] Error:", error);
    timer.flush({ error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
