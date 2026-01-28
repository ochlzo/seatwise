"use server";

import "server-only";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { SeatmapStatus } from "@prisma/client";

async function assertAdmin() {
  const { adminAuth } = await import("@/lib/firebaseAdmin");
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }

  const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
  const user = await prisma.user.findUnique({
    where: { firebase_uid: decodedToken.uid },
  });

  if (user?.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

export async function deleteSeatmapsAction(seatmapIds: string[]) {
  try {
    await assertAdmin();

    await prisma.$transaction(async (tx) => {
      // Scheduler references to seatmap removed in schema refactor
      // await tx.sched.deleteMany({ where: { seatmap_id: { in: seatmapIds } } });
      await tx.seatmap.deleteMany({
        where: { seatmap_id: { in: seatmapIds } },
      });
    });

    revalidatePath("/admin/templates");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error in deleteSeatmapsAction:", error);
    const message = error instanceof Error ? error.message : "Failed to delete seatmaps";
    return { success: false, error: message };
  }
}

export async function updateSeatmapStatusAction(
  seatmapIds: string[],
  status: SeatmapStatus
) {
  try {
    await assertAdmin();

    await prisma.seatmap.updateMany({
      where: { seatmap_id: { in: seatmapIds } },
      data: { seatmap_status: status },
    });

    revalidatePath("/admin/templates");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error in updateSeatmapStatusAction:", error);
    const message = error instanceof Error ? error.message : "Failed to update seatmaps";
    return { success: false, error: message };
  }
}
