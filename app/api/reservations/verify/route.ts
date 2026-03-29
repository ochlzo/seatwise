import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { sendIssuedTicketEmail } from "@/lib/email/sendIssuedTicketEmail";
import { issueReservationTicket } from "@/lib/tickets/issueReservationTicket";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

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

    const paidAt = new Date();
    try {
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
              paid_at: paidAt,
            },
          });
        }
      });

      const issuedTicket = await issueReservationTicket({
        reservationId,
        baseUrl:
          process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
          request.nextUrl.origin ||
          "http://localhost:3000",
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Ticket delivery failed.";
      console.error("[reservations/verify] failed to complete approval flow:", error);

      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { reservation_id: reservationId },
          data: {
            status: "PENDING",
            ticket_template_version_id: null,
            ticket_issued_at: null,
            ticket_delivery_error: errorMessage,
          },
        });

        if (reservation.payment) {
          await tx.payment.update({
            where: { payment_id: reservation.payment.payment_id },
            data: {
              status: "PENDING",
              paid_at: null,
            },
          });
        }
      });

      return NextResponse.json(
        {
          success: false,
          error:
            "Payment approval was reverted because the ticket could not be completed or emailed.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      reservationId,
      newStatus: "CONFIRMED",
      email: {
        attemptedCount: 1,
        sentCount: 1,
        failedCount: 0,
        sent: true,
      },
    });
  } catch (error) {
    console.error("[reservations/verify] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
