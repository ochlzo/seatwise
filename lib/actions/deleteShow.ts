"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { closeQueueChannel } from "@/lib/queue/closeQueue";

export async function deleteShowAction(showId: string) {
  try {
    const adminContext = await getCurrentAdminContext();
    if (!adminContext.isSuperadmin) {
      throw new Error("Forbidden: only superadmins can delete shows.");
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

    // Best-effort queue cleanup before data deletion.
    const queueScopes = show.scheds.map((sched) => `${showId}:${sched.sched_id}`);
    await Promise.allSettled(
      queueScopes.map(async (scopeId) =>
        closeQueueChannel(scopeId, "cancelled"),
      ),
    );

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

      await tx.seatAssignment.deleteMany({
        where: {
          sched: { show_id: showId },
        },
      });

      await tx.set.deleteMany({
        where: {
          sched: { show_id: showId },
        },
      });

      await tx.categorySetItem.deleteMany({
        where: {
          categorySet: { show_id: showId },
        },
      });

      await tx.sched.deleteMany({
        where: { show_id: showId },
      });

      await tx.categorySet.deleteMany({
        where: { show_id: showId },
      });

      await tx.show.delete({
        where: { show_id: showId },
      });
    });

    revalidatePath("/admin/shows");
    revalidatePath(`/admin/shows/${showId}`);

    return { success: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete show.";
    return { success: false, error: message };
  }
}
