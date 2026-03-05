import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";

// POST /api/reservations/verify — Admin-only: verify a reservation + payment
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
            return NextResponse.json(
                { error: "Missing reservationId" },
                { status: 400 },
            );
        }

        // Look up the reservation and its payment
        const reservation = await prisma.reservation.findUnique({
            where: { reservation_id: reservationId },
            include: {
                payment: true,
                show: { select: { team_id: true } },
            },
        });

        if (!reservation) {
            return NextResponse.json(
                { error: "Reservation not found" },
                { status: 404 },
            );
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

        // Update both Reservation.status → CONFIRMED and Payment.status → PAID atomically
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

