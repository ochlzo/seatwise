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
        const user = await prisma.user.findUnique({
            where: { firebase_uid: decoded.uid },
            select: { role: true },
        });

        if (user?.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Fetch all reservations with related data
        const reservations = await prisma.reservation.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        user_id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                        avatar_key: true,
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
                                show: {
                                    select: {
                                        show_id: true,
                                        show_name: true,
                                        venue: true,
                                        show_image_key: true,
                                    },
                                },
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

        for (const reservation of reservations) {
            const show = reservation.seatAssignment.sched.show;
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
