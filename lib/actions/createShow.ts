"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, type ColorCodes, type ShowStatus } from "@prisma/client";
import { initializeQueueChannel } from "@/lib/queue/initializeQueue";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { validateShowPayload } from "@/lib/actions/showValidation";
import {
  CREATE_SHOW_TICKET_TEMPLATE_REQUIRED_MESSAGE,
  normalizeCreateShowTicketTemplateIds,
} from "@/lib/actions/createShowRequirements";

type CreateShowPayload = {
  team_id?: string;
  show_name: string;
  show_description: string;
  venue: string;
  address: string;
  show_status: ShowStatus;
  show_start_date: string | Date;
  show_end_date: string | Date;
  show_image_key?: string;
  gcash_qr_image_key?: string;
  gcash_qr_image_base64?: string;
  gcash_number?: string;
  gcash_account_name?: string;
  image_base64?: string;
  seatmap_id?: string; // Optional for DRAFT shows
  ticket_template_ids?: string[];
  ticket_template_id?: string;
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
  const dateKey =
    typeof value === "string"
      ? value.includes("T")
        ? toManilaDateKey(new Date(value))
        : value
      : toManilaDateKey(value);
  // Store as UTC midnight to avoid timezone shifts on DATE columns.
  return new Date(`${dateKey}T00:00:00.000Z`);
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
    const adminContext = await getCurrentAdminContext();
    const requestedTeamId = data.team_id?.trim();
    let adminTeamId: string;

    if (adminContext.isSuperadmin) {
      if (!requestedTeamId) {
        throw new Error("Please assign this show to a team before creating it.");
      }
      const team = await prisma.team.findUnique({
        where: { team_id: requestedTeamId },
        select: { team_id: true },
      });
      if (!team) {
        throw new Error("Selected team was not found.");
      }
      adminTeamId = requestedTeamId;
    } else if (!adminContext.teamId) {
      throw new Error("Admin team is not assigned. Contact a superadmin.");
    } else {
      adminTeamId = adminContext.teamId;
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
      gcash_qr_image_key,
      gcash_qr_image_base64,
      gcash_number,
      gcash_account_name,
      image_base64,
      seatmap_id,
      ticket_template_ids = [],
      ticket_template_id,
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

    const normalizedSetNames = normalizedCategorySets.map((setItem, index) =>
      setItem.set_name?.trim() || `Set ${index + 1}`
    );
    const flatCategories = normalizedCategorySets.flatMap(
      (setItem) => setItem.categories
    );
    const uniqueCategoryMap = new Map<string, (typeof flatCategories)[number]>();
    flatCategories.forEach((category) => {
      const key = `${category.category_name.trim().toLowerCase()}|${Number(category.price).toString()}|${category.color_code}`;
      if (!uniqueCategoryMap.has(key)) {
        uniqueCategoryMap.set(key, category);
      }
    });
    const uniqueCategories = Array.from(uniqueCategoryMap.values());

    const trimmedSeatmapId = seatmap_id?.trim();
    const normalizedTicketTemplateIds =
      normalizeCreateShowTicketTemplateIds(
        Array.isArray(ticket_template_ids)
          ? ticket_template_ids
          : ticket_template_id
            ? [ticket_template_id]
            : [],
      );

    if (normalizedTicketTemplateIds.length === 0) {
      return {
        success: false,
        error: CREATE_SHOW_TICKET_TEMPLATE_REQUIRED_MESSAGE,
      };
    }
    const legacyTicketTemplateId = normalizedTicketTemplateIds[0];
    const seatmap = trimmedSeatmapId
      ? await prisma.seatmap.findUnique({
          where: { seatmap_id: trimmedSeatmapId },
          select: {
            seatmap_id: true,
            seats: {
              select: { seat_id: true },
            },
          },
        })
      : null;
    const ticketTemplates = normalizedTicketTemplateIds.length
      ? await prisma.ticketTemplate.findMany({
          where: {
            ticket_template_id: { in: normalizedTicketTemplateIds },
            team_id: adminTeamId,
          },
          select: {
            ticket_template_id: true,
          },
        })
      : [];
    const ticketTemplateIdSet = new Set(
      ticketTemplates.map((template) => template.ticket_template_id),
    );
    const allTicketTemplatesExist = normalizedTicketTemplateIds.every((templateId) =>
      ticketTemplateIdSet.has(templateId),
    );

    const payloadValidation = validateShowPayload({
      show_name,
      show_description,
      venue,
      address,
      show_status,
      show_start_date,
      show_end_date,
      gcash_qr_image_key,
      gcash_qr_image_base64,
      gcash_number,
      gcash_account_name,
      seatmap_id: trimmedSeatmapId,
      ticket_template_ids: normalizedTicketTemplateIds,
      scheds,
      categorySets: normalizedCategorySets,
      seatIds: seatmap?.seats.map((seat) => seat.seat_id) ?? [],
      seatmapExists: Boolean(seatmap),
      ticketTemplatesExist: allTicketTemplatesExist,
    });

    if (payloadValidation.hasValidationErrors) {
      return {
        success: false,
        error: payloadValidation.errorMessage,
        validation: payloadValidation.validation,
      };
    }

    if (normalizedCategorySets.length > 0) {
      // Validate schedule coverage and overlaps using client_ids
      // Note: 'scheds' input contains client_ids. 'category_sets' refers to these client_ids.
      const allClientSchedIds = scheds.map((s) => s.client_id);

      const clientSchedToSetName = new Map<string, string>();
      normalizedCategorySets.forEach((setItem, i) => {
        const setName = normalizedSetNames[i];
        const targetIds = setItem.sched_ids; // These are client_ids from inputs

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
    } else if (scheds.length > 0 && !trimmedSeatmapId) {
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

    let finalGcashQrImageUrl = gcash_qr_image_key;
    if (gcash_qr_image_base64) {
      const cloudinary = (await import("@/lib/cloudinary")).default;
      const qrUploadResponse = await cloudinary.uploader.upload(gcash_qr_image_base64, {
        folder: "seatwise/gcash_qr_codes",
        resource_type: "image",
      });
      finalGcashQrImageUrl = qrUploadResponse.secure_url;
    }

    // --- 3. Database Transaction ---
    const schedIdMap = new Map<string, string>(); // client_id -> db_sched_id

    const show = await prisma.$transaction(
      async (tx) => {
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
            gcash_qr_image_key: finalGcashQrImageUrl?.trim() || undefined,
            gcash_number: gcash_number?.trim() || undefined,
            gcash_account_name: gcash_account_name?.trim() || undefined,
            team_id: adminTeamId,
            seatmap_id: trimmedSeatmapId || undefined, // Allow undefined for DRAFT shows
            ticket_template_id: legacyTicketTemplateId || undefined,
          },
        });
        for (const ticketTemplateId of normalizedTicketTemplateIds) {
          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO "ShowTicketTemplate" ("show_id", "ticket_template_id", "team_id")
              VALUES (${created.show_id}, ${ticketTemplateId}, ${adminTeamId})
              ON CONFLICT ("show_id", "ticket_template_id") DO NOTHING
            `,
          );
        }

        // Create Schedules
        const createdScheds = await Promise.all(
          scheds.map((sched) =>
            tx.sched.create({
              data: {
                show_id: created.show_id,
                sched_date: toDateOnly(sched.sched_date),
                sched_start_time: toTime(sched.sched_start_time),
                sched_end_time: toTime(sched.sched_end_time),
              },
            })
          )
        );
        createdScheds.forEach((createdSched, index) => {
          schedIdMap.set(scheds[index].client_id, createdSched.sched_id);
        });

        if (normalizedCategorySets.length > 0) {
          // Category sets require a seatmap
          if (!trimmedSeatmapId) {
            throw new Error("Cannot create category sets without a seatmap");
          }

          const allDbSchedIds = Array.from(schedIdMap.values());

          // Create/Reuse Categories
          // Find existing categories that match name, price, AND color
          const existingCategories = await tx.seatCategory.findMany({
            where: {
              seatmap_id: trimmedSeatmapId,
              OR: uniqueCategories.map((c) => ({
                category_name: c.category_name,
                price: c.price,
                color_code: c.color_code,
              })),
            },
          });
          const existingMap = new Map<string, string>();
          existingCategories.forEach((c) => {
            const key = `${c.category_name.trim().toLowerCase()}|${Number(c.price).toString()}|${c.color_code}`;
            existingMap.set(key, c.seat_category_id);
          });

          // Create missing
          const missing = uniqueCategories.filter((c) => {
            const key = `${c.category_name.trim().toLowerCase()}|${Number(c.price).toString()}|${c.color_code}`;
            return !existingMap.has(key);
          });
          if (missing.length > 0) {
            await tx.seatCategory.createMany({
              data: missing.map((c) => ({
                category_name: c.category_name,
                price: c.price,
                color_code: c.color_code,
                seatmap_id: trimmedSeatmapId,
              })),
              skipDuplicates: true,
            });
          }

          // Re-fetch all to get IDs for the ones we need
          const allCategories = await tx.seatCategory.findMany({
            where: {
              seatmap_id: trimmedSeatmapId,
              OR: uniqueCategories.map((c) => ({
                category_name: c.category_name,
                price: c.price,
                color_code: c.color_code,
              })),
            },
          });
          const categoryIdLookup = new Map<string, string>();
          allCategories.forEach((c) => {
            const key = `${c.category_name.trim().toLowerCase()}|${Number(c.price).toString()}|${c.color_code}`;
            categoryIdLookup.set(key, c.seat_category_id);
          });

          const categorySetItemRows: Array<{ category_set_id: string; seat_category_id: string }> = [];
          const setRows: Array<{ sched_id: string; seat_category_id: string }> = [];

          // Create Category Sets and Links
          for (let index = 0; index < normalizedCategorySets.length; index += 1) {
            const setItem = normalizedCategorySets[index];
            const setName = normalizedSetNames[index];

            const createdSet = await tx.categorySet.create({
              data: {
                set_name: setName,
                show_id: created.show_id,
              },
            });

            // Map client_ids to db_sched_ids
            const targetSchedIds = setItem.sched_ids
              .map((id) => schedIdMap.get(id))
              .filter(Boolean) as string[];

            if (targetSchedIds.length > 0) {
              await tx.sched.updateMany({
                where: { sched_id: { in: targetSchedIds } },
                data: { category_set_id: createdSet.category_set_id },
              });
            }

            setItem.categories.forEach((category) => {
              const key = `${category.category_name.trim().toLowerCase()}|${Number(category.price).toString()}|${category.color_code}`;
              const seat_category_id = categoryIdLookup.get(key);
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

            const targetSchedIds = setItem.sched_ids
              .map((id) => schedIdMap.get(id))
              .filter(Boolean) as string[];

            for (const [seatId, catName] of Object.entries(setItem.seat_assignments)) {
              const normalizedCategoryName = catName.trim().toLowerCase();
              const matchedCategory = setItem.categories.find(
                (category) =>
                  category.category_name.trim().toLowerCase() === normalizedCategoryName,
              );
              if (!matchedCategory) continue;

              const key = `${normalizedCategoryName}|${Number(matchedCategory.price).toString()}|${matchedCategory.color_code}`;
              const seat_category_id = categoryIdLookup.get(key);
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

    // 🎯 QUEUE LIFECYCLE MANAGEMENT (After database transaction)
    // Initialize queues if show is created with OPEN status
    const queueResults: Array<Awaited<ReturnType<typeof initializeQueueChannel>>> = [];
    const allSchedIds = Array.from(schedIdMap.values());

    if (show_status === 'OPEN' && allSchedIds.length > 0) {
      const queueInitResults = await Promise.allSettled(
        allSchedIds.map((schedId) => {
          const showScopeId = `${show.show_id}:${schedId}`;
          return initializeQueueChannel(showScopeId);
        })
      );

      queueInitResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          queueResults.push(result.value);
          return;
        }

        const showScopeId = `${show.show_id}:${allSchedIds[index]}`;
        console.error(
          `Queue initialization failed for ${showScopeId}:`,
          result.reason
        );
      });
    }

    revalidatePath("/admin/shows");

    return {
      success: true,
      showId: show.show_id,
      queueResults: queueResults.length > 0 ? queueResults : undefined,
    };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const targets = Array.isArray(error.meta?.target)
        ? error.meta.target.map(String)
        : [];
      if (targets.includes("show_name")) {
        return { success: false, error: "Show name already exists" };
      }
    }
    console.error("Error in createShowAction:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create show";
    return { success: false, error: message };
  }
}


