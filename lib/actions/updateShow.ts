"use server";

import "server-only";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma, type ShowStatus } from "@prisma/client";
import { validateShowPayload } from "@/lib/actions/showValidation";
import {
  assertShowCanMoveToRestrictedStatus,
  runShowQueueStatusTransition,
} from "@/lib/shows/showStatusLifecycle";

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

const toTime = (value: string | Date) => {
  if (typeof value === "string") {
    if (value.includes("T")) {
      // ISO string -> convert to Manila time string first
      const timeKey = toManilaTimeKey(new Date(value));
      return new Date(`1970-01-01T${timeKey}:00+08:00`);
    }
    // Simple time string HH:mm
    return new Date(`1970-01-01T${value}:00+08:00`);
  }
  const timeKey = toManilaTimeKey(value);
  return new Date(`1970-01-01T${timeKey}:00+08:00`);
};

type UpdateShowSched = {
  client_id: string;
  sched_date: string | Date;
  sched_start_time: string | Date;
  sched_end_time: string | Date;
};

type UpdateCategorySetCategory = {
  category_name: string;
  price: string;
  color_code: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
};

type UpdateCategorySet = {
  set_name: string;
  apply_to_all: boolean;
  sched_ids: string[];
  categories: UpdateCategorySetCategory[];
  seat_assignments: Record<string, string>; // Maps seat ID -> category name
};

type UpdateShowPayload = {
  show_name: string;
  show_description: string;
  venue: string;
  address: string;
  gcash_qr_image_key?: string | null;
  gcash_qr_image_base64?: string;
  gcash_number?: string;
  gcash_account_name?: string;
  show_status: ShowStatus;
  show_start_date: string | Date;
  show_end_date: string | Date;
  seatmap_id?: string | null;
  ticket_template_ids?: string[] | null;
  ticket_template_id?: string | null;
  scheds?: UpdateShowSched[];
  category_sets?: UpdateCategorySet[];
};

type NormalizedCategory = {
  category_name: string;
  price: string;
  color_code: UpdateCategorySetCategory["color_code"];
};

type NormalizedCategorySet = {
  set_name: string;
  sched_ids: string[];
  categories: NormalizedCategory[];
  seat_assignments: Record<string, string>;
};

type StructuralSnapshot = {
  seatmap_id: string | null;
  gcash_qr_image_key: string | null;
  gcash_number: string;
  gcash_account_name: string;
  scheds: Array<{
    sched_date: string;
    sched_start_time: string;
    sched_end_time: string;
  }>;
  category_sets: Array<{
    set_name: string;
    sched_keys: string[];
    categories: NormalizedCategory[];
    seat_assignments: Array<[string, string]>;
  }>;
};

type ExistingShowForStructure = {
  seatmap_id: string | null;
  gcash_qr_image_key: string | null;
  gcash_number?: string | null;
  gcash_account_name?: string | null;
  scheds: Array<{
    sched_id: string;
    sched_date: Date;
    sched_start_time: Date;
    sched_end_time: Date;
    category_set_id: string | null;
    seatAssignments: Array<{
      seat_id: string;
      set: {
        seatCategory: {
          category_name: string;
        };
      };
    }>;
  }>;
  categorySets: Array<{
    category_set_id: string;
    set_name: string;
    items: Array<{
      seatCategory: {
        category_name: string;
        price: { toString(): string };
        color_code: UpdateCategorySetCategory["color_code"];
      };
    }>;
  }>;
};

const buildSchedKey = (sched: {
  sched_date: string | Date;
  sched_start_time: string | Date;
  sched_end_time: string | Date;
}) =>
  [
    toManilaDateKey(new Date(toDateOnly(sched.sched_date))),
    toManilaTimeKey(toTime(sched.sched_start_time)),
    toManilaTimeKey(toTime(sched.sched_end_time)),
  ].join("|");

const normalizeCategoriesForCompare = (categories: NormalizedCategory[]) =>
  [...categories]
    .map((category) => ({
      category_name: category.category_name.trim().toLowerCase(),
      price: Number(category.price).toString(),
      color_code: category.color_code,
    }))
    .sort((a, b) =>
      `${a.category_name}|${a.price}|${a.color_code}`.localeCompare(
        `${b.category_name}|${b.price}|${b.color_code}`,
      ),
    );

const buildIncomingStructuralSnapshot = ({
  seatmapId,
  gcashQrImageKey,
  gcashNumber,
  gcashAccountName,
  scheds,
  categorySets,
}: {
  seatmapId: string | null;
  gcashQrImageKey: string | null;
  gcashNumber: string;
  gcashAccountName: string;
  scheds: UpdateShowSched[];
  categorySets: NormalizedCategorySet[];
}): StructuralSnapshot => {
  const schedKeyByClientId = new Map(
    scheds.map((sched) => [sched.client_id, buildSchedKey(sched)]),
  );

  return {
    seatmap_id: seatmapId,
    gcash_qr_image_key: gcashQrImageKey,
    gcash_number: gcashNumber.trim(),
    gcash_account_name: gcashAccountName.trim(),
    scheds: [...scheds]
      .map((sched) => ({
        sched_date: toManilaDateKey(new Date(toDateOnly(sched.sched_date))),
        sched_start_time: toManilaTimeKey(toTime(sched.sched_start_time)),
        sched_end_time: toManilaTimeKey(toTime(sched.sched_end_time)),
      }))
      .sort((a, b) =>
        `${a.sched_date}|${a.sched_start_time}|${a.sched_end_time}`.localeCompare(
          `${b.sched_date}|${b.sched_start_time}|${b.sched_end_time}`,
        ),
      ),
    category_sets: [...categorySets]
      .map((setItem) => ({
        set_name: setItem.set_name.trim().toLowerCase(),
        sched_keys: setItem.sched_ids
          .map((schedId) => schedKeyByClientId.get(schedId))
          .filter((value): value is string => Boolean(value))
          .sort(),
        categories: normalizeCategoriesForCompare(setItem.categories),
        seat_assignments: Object.entries(setItem.seat_assignments)
          .map(([seatId, categoryName]) => [seatId, categoryName.trim().toLowerCase()] as [string, string])
          .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])),
      }))
      .sort((a, b) => a.set_name.localeCompare(b.set_name)),
  };
};

const buildExistingStructuralSnapshot = (
  show: ExistingShowForStructure,
): StructuralSnapshot => {
  const schedKeyById = new Map(
    show.scheds.map((sched) => [sched.sched_id, buildSchedKey(sched)]),
  );

  return {
    seatmap_id: show.seatmap_id ?? null,
    gcash_qr_image_key: show.gcash_qr_image_key ?? null,
    gcash_number: show.gcash_number?.trim() ?? "",
    gcash_account_name: show.gcash_account_name?.trim() ?? "",
    scheds: [...show.scheds]
      .map((sched) => ({
        sched_date: toManilaDateKey(new Date(toDateOnly(sched.sched_date))),
        sched_start_time: toManilaTimeKey(toTime(sched.sched_start_time)),
        sched_end_time: toManilaTimeKey(toTime(sched.sched_end_time)),
      }))
      .sort((a, b) =>
        `${a.sched_date}|${a.sched_start_time}|${a.sched_end_time}`.localeCompare(
          `${b.sched_date}|${b.sched_start_time}|${b.sched_end_time}`,
        ),
      ),
    category_sets: [...show.categorySets]
      .map((setItem) => {
        const referenceSched = show.scheds.find(
          (sched) => sched.category_set_id === setItem.category_set_id,
        );

        return {
          set_name: setItem.set_name.trim().toLowerCase(),
          sched_keys: show.scheds
            .filter((sched) => sched.category_set_id === setItem.category_set_id)
            .map((sched) => schedKeyById.get(sched.sched_id))
            .filter((value): value is string => Boolean(value))
            .sort(),
          categories: normalizeCategoriesForCompare(
            setItem.items.map((item) => ({
              category_name: item.seatCategory.category_name,
              price: item.seatCategory.price.toString(),
              color_code: item.seatCategory.color_code,
            })),
          ),
          seat_assignments: (referenceSched?.seatAssignments ?? [])
            .map((assignment) => [
              assignment.seat_id,
              assignment.set.seatCategory.category_name.trim().toLowerCase(),
            ] as [string, string])
            .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])),
        };
      })
      .sort((a, b) => a.set_name.localeCompare(b.set_name)),
  };
};

const getCloudinaryPublicIdFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const uploadMarker = "/upload/";
    const uploadIndex = parsed.pathname.indexOf(uploadMarker);
    if (uploadIndex === -1) return null;

    const pathAfterUpload = parsed.pathname
      .slice(uploadIndex + uploadMarker.length)
      .split("/")
      .filter(Boolean);

    if (pathAfterUpload.length === 0) return null;

    if (pathAfterUpload[0].startsWith("v")) {
      pathAfterUpload.shift();
    }

    const lastSegment = pathAfterUpload.pop();
    if (!lastSegment) return null;

    const filenameWithoutExt = lastSegment.replace(/\.[^/.]+$/, "");
    return [...pathAfterUpload, filenameWithoutExt].join("/");
  } catch {
    return null;
  }
};

export async function updateShowAction(
  showId: string,
  data: UpdateShowPayload,
) {
  try {
    const { adminAuth } = await import("@/lib/firebaseAdmin");
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      throw new Error("Unauthorized");
    }

    // Verify session to ensure user is admin
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    );
    const user = await prisma.admin.findUnique({
      where: { firebase_uid: decodedToken.uid },
    });

    if (!user) {
      throw new Error("Forbidden");
    }

    const {
      show_name,
      show_description,
      venue,
      address,
      gcash_qr_image_key,
      gcash_qr_image_base64,
      gcash_number,
      gcash_account_name,
      show_status,
      show_start_date,
      show_end_date,
      seatmap_id,
      ticket_template_ids = [],
      ticket_template_id,
      scheds = [],
      category_sets = [],
    } = data;

    const trimmedSeatmapId = seatmap_id?.trim() || null;
    const normalizedTicketTemplateIds = Array.from(
      new Set(
        (Array.isArray(ticket_template_ids)
          ? ticket_template_ids
          : ticket_template_id
            ? [ticket_template_id]
            : []
        )
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const legacyTicketTemplateId = normalizedTicketTemplateIds[0] ?? null;
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

    // Get current show status for queue lifecycle management
    const currentShow = await prisma.show.findUnique({
      where: { show_id: showId },
      select: {
        show_id: true,
        team_id: true,
        show_status: true,
        seatmap_id: true,
        ticket_template_id: true,
        gcash_qr_image_key: true,
        gcash_number: true,
        gcash_account_name: true,
        _count: {
          select: {
            reservations: true,
          },
        },
        scheds: {
          select: {
            sched_id: true,
            sched_date: true,
            sched_start_time: true,
            sched_end_time: true,
            category_set_id: true,
            seatAssignments: {
              select: {
                seat_id: true,
                set: {
                  select: {
                    seatCategory: {
                      select: {
                        category_name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        categorySets: {
          select: {
            category_set_id: true,
            set_name: true,
            items: {
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
    });

    if (!currentShow) {
      throw new Error("Show not found.");
    }

    const ticketTemplates = normalizedTicketTemplateIds.length
      ? await prisma.ticketTemplate.findMany({
          where: {
            ticket_template_id: { in: normalizedTicketTemplateIds },
            team_id: currentShow.team_id,
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

    const oldStatus = currentShow?.show_status;
    const newStatus = show_status;

    const previousSchedIds = currentShow.scheds.map((sched) => sched.sched_id);

    let finalGcashQrImageUrl =
      gcash_qr_image_key?.trim() || currentShow?.gcash_qr_image_key || undefined;

    if (gcash_qr_image_base64?.trim()) {
      const cloudinary = (await import("@/lib/cloudinary")).default;
      const existingPublicId = currentShow?.gcash_qr_image_key
        ? getCloudinaryPublicIdFromUrl(currentShow.gcash_qr_image_key)
        : null;

      const qrUploadResponse = existingPublicId
        ? await cloudinary.uploader.upload(gcash_qr_image_base64, {
            public_id: existingPublicId,
            overwrite: true,
            invalidate: true,
            resource_type: "image",
          })
        : await cloudinary.uploader.upload(gcash_qr_image_base64, {
            folder: "seatwise/gcash_qr_codes",
            resource_type: "image",
          });

      finalGcashQrImageUrl = qrUploadResponse.secure_url;
    }

    if (!finalGcashQrImageUrl?.trim()) {
      throw new Error("GCash QR image is required.");
    }

    const payloadValidation = validateShowPayload({
      show_name,
      show_description,
      venue,
      address,
      show_status,
      show_start_date,
      show_end_date,
      gcash_qr_image_key: finalGcashQrImageUrl,
      gcash_qr_image_base64: undefined,
      gcash_number,
      gcash_account_name,
      seatmap_id: trimmedSeatmapId,
      ticket_template_ids: normalizedTicketTemplateIds,
      scheds,
      categorySets: category_sets,
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

    await assertShowCanMoveToRestrictedStatus(prisma, showId, oldStatus, newStatus);

    const normalizedCategorySets: NormalizedCategorySet[] = category_sets.map(
      (setItem, index) => ({
        set_name: setItem.set_name?.trim() || `Set ${index + 1}`,
        sched_ids: setItem.sched_ids,
        categories: setItem.categories.map((category) => ({
          category_name: category.category_name.trim(),
          price: category.price,
          color_code: category.color_code,
        })),
        seat_assignments: setItem.seat_assignments ?? {},
      }),
    );

    const flatCategories = normalizedCategorySets.flatMap((setItem) => setItem.categories);
    const uniqueCategoryMap = new Map<string, NormalizedCategory>();
    flatCategories.forEach((category) => {
      const key = `${category.category_name.toLowerCase()}|${Number(category.price).toString()}|${category.color_code}`;
      if (!uniqueCategoryMap.has(key)) {
        uniqueCategoryMap.set(key, category);
      }
    });
    const uniqueCategories = Array.from(uniqueCategoryMap.values());
    const hasReservationHistory = currentShow._count.reservations > 0;
    const incomingStructuralSnapshot = buildIncomingStructuralSnapshot({
      seatmapId: trimmedSeatmapId,
      gcashQrImageKey: finalGcashQrImageUrl?.trim() ?? null,
      gcashNumber: gcash_number ?? "",
      gcashAccountName: gcash_account_name ?? "",
      scheds,
      categorySets: normalizedCategorySets,
    });
    const existingStructuralSnapshot = buildExistingStructuralSnapshot(currentShow);
    const hasStructuralChanges =
      JSON.stringify(incomingStructuralSnapshot) !==
      JSON.stringify(existingStructuralSnapshot);

    if (hasReservationHistory && hasStructuralChanges) {
      throw new Error(
        "This show has reservation history. GCash details, seatmap, schedules, category sets, and seat assignments can no longer be structurally changed.",
      );
    }

    const schedIdMap = new Map<string, string>(); // temp_id -> db_sched_id

    await prisma.$transaction(
      async (tx) => {
        // 1. Update Show details
        await tx.show.update({
          where: { show_id: showId },
          data: {
            show_name,
            show_description,
            venue,
            address,
            show_status,
            show_start_date: toDateOnly(show_start_date),
            show_end_date: toDateOnly(show_end_date),
            gcash_qr_image_key: finalGcashQrImageUrl?.trim() || undefined,
            gcash_number: gcash_number?.trim() || undefined,
            gcash_account_name: gcash_account_name?.trim() || undefined,
            seatmap_id: trimmedSeatmapId || undefined,
            ticket_template_id: legacyTicketTemplateId,
          },
        });
        await tx.$executeRaw(
          Prisma.sql`DELETE FROM "ShowTicketTemplate" WHERE "show_id" = ${showId}`,
        );
        for (const ticketTemplateId of normalizedTicketTemplateIds) {
          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO "ShowTicketTemplate" ("show_id", "ticket_template_id", "team_id")
              VALUES (${showId}, ${ticketTemplateId}, ${currentShow.team_id})
              ON CONFLICT ("show_id", "ticket_template_id") DO NOTHING
            `,
          );
        }

        if (hasReservationHistory) {
          currentShow.scheds.forEach((sched) => {
            schedIdMap.set(sched.sched_id, sched.sched_id);
          });
          return;
        }

        // 2. Clear existing schedules, category sets, and related data
        await tx.seatAssignment.deleteMany({
          where: { sched: { show_id: showId } },
        });
        await tx.set.deleteMany({
          where: { sched: { show_id: showId } },
        });
        await tx.categorySetItem.deleteMany({
          where: { categorySet: { show_id: showId } },
        });
        await tx.categorySet.deleteMany({
          where: { show_id: showId },
        });
        await tx.sched.deleteMany({
          where: { show_id: showId },
        });

        // 3. Create new schedules
        if (scheds.length > 0) {
          const createdScheds = await Promise.all(
            scheds.map((sched) =>
              tx.sched.create({
              data: {
                show_id: showId,
                sched_date: toDateOnly(sched.sched_date),
                sched_start_time: toTime(sched.sched_start_time),
                sched_end_time: toTime(sched.sched_end_time),
              },
              }),
            ),
          );

          createdScheds.forEach((createdSched, index) => {
            schedIdMap.set(scheds[index].client_id, createdSched.sched_id);
          });
        }

        // 4. Create category sets if provided
        if (normalizedCategorySets.length > 0 && trimmedSeatmapId) {
          const allDbSchedIds = Array.from(schedIdMap.values());

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

          const categorySetItemRows: Array<{
            category_set_id: string;
            seat_category_id: string;
          }> = [];
          const setRows: Array<{ sched_id: string; seat_category_id: string }> =
            [];

          // Create Category Sets
          for (let index = 0; index < normalizedCategorySets.length; index += 1) {
            const setItem = normalizedCategorySets[index];
            const setName = setItem.set_name;

            const createdSet = await tx.categorySet.create({
              data: {
                set_name: setName,
                show_id: showId,
              },
            });

            // Determine target schedules
            const targetSchedIds = setItem.sched_ids
              .map((clientId) => schedIdMap.get(clientId))
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
            const targetSchedIds = setItem.sched_ids
              .map((id) => schedIdMap.get(id))
              .filter(Boolean) as string[];

            for (const [seatId, catName] of Object.entries(
              setItem.seat_assignments,
            )) {
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
      },
      {
        maxWait: 5000,
        timeout: 20000,
      },
    );

    // 🎯 QUEUE LIFECYCLE MANAGEMENT (After database transaction)
    const queueResults = await runShowQueueStatusTransition({
      showId,
      oldStatus,
      newStatus,
      schedIds: [...previousSchedIds, ...Array.from(schedIdMap.values())],
    });

    revalidatePath("/admin/shows");
    revalidatePath(`/admin/shows/${showId}`);

    return {
      success: true,
      queueResults: queueResults.length > 0 ? queueResults : undefined,
    };
  } catch (error: unknown) {
    console.error("Error in updateShowAction:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update show";
    return { success: false, error: message };
  }
}


