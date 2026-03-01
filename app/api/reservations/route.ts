import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/firebaseAdmin";

// GET /api/reservations — Admin-only: fetch all reservations grouped by show
export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        if (!sessionCookie) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
        const admin = await prisma.admin.findUnique({
            where: { firebase_uid: decoded.uid },
            select: { user_id: true },
        });

        if (!admin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Fetch all reservations with related data
        const reservations = await prisma.reservation.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                show: {
                    select: {
                        show_id: true,
                        show_name: true,
                        venue: true,
                        show_image_key: true,
                    },
                },
                payment: {
                    select: {
                        payment_id: true,
                        amount: true,
                        method: true,
                        status: true,
                        reference_no: true,
                        screenshot_url: true,
                        paid_at: true,
                        createdAt: true,
                    },
                },
                reservedSeats: {
                    select: {
                        seatAssignment: {
                            select: {
                                seat_assignment_id: true,
                                seat: {
                                    select: { seat_number: true },
                                },
                                sched: {
                                    select: {
                                        sched_id: true,
                                        sched_date: true,
                                        sched_start_time: true,
                                        sched_end_time: true,
                                    },
                                },
                                set: {
                                    select: {
                                        seatCategory: {
                                            select: {
                                                category_name: true,
                                                price: true,
                                                color_code: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Group by show
        const showMap = new Map<
            string,
            {
                showId: string;
                showName: string;
                venue: string;
                showImageKey: string | null;
                reservations: typeof reservations;
            }
        >();

        const normalizedReservations = reservations
            .map((reservation) => {
                const primarySeat = reservation.reservedSeats[0]?.seatAssignment;
                if (!primarySeat) return null;
                return {
                    ...reservation,
                    seatAssignment: primarySeat,
                };
            })
            .filter((reservation): reservation is NonNullable<typeof reservation> => !!reservation);

        for (const reservation of normalizedReservations) {
            const show = reservation.show;
            if (!showMap.has(show.show_id)) {
                showMap.set(show.show_id, {
                    showId: show.show_id,
                    showName: show.show_name,
                    venue: show.venue,
                    showImageKey: show.show_image_key,
                    reservations: [],
                });
            }
            showMap.get(show.show_id)!.reservations.push(reservation);
        }

        const grouped = Array.from(showMap.values());

        return NextResponse.json({ success: true, shows: grouped });
    } catch (error) {
        console.error("[reservations] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 },
        );
    }
}

