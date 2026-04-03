import { NextRequest, NextResponse } from "next/server";

import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalize = (value: unknown) => (typeof value === "string" ? value.trim() : "");

type ReservationEditRequestBody = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  address?: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> },
) {
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

    const { reservationId } = await params;
    const normalizedReservationId = normalize(reservationId);

    if (!normalizedReservationId) {
      return NextResponse.json({ error: "Missing reservation id." }, { status: 400 });
    }

    const body = (await request.json()) as ReservationEditRequestBody;
    const firstName = normalize(body.first_name);
    const lastName = normalize(body.last_name);
    const email = normalize(body.email).toLowerCase();
    const phoneNumber = normalize(body.phone_number);
    const address = normalize(body.address);

    if (!firstName || !lastName || !email || !phoneNumber || !address) {
      return NextResponse.json(
        { error: "All customer fields are required." },
        { status: 400 },
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { reservation_id: normalizedReservationId },
      select: {
        reservation_id: true,
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

    if (
      !adminContext.isSuperadmin &&
      reservation.show.team_id !== adminContext.teamId
    ) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const updatedReservation = await prisma.reservation.update({
      where: { reservation_id: reservation.reservation_id },
      data: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumber,
        address,
      },
      select: {
        reservation_id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        address: true,
        admin_nickname: true,
      },
    });

    return NextResponse.json({
      success: true,
      reservation: updatedReservation,
    });
  } catch (error) {
    console.error("[reservations/[reservationId]] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
