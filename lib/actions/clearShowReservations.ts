"use server";

import "server-only";

import { revalidatePath } from "next/cache";

import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { prisma } from "@/lib/prisma";
import { syncScheduleCapacityStatuses } from "@/lib/shows/effectiveStatus";

export async function clearShowReservationsAction(showId: string) {
  try {
    const adminContext = await getCurrentAdminContext();
    if (!adminContext.isSuperadmin) {
      throw new Error("Forbidden: only superadmins can clear reservation records.");
    }

    const show = await prisma.show.findUnique({
      where: { show_id: showId },
      select: {
        show_id: true,
        scheds: {
          select: { sched_id: true },
        },
      },
    });

    if (!show) {
      return { success: false, error: "Show not found." };
    }

    const schedIds = show.scheds.map((sched) => sched.sched_id);

    await prisma.$transaction(async (tx) => {
      await tx.reservedSeat.deleteMany({
        where: {
          reservation: { show_id: showId },
        },
      });

      await tx.payment.deleteMany({
        where: {
          reservation: { show_id: showId },
        },
      });

      await tx.reservation.deleteMany({
        where: { show_id: showId },
      });

      await tx.seatAssignment.updateMany({
        where: {
          sched: { show_id: showId },
        },
        data: {
          seat_status: "OPEN",
        },
      });

      await syncScheduleCapacityStatuses(tx, schedIds);
    });

    revalidatePath("/admin/shows");
    revalidatePath(`/admin/shows/${showId}`);

    return { success: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to clear reservation records.";
    return { success: false, error: message };
  }
}
