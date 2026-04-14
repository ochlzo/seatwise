import { NextRequest, NextResponse } from "next/server";

import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { issueReservationTicket } from "@/lib/tickets/issueReservationTicket";
import { resolveReservationTicketDownloadArtifact } from "@/lib/reservations/reservationTicketDownloads";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

const normalize = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function GET(request: NextRequest) {
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

    const reservationId = normalize(request.nextUrl.searchParams.get("reservationId"));
    const seatAssignmentId = normalize(request.nextUrl.searchParams.get("seatAssignmentId"));

    if (!reservationId) {
      return NextResponse.json({ error: "Missing reservation id." }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { reservation_id: reservationId },
      select: {
        reservation_id: true,
        status: true,
        show: {
          select: {
            team_id: true,
          },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
    }

    if (!adminContext.isSuperadmin && reservation.show.team_id !== adminContext.teamId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    if (reservation.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: "Only confirmed reservations can be issued a ticket." },
        { status: 409 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
      request.nextUrl.origin ||
      "http://localhost:3000";

    const issuedTicket = await issueReservationTicket({
      reservationId: reservation.reservation_id,
      baseUrl,
    });

    const artifact = resolveReservationTicketDownloadArtifact({
      reservationNumber: issuedTicket.reservationNumber,
      seatAssignmentId: seatAssignmentId || undefined,
      ticketPdfs: issuedTicket.ticketPdfs,
    });

    return new NextResponse(Buffer.from(artifact.body), {
      status: 200,
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Disposition": `attachment; filename="${artifact.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[reservations/download-tickets] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
