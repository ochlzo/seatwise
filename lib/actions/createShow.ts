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
  seatmap_id?: string; // Optional for DRAFT shows
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
    seat_assignments?: Record<string, string>; // seat_id -> category_name (using name to resolve ID later)
  }>;
  categories?: Array<{
    category_name: string;
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

    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    );
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

    // --- 1. Pre-Transaction Validation & Normalization ---

    // Normalize category sets (merging legacy 'categories' prop if needed)
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
          seat_assignments: undefined,
        }));

    if (normalizedCategorySets.length > 0) {
      // Validate unique set_name
      const normalizedNames = normalizedCategorySets.map((s, i) =>
        (s.set_name?.trim() || `Set ${i + 1}`)
      );
      const seenNames = new Set<string>();
      for (const name of normalizedNames) {
        const key = name.toLowerCase();
        if (seenNames.has(key)) {
          throw new Error(`Duplicate category set name in request: "${name}"`);
        }
        seenNames.add(key);
      }

      // Validate schedule coverage and overlaps using client_ids
      // Note: 'scheds' input contains client_ids. 'category_sets' refers to these client_ids.
      const allClientSchedIds = scheds.map((s) => s.client_id);
      let applyToAllCount = 0;
      for (const s of normalizedCategorySets) {
        if (s.apply_to_all) applyToAllCount += 1;
      }
      if (applyToAllCount > 1) {
        throw new Error(`Only one category set can have apply_to_all=true.`);
      }
      if (applyToAllCount === 1 && normalizedCategorySets.length > 1) {
        throw new Error(
          `If a category set has apply_to_all=true, it must be the only category set.`
        );
      }

      const clientSchedToSetName = new Map<string, string>();
      normalizedCategorySets.forEach((setItem, i) => {
        const setName = normalizedNames[i];
        const targetIds = setItem.apply_to_all
          ? allClientSchedIds
          : setItem.sched_ids; // These are client_ids from inputs

        for (const clientId of targetIds) {
          const existing = clientSchedToSetName.get(clientId);
          if (existing && existing !== setName) {
            throw new Error(
              `Schedule is assigned to multiple category sets: "${existing}" and "${setName}".`
            );
          }
          clientSchedToSetName.set(clientId, setName);
        }
      });

      if (allClientSchedIds.length > 0 && clientSchedToSetName.size !== allClientSchedIds.length) {
        const unassigned = allClientSchedIds.filter((id) => !clientSchedToSetName.has(id));
        if (unassigned.length > 0) {
          throw new Error(
            `Some schedules have no category set assigned (IDs: ${unassigned.join(", ")})`
          );
        }
      }
    } else if (scheds.length > 0 && !seatmap_id) {
      // Allow DRAFT shows to have schedules without seatmap/category sets
      // No validation needed here
    }

    // --- 2. Image Upload ---
    let finalImageUrl = show_image_key;
    if (image_base64) {
      const cloudinary = (await import("@/lib/cloudinary")).default;
      const uploadResponse = await cloudinary.uploader.upload(image_base64, {
        folder: "seatwise/show_thumbnails",
        resource_type: "image",
      });
      finalImageUrl = uploadResponse.secure_url;
    }

    // --- 3. Database Transaction ---
    const show = await prisma.$transaction(
      async (tx) => {
        const existingShow = await tx.show.findUnique({
          where: { show_name },
          select: { show_id: true },
        });
        if (existingShow) {
          throw new Error("Show name already exists");
        }

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
            seatmap_id: seatmap_id || undefined, // Allow undefined for DRAFT shows
          },
        });

        // Create Schedules
        const schedIdMap = new Map<string, string>(); // client_id -> db_sched_id
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

        if (normalizedCategorySets.length > 0) {
          // Category sets require a seatmap
          if (!seatmap_id) {
            throw new Error("Cannot create category sets without a seatmap");
          }

          const allDbSchedIds = Array.from(schedIdMap.values());

          // Create/Reuse Categories
          const flatCategories = normalizedCategorySets.flatMap((setItem) => setItem.categories);
          const uniqueCategoryMap = new Map<string, (typeof flatCategories)[number]>();
          flatCategories.forEach((category) => {
            if (!uniqueCategoryMap.has(category.category_name)) {
              uniqueCategoryMap.set(category.category_name, category);
            }
          });
          const uniqueCategories = Array.from(uniqueCategoryMap.values());
          const uniqueNames = uniqueCategories.map((c) => c.category_name);

          // Find existing
          const existingCategories = await tx.seatCategory.findMany({
            where: { seatmap_id, category_name: { in: uniqueNames } },
          });
          const existingMap = new Map(
            existingCategories.map((c) => [c.category_name, c.seat_category_id])
          );

          // Create missing
          const missing = uniqueCategories.filter((c) => !existingMap.has(c.category_name));
          if (missing.length > 0) {
            await tx.seatCategory.createMany({
              data: missing.map((c) => ({
                category_name: c.category_name,
                price: c.price,
                color_code: c.color_code,
                seatmap_id,
              })),
              skipDuplicates: true,
            });
          }

          // Re-fetch all to get IDs
          const allCategories = await tx.seatCategory.findMany({
            where: { seatmap_id, category_name: { in: uniqueNames } },
          });
          const categoryIdByName = new Map(
            allCategories.map((c) => [c.category_name, c.seat_category_id])
          );

          const categorySetItemRows: Array<{ category_set_id: string; seat_category_id: string }> = [];
          const setRows: Array<{ sched_id: string; seat_category_id: string }> = [];

          // Create Category Sets and Links
          for (let index = 0; index < normalizedCategorySets.length; index += 1) {
            const setItem = normalizedCategorySets[index];
            const setName = setItem.set_name?.trim() || `Set ${index + 1}`;

            const createdSet = await tx.categorySet.create({
              data: {
                set_name: setName,
                show_id: created.show_id,
              },
            });

            // Map client_ids to db_sched_ids
            const targetSchedIds = setItem.apply_to_all
              ? allDbSchedIds
              : setItem.sched_ids
                .map((id) => schedIdMap.get(id))
                .filter(Boolean) as string[];

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

              targetSchedIds.forEach((sched_id) => {
                setRows.push({ sched_id, seat_category_id });
              });
            });
          }

          if (categorySetItemRows.length > 0) {
            await tx.categorySetItem.createMany({
              data: categorySetItemRows,
              skipDuplicates: true,
            });
          }
          if (setRows.length > 0) {
            await tx.set.createMany({ data: setRows, skipDuplicates: true });
          }

          // Create Seat Assignments
          // 1. Fetch created Sets to map (sched_id, seat_category_id) -> set_id
          const createdSets = await tx.set.findMany({
            where: { sched_id: { in: allDbSchedIds } },
          });
          const setLookup = new Map<string, string>();
          createdSets.forEach((r) => {
            setLookup.set(`${r.sched_id}:${r.seat_category_id}`, r.set_id);
          });

          const seatAssignmentRows: Array<{
            seat_id: string;
            sched_id: string;
            set_id: string;
            seat_status: "OPEN";
          }> = [];

          for (const setItem of normalizedCategorySets) {
            if (!setItem.seat_assignments) continue;

            const targetSchedIds = setItem.apply_to_all
              ? allDbSchedIds
              : setItem.sched_ids
                .map((id) => schedIdMap.get(id))
                .filter(Boolean) as string[];

            for (const [seatId, catName] of Object.entries(setItem.seat_assignments)) {
              const seat_category_id = categoryIdByName.get(catName);
              if (!seat_category_id) continue;

              for (const schedId of targetSchedIds) {
                const lookupKey = `${schedId}:${seat_category_id}`;
                const set_id = setLookup.get(lookupKey);
                if (set_id) {
                  seatAssignmentRows.push({
                    seat_id: seatId,
                    sched_id: schedId,
                    set_id: set_id,
                    seat_status: "OPEN",
                  });
                }
              }
            }
          }

          if (seatAssignmentRows.length > 0) {
            const chunkSize = 2000;
            for (let i = 0; i < seatAssignmentRows.length; i += chunkSize) {
              await tx.seatAssignment.createMany({
                data: seatAssignmentRows.slice(i, i + chunkSize),
                skipDuplicates: true,
              });
            }
          }
        }

        return created;
      },
      {
        maxWait: 5000,
        timeout: 20000,
      }
    );

    revalidatePath("/admin/shows");

    return { success: true, showId: show.show_id };
  } catch (error: unknown) {
    console.error("Error in createShowAction:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create show";
    return { success: false, error: message };
  }
}
