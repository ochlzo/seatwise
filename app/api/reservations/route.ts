import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";

// GET /api/reservations — Admin-only: fetch all reservations grouped by show
export async function GET() {
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

        const where = adminContext.isSuperadmin
            ? undefined
            : { show: { team_id: adminContext.teamId ?? "__NO_TEAM__" } };

        // Fetch all reservations with related data
        const reservations = await prisma.reservation.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                show: {
                    select: {
                        show_id: true,
                        show_name: true,
                        venue: true,
                        show_image_key: true,
                        team_id: true,
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
                teamId: string | null;
                reservations: typeof reservations;
            }
        >();

        const normalizedReservations = reservations
            .map((reservation) => {
                const seatAssignments = reservation.reservedSeats
                    .map((row) => row.seatAssignment)
                    .filter(Boolean);

                if (seatAssignments.length === 0) return null;

                return {
                    ...reservation,
                    seatAssignments,
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
                    teamId: show.team_id ?? null,
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

