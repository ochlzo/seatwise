"use server";

import "server-only";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ColorCodes, ShowStatus } from "@prisma/client";

type CreateShowPayload = {
  show_name: string;
  show_description: string;
  venue: string;
  address: string;
  show_status: ShowStatus;
  show_start_date: string | Date;
  show_end_date: string | Date;
  show_image_key?: string;
  image_base64?: string;
  seatmap_id: string;
  scheds?: Array<{
    client_id: string;
    sched_date: string;
    sched_start_time: string;
    sched_end_time: string;
  }>;
  categories?: Array<{
    category_name: string;
    price: string;
    color_code: ColorCodes;
    apply_to_all: boolean;
    sched_ids: string[];
  }>;
};

const toDateOnly = (value: string | Date) => {
  // Handle string input (YYYY-MM-DD) by forcing UTC midnight
  if (typeof value === "string") {
    return new Date(`${value}T00:00:00Z`);
  }
  // For Date objects, return as-is (assuming already handled) or strip time if needed
  // But typically input is string from form.
  return value;
};

const toTime = (timeValue: string) => {
  // Force UTC parsing to preserve the exact HH:mm entered by the user
  // This prevents server timezone offsets from shifting the stored time
  return new Date(`1970-01-01T${timeValue}:00Z`);
};

export async function createShowAction(data: CreateShowPayload) {
  try {
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

    const {
      show_name,
      show_description,
      venue,
      address,
      show_status,
      show_start_date,
      show_end_date,
      show_image_key,
      image_base64,
      seatmap_id,
      scheds = [],
      categories = [],
    } = data;

    let finalImageUrl = show_image_key;
    if (image_base64) {
      const cloudinary = (await import("@/lib/cloudinary")).default;
      const uploadResponse = await cloudinary.uploader.upload(image_base64, {
        folder: "seatwise/show_thumbnails",
        resource_type: "image",
      });
      finalImageUrl = uploadResponse.secure_url;
    }

    const show = await prisma.$transaction(async (tx) => {
      const created = await tx.show.create({
        data: {
          show_name,
          show_description,
          venue,
          address,
          show_status,
          show_start_date: toDateOnly(show_start_date),
          show_end_date: toDateOnly(show_end_date),
          show_image_key: finalImageUrl,
          seatmap_id,
        },
      });

      const schedIdMap = new Map<string, string>();
      for (const sched of scheds) {
        const createdSched = await tx.sched.create({
          data: {
            show_id: created.show_id,
            sched_date: toDateOnly(sched.sched_date),
            sched_start_time: toTime(sched.sched_start_time),
            sched_end_time: toTime(sched.sched_end_time),
          },
        });
        schedIdMap.set(sched.client_id, createdSched.sched_id);
      }

      if (categories.length > 0) {
        const uniqueNames = Array.from(
          new Set(categories.map((category) => category.category_name))
        );

        const existingCategories = await tx.seatCategory.findMany({
          where: {
            seatmap_id,
            category_name: { in: uniqueNames },
          },
        });

        const existingMap = new Map(
          existingCategories.map((category) => [category.category_name, category.seat_category_id])
        );

        const missing = categories.filter(
          (category) => !existingMap.has(category.category_name)
        );

        if (missing.length > 0) {
          await tx.seatCategory.createMany({
            data: missing.map((category) => ({
              category_name: category.category_name,
              price: category.price,
              color_code: category.color_code,
              seatmap_id,
            })),
            skipDuplicates: true,
          });
        }

        const allCategories = await tx.seatCategory.findMany({
          where: {
            seatmap_id,
            category_name: { in: uniqueNames },
          },
        });

        const categoryIdByName = new Map(
          allCategories.map((category) => [category.category_name, category.seat_category_id])
        );

        const setRows: Array<{
          sched_id: string;
          seat_category_id: string;
        }> = [];

        categories.forEach((category) => {
          const seat_category_id = categoryIdByName.get(category.category_name);
          if (!seat_category_id) return;
          const targetSchedIds = category.apply_to_all
            ? Array.from(schedIdMap.values())
            : category.sched_ids.map((id) => schedIdMap.get(id)).filter(Boolean) as string[];

          targetSchedIds.forEach((sched_id) => {
            setRows.push({
              sched_id,
              seat_category_id,
            });
          });
        });

        if (setRows.length > 0) {
          await tx.set.createMany({ data: setRows, skipDuplicates: true });
        }
      }

      return created;
    });

    revalidatePath("/admin/shows");

    return { success: true, showId: show.show_id };
  } catch (error: unknown) {
    console.error("Error in createShowAction:", error);
    const message = error instanceof Error ? error.message : "Failed to create show";
    return { success: false, error: message };
  }
}
