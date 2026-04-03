import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

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

    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = Math.min(
      parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * pageSize;

    const where = adminContext.isSuperadmin
      ? undefined
      : { show: { team_id: adminContext.teamId ?? "__NO_TEAM__" } };

    const [total, reservations] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          reservation_id: true,
          reservation_number: true,
          guest_id: true,
          admin_nickname: true,
          first_name: true,
          last_name: true,
          address: true,
          email: true,
          phone_number: true,
          status: true,
          createdAt: true,
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
      }),
    ]);

    const showMap = new Map<
      string,
      {
        showId: string;
        showName: string;
        venue: string;
        showImageKey: string | null;
        teamId: string | null;
        reservations: Array<
          (typeof reservations)[number] & {
            seatAssignments: NonNullable<(typeof reservations)[number]["reservedSeats"][number]["seatAssignment"]>[];
          }
        >;
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

    return NextResponse.json({
      success: true,
      shows: Array.from(showMap.values()),
      page,
      pageSize,
      total,
      hasMore: skip + reservations.length < total,
    });
  } catch (error) {
    console.error("[reservations] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
