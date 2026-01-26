"use server";

import "server-only";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

type SaveSeatmapPayload = {
  seatmap_name: string;
  seatmap_json: Record<string, unknown>;
  categories: Array<{ seat_category_id: string; category_name: string }>;
  seatmap_id?: string;
};

async function assertAdmin() {
  const { adminAuth } = await import("@/lib/firebaseAdmin");
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    throw new Error("Unauthorized");
  }

  const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { firebase_uid: decodedToken.uid },
  });

  if (user?.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
}

export async function saveSeatmapTemplateAction(payload: SaveSeatmapPayload) {
  try {
    await assertAdmin();
    const { prisma } = await import("@/lib/prisma");

    const { seatmap_name, seatmap_json, categories, seatmap_id } = payload;

    const created = await prisma.$transaction(async (tx) => {
      if (seatmap_id) {
        const updated = await tx.seatmap.update({
          where: { seatmap_id },
          data: {
            seatmap_name,
            seatmap_json,
          },
        });

        await tx.seatCategory.deleteMany({ where: { seatmap_id } });
        if (categories.length > 0) {
          await tx.seatCategory.createMany({
            data: categories.map((category) => ({
              seat_category_id: category.seat_category_id,
              category_name: category.category_name,
              seatmap_id,
            })),
          });
        }

        return updated;
      }

      const seatmap = await tx.seatmap.create({
        data: {
          seatmap_name,
          seatmap_json,
        },
      });

      if (categories.length > 0) {
        await tx.seatCategory.createMany({
          data: categories.map((category) => ({
            seat_category_id: category.seat_category_id,
            category_name: category.category_name,
            seatmap_id: seatmap.seatmap_id,
          })),
        });
      }

      return seatmap;
    });

    revalidatePath("/admin/templates");
    return { success: true, seatmapId: created.seatmap_id };
  } catch (error: any) {
    console.error("Error in saveSeatmapTemplateAction:", error);
    return { success: false, error: error.message || "Failed to save seatmap" };
  }
}
