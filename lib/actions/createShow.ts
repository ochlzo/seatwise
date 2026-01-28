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
  category_sets?: Array<{
    set_name: string;
    apply_to_all: boolean;
    sched_ids: string[];
    categories: Array<{
      category_name: string;
      price: string;
      color_code: ColorCodes;
    }>;
  }>;
  categories?: Array<{
    category_name: string;
    price: string;
    price: string;
    color_code: ColorCodes;
    apply_to_all: boolean;
    sched_ids: string[];
  }>;
};

const MANILA_TZ = "Asia/Manila";

const toManilaDateKey = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
};

const toManilaTimeKey = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);

const toDateOnly = (value: string | Date) => {
  if (typeof value === "string") {
    return new Date(`${value}T00:00:00+08:00`);
  }
  const dateKey = toManilaDateKey(value);
  return new Date(`${dateKey}T00:00:00+08:00`);
};

const toTime = (timeValue: string | Date) => {
  if (typeof timeValue === "string") {
    return new Date(`1970-01-01T${timeValue}:00+08:00`);
  }
  const timeKey = toManilaTimeKey(timeValue);
  return new Date(`1970-01-01T${timeKey}:00+08:00`);
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
      category_sets = [],
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

      const normalizedCategorySets =
        category_sets.length > 0
          ? category_sets
          : categories.map((category) => ({
              set_name: "Default Set",
              apply_to_all: category.apply_to_all,
              sched_ids: category.sched_ids,
              categories: [
                {
                  category_name: category.category_name,
                  price: category.price,
                  color_code: category.color_code,
                },
              ],
            }));

      if (normalizedCategorySets.length > 0) {
        const flatCategories = normalizedCategorySets.flatMap((setItem) => setItem.categories);
        const uniqueCategoryMap = new Map<string, typeof flatCategories[number]>();
        flatCategories.forEach((category) => {
          if (!uniqueCategoryMap.has(category.category_name)) {
            uniqueCategoryMap.set(category.category_name, category);
          }
        });

        const uniqueCategories = Array.from(uniqueCategoryMap.values());
        const uniqueNames = uniqueCategories.map((category) => category.category_name);

        const existingCategories = await tx.seatCategory.findMany({
          where: {
            seatmap_id,
            category_name: { in: uniqueNames },
          },
        });

        const existingMap = new Map(
          existingCategories.map((category) => [category.category_name, category.seat_category_id])
        );

        const missing = uniqueCategories.filter(
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

        const categorySetItemRows: Array<{
          category_set_id: string;
          seat_category_id: string;
        }> = [];

        for (let index = 0; index < normalizedCategorySets.length; index += 1) {
          const setItem = normalizedCategorySets[index];
          const setName = setItem.set_name?.trim() || `Set ${index + 1}`;
          const createdSet = await tx.categorySet.create({
            data: {
              set_name: setName,
              show_id: created.show_id,
            },
          });

          const targetSchedIds = setItem.apply_to_all
            ? Array.from(schedIdMap.values())
            : setItem.sched_ids.map((id) => schedIdMap.get(id)).filter(Boolean) as string[];

          if (targetSchedIds.length > 0) {
            await tx.sched.updateMany({
              where: { sched_id: { in: targetSchedIds } },
              data: { category_set_id: createdSet.category_set_id },
            });
          }

          setItem.categories.forEach((category) => {
            const seat_category_id = categoryIdByName.get(category.category_name);
            if (!seat_category_id) return;
            categorySetItemRows.push({
              category_set_id: createdSet.category_set_id,
              seat_category_id,
            });
          });
        }

        if (categorySetItemRows.length > 0) {
          await tx.categorySetItem.createMany({
            data: categorySetItemRows,
            skipDuplicates: true,
          });
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
