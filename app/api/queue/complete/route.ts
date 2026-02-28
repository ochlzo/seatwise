import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { validateActiveSession } from "@/lib/queue/validateActiveSession";
import { completeActiveSessionAndPromoteNext } from "@/lib/queue/queueLifecycle";

export async function POST(request: NextRequest) {
  try {
    const { adminAuth } = await import("@/lib/firebaseAdmin");
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const user = await prisma.user.findUnique({
      where: { firebase_uid: decodedToken.uid },
      select: { user_id: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { showId, schedId, ticketId, activeToken, seatIds, screenshotUrl } = body as {
      showId?: string;
      schedId?: string;
      ticketId?: string;
      activeToken?: string;
      seatIds?: string[];
      screenshotUrl?: string;
    };

    if (!showId || !schedId || !ticketId || !activeToken) {
      return NextResponse.json(
        { success: false, error: "Missing showId, schedId, ticketId, or activeToken" },
        { status: 400 },
      );
    }

    const schedule = await prisma.sched.findFirst({
      where: { sched_id: schedId, show_id: showId },
      include: {
        show: { select: { show_name: true, show_status: true } },
      },
    });

    if (!schedule) {
      return NextResponse.json({ success: false, error: "Schedule not found" }, { status: 404 });
    }

    const showScopeId = `${showId}:${schedId}`;
    const validation = await validateActiveSession({
      showScopeId,
      ticketId,
      userId: user.user_id,
      activeToken,
    });

    if (!validation.valid || !validation.session) {
      return NextResponse.json(
        { success: false, error: "Active session is invalid or expired", reason: validation.reason },
        { status: 400 },
      );
    }

    // ─── Persist Seat Reservations ─────────────────────────────────────────────
    let reservedCount = 0;

    if (seatIds && seatIds.length > 0) {
      // Step 1: Find existing SeatAssignment rows for these seats on this schedule
      const existingAssignments = await prisma.seatAssignment.findMany({
        where: { seat_id: { in: seatIds }, sched_id: schedId },
        select: { seat_assignment_id: true, seat_id: true, seat_status: true },
      });

      const existingBySeatId = new Map(existingAssignments.map((a) => [a.seat_id, a]));
      const missingSeatIds = seatIds.filter((id) => !existingBySeatId.has(id));

      console.log(`[queue/complete] seatIds:`, seatIds);
      console.log(`[queue/complete] existing SeatAssignments:`, existingAssignments.length, `| missing:`, missingSeatIds.length);

      // Step 2: For seats with no SeatAssignment, look up the correct Set row
      // server-side (from DB) so we don't rely on client-supplied category info.
      if (missingSeatIds.length > 0) {
        // Fetch the Set rows for this schedule (each Set binds sched_id + seat_category_id)
        const setRows = await prisma.set.findMany({
          where: { sched_id: schedId },
          select: { set_id: true, seat_category_id: true },
        });

        // Fetch SeatCategory assignments for the seatmap to find which category each seat belongs to.
        // SeatCategory is linked to the seatmap. We need the CategorySetItems that connect
        // a CategorySet → SeatCategory, and the schedule's CategorySet.
        const schedWithSet = await prisma.sched.findUnique({
          where: { sched_id: schedId },
          select: {
            category_set_id: true,
            categorySet: {
              select: {
                items: {
                  select: { seat_category_id: true },
                },
              },
            },
          },
        });

        // Build a lookup: seat_category_id → set_id (for this schedule)
        const setIdByCategory = new Map(setRows.map((s) => [s.seat_category_id, s.set_id]));

        // Get the valid category IDs for this schedule's category set
        const validCategoryIds = new Set(
          schedWithSet?.categorySet?.items.map((i) => i.seat_category_id) ?? [],
        );

        // For each missing seat, find what category it belongs to via SeatAssignment
        // of OTHER schedules using the same seatmap, OR just use the first available Set
        // for this schedule.
        if (setRows.length > 0) {
          // Try to find existing SeatAssignment for these seats on ANY schedule
          // to determine their category, then use the matching Set for THIS schedule.
          const referenceAssignments = await prisma.seatAssignment.findMany({
            where: { seat_id: { in: missingSeatIds } },
            select: {
              seat_id: true,
              set: { select: { seat_category_id: true } },
            },
            distinct: ["seat_id"],
          });

          const categoryBySeatId = new Map(
            referenceAssignments.map((a) => [a.seat_id, a.set.seat_category_id]),
          );

          // Fall back: if no existing SeatAssignment for these seats at all,
          // use the first Set of this schedule.
          const fallbackSetId = setRows[0]?.set_id;
          const fallbackCategoryId = setRows[0]?.seat_category_id;

          const newAssignmentData: { seat_id: string; sched_id: string; set_id: string }[] = [];

          for (const seatId of missingSeatIds) {
            let categoryId = categoryBySeatId.get(seatId);

            // If this category doesn't belong to this schedule's category set, use fallback
            if (categoryId && !validCategoryIds.has(categoryId)) {
              categoryId = undefined;
            }

            const setId = categoryId
              ? (setIdByCategory.get(categoryId) ?? fallbackSetId)
              : fallbackSetId;

            if (!setId) {
              console.warn(`[queue/complete] No Set row for sched ${schedId}. Cannot create SeatAssignment for seat ${seatId}.`);
              continue;
            }

            newAssignmentData.push({ seat_id: seatId, sched_id: schedId, set_id: setId });
            console.log(`[queue/complete] Will create SeatAssignment for seat ${seatId} → set ${setId} (category: ${categoryId ?? fallbackCategoryId})`);
          }

          if (newAssignmentData.length > 0) {
            await prisma.seatAssignment.createMany({
              data: newAssignmentData,
              skipDuplicates: true,
            });

            // Re-fetch the newly created rows to get their IDs
            const newRows = await prisma.seatAssignment.findMany({
              where: {
                seat_id: { in: newAssignmentData.map((d) => d.seat_id) },
                sched_id: schedId,
              },
              select: { seat_assignment_id: true, seat_id: true, seat_status: true },
            });

            for (const row of newRows) {
              existingBySeatId.set(row.seat_id, row);
            }

            console.log(`[queue/complete] Created ${newRows.length} new SeatAssignment rows.`);
          }
        } else {
          console.warn(`[queue/complete] No Set rows found for sched ${schedId}. Cannot create SeatAssignments for seats:`, missingSeatIds);
        }
      }

      // Step 3: Process OPEN assignments — create Reservation + flip to RESERVED atomically
      const openAssignments = seatIds
        .map((id) => existingBySeatId.get(id))
        .filter((a): a is NonNullable<typeof a> => !!a && a.seat_status === "OPEN");

      console.log(`[queue/complete] Open assignments to reserve:`, openAssignments.length);

      if (openAssignments.length > 0) {
        const openIds = openAssignments.map((a) => a.seat_assignment_id);

        await prisma.$transaction(async (tx) => {
          // Create each Reservation individually so we capture the generated IDs
          const createdReservations = await Promise.all(
            openIds.map((seat_assignment_id) =>
              tx.reservation.create({
                data: {
                  user_id: user.user_id,
                  show_id: showId,
                  sched_id: schedId,
                  status: "PENDING",
                },
                select: { reservation_id: true },
              }),
            ),
          );

          // Flip seat status to RESERVED
          await tx.seatAssignment.updateMany({
            where: { seat_assignment_id: { in: openIds } },
            data: { seat_status: "RESERVED" },
          });

          // Create a ReservedSeat record linking each Reservation ↔ SeatAssignment
          await tx.reservedSeat.createMany({
            data: createdReservations.map(({ reservation_id }, index) => ({
              reservation_id,
              seat_assignment_id: openIds[index],
            })),
            skipDuplicates: true,
          });

          // Create Payment records for each reservation (GCash with screenshot)
          if (screenshotUrl) {
            // Look up seat category prices to compute amount per reservation
            const seatAssignmentDetails = await tx.seatAssignment.findMany({
              where: { seat_assignment_id: { in: openIds } },
              select: {
                seat_assignment_id: true,
                set: {
                  select: {
                    seatCategory: {
                      select: { price: true },
                    },
                  },
                },
              },
            });

            const priceByAssignment = new Map(
              seatAssignmentDetails.map((sa) => [
                sa.seat_assignment_id,
                sa.set.seatCategory.price,
              ]),
            );

            await Promise.all(
              createdReservations.map(({ reservation_id }, index) => {
                const seat_assignment_id = openIds[index];
                const amount = priceByAssignment.get(seat_assignment_id) ?? 0;
                return tx.payment.create({
                  data: {
                    reservation_id,
                    amount,
                    method: "GCASH",
                    status: "PENDING",
                    screenshot_url: screenshotUrl,
                  },
                });
              }),
            );

            console.log(
              `[queue/complete] Created ${createdReservations.length} Payment record(s) with GCash screenshot.`,
            );
          }
        });

        reservedCount = openIds.length;
        console.log(`[queue/complete] ✅ Reserved ${reservedCount} seat(s).`);
      } else {
        console.warn(`[queue/complete] No OPEN SeatAssignments found for seats:`, seatIds);
      }
    }
    // ─── End Seat Reservation ──────────────────────────────────────────────────

    const promotion = await completeActiveSessionAndPromoteNext({
      showScopeId,
      session: validation.session,
    });

    return NextResponse.json({
      success: true,
      showScopeId,
      showName: schedule.show.show_name,
      reservedCount,
      promoted: promotion.promoted,
      next: promotion.activeSession
        ? {
          ticketId: promotion.activeSession.ticketId,
          activeToken: promotion.activeSession.activeToken,
          expiresAt: promotion.activeSession.expiresAt,
        }
        : null,
    });
  } catch (error) {
    console.error("[queue/complete] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
