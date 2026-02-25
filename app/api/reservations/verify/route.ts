import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/firebaseAdmin";

// POST /api/reservations/verify — Admin-only: verify a reservation + payment
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Verify admin role
        const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
        const user = await prisma.user.findUnique({
            where: { firebase_uid: decoded.uid },
            select: { role: true },
        });

        if (user?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
            include: { payment: true },
        });

        if (!reservation) {
            return NextResponse.json(
                { error: "Reservation not found" },
                { status: 404 },
            );
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
