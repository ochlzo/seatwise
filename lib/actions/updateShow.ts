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
import {
  buildShowStructureCategoryKey,
  collectAffectedScheduleIdsForDerivedRows,
  collectRemovedCategorySetIds,
  type ShowStructureCategorySetState,
  type ShowStructureScheduleState,
} from "@/lib/actions/showStructureSync";

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
  id: string;
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
  id: string;
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
        ticketTemplateLinks: {
          select: {
            ticket_template_id: true,
          },
        },
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
        id: setItem.id,
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
    const shouldPurgeReservationData =
      oldStatus === "DRY_RUN" && newStatus !== "DRY_RUN";
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

    const previousScheduleStates: ShowStructureScheduleState[] =
      currentShow.scheds.map((sched) => ({
        sched_id: sched.sched_id,
        category_set_id: sched.category_set_id,
      }));
    const previousCategorySetStates: ShowStructureCategorySetState[] =
      currentShow.categorySets.map((categorySet) => {
        const firstSched = currentShow.scheds.find(
          (sched) => sched.category_set_id === categorySet.category_set_id,
        );
        const seatAssignments: Record<string, string> = {};

        firstSched?.seatAssignments?.forEach((assignment) => {
          seatAssignments[assignment.seat_id] =
            assignment.set.seatCategory.category_name;
        });

        return {
          category_set_id: categorySet.category_set_id,
          seatmap_id: currentShow.seatmap_id,
          categories: categorySet.items.map((item) => ({
            category_name: item.seatCategory.category_name,
            price: item.seatCategory.price.toString(),
            color_code: item.seatCategory.color_code,
          })),
          seat_assignments: seatAssignments,
        };
      });

    const removedCategorySetIds = collectRemovedCategorySetIds({
      existingCategorySets: currentShow.categorySets.map((categorySet) => ({
        category_set_id: categorySet.category_set_id,
      })),
      nextCategorySets: normalizedCategorySets.map((setItem) => ({
        id: setItem.id,
      })),
    });

    const schedIdMap = new Map<string, string>(); // temp_id -> db_sched_id

    await prisma.$transaction(
      async (tx) => {
        if (shouldPurgeReservationData) {
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
            data: { seat_status: "OPEN" },
          });
          await tx.sched.updateMany({
            where: { show_id: showId },
            data: { status: null },
          });
        }

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
        const existingTicketTemplateIds = currentShow.ticketTemplateLinks?.length
          ? currentShow.ticketTemplateLinks.map(
              (link) => link.ticket_template_id,
            )
          : currentShow.ticket_template_id
            ? [currentShow.ticket_template_id]
            : [];
        const desiredTicketTemplateIds = normalizedTicketTemplateIds;
        const existingTicketTemplateIdSet = new Set(existingTicketTemplateIds);
        const desiredTicketTemplateIdSet = new Set(desiredTicketTemplateIds);
        const ticketTemplateIdsToRemove = existingTicketTemplateIds.filter(
          (ticketTemplateId) =>
            !desiredTicketTemplateIdSet.has(ticketTemplateId),
        );
        const ticketTemplateIdsToAdd = desiredTicketTemplateIds.filter(
          (ticketTemplateId) => !existingTicketTemplateIdSet.has(ticketTemplateId),
        );

        if (ticketTemplateIdsToRemove.length > 0) {
          await tx.$executeRaw(
            Prisma.sql`
              DELETE FROM "ShowTicketTemplate"
              WHERE "show_id" = ${showId}
                AND "ticket_template_id" IN (${Prisma.join(ticketTemplateIdsToRemove)})
            `,
          );
        }
        for (const ticketTemplateId of ticketTemplateIdsToAdd) {
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

        if (removedCategorySetIds.length > 0) {
          await tx.categorySetItem.deleteMany({
            where: { category_set_id: { in: removedCategorySetIds } },
          });
          await tx.sched.updateMany({
            where: { category_set_id: { in: removedCategorySetIds } },
            data: { category_set_id: null },
          });
          await tx.categorySet.deleteMany({
            where: { category_set_id: { in: removedCategorySetIds } },
          });
        }

        const existingSchedById = new Map<
          string,
          (typeof currentShow.scheds)[number]
        >(
          currentShow.scheds.map((sched) => [sched.sched_id, sched]),
        );
        const existingCategorySetById = new Map<
          string,
          (typeof currentShow.categorySets)[number]
        >(
          currentShow.categorySets.map((categorySet) => [
            categorySet.category_set_id,
            categorySet,
          ]),
        );
        const nextCategorySetStates: ShowStructureCategorySetState[] = [];
        const nextScheduleStates: ShowStructureScheduleState[] = [];
        const nextCategorySetIdBySchedId = new Map<string, string | null>();

        const existingCategories = trimmedSeatmapId
          ? await tx.seatCategory.findMany({
              where: {
                seatmap_id: trimmedSeatmapId,
                OR: uniqueCategories.map((c) => ({
                  category_name: c.category_name,
                  price: c.price,
                  color_code: c.color_code,
                })),
              },
            })
          : [];
        const existingCategoryMap = new Map<string, string>();
        existingCategories.forEach((category) => {
          existingCategoryMap.set(
            buildShowStructureCategoryKey({
              category_name: category.category_name,
              price: category.price.toString(),
              color_code: category.color_code,
            }),
            category.seat_category_id,
          );
        });

        const missingCategories = uniqueCategories.filter(
          (category) => !existingCategoryMap.has(buildShowStructureCategoryKey(category)),
        );
        if (missingCategories.length > 0 && trimmedSeatmapId) {
          await tx.seatCategory.createMany({
            data: missingCategories.map((category) => ({
              category_name: category.category_name,
              price: category.price,
              color_code: category.color_code,
              seatmap_id: trimmedSeatmapId,
            })),
            skipDuplicates: true,
          });
        }

        const allCategories = trimmedSeatmapId
          ? await tx.seatCategory.findMany({
              where: {
                seatmap_id: trimmedSeatmapId,
                OR: uniqueCategories.map((category) => ({
                  category_name: category.category_name,
                  price: category.price,
                  color_code: category.color_code,
                })),
              },
            })
          : [];
        const categoryIdLookup = new Map<string, string>();
        allCategories.forEach((category) => {
          categoryIdLookup.set(
            buildShowStructureCategoryKey({
              category_name: category.category_name,
              price: category.price.toString(),
              color_code: category.color_code,
            }),
            category.seat_category_id,
          );
        });

        for (const sched of scheds) {
          const existingSched = existingSchedById.get(sched.client_id);
          if (existingSched) {
            await tx.sched.update({
              where: { sched_id: existingSched.sched_id },
              data: {
                sched_date: toDateOnly(sched.sched_date),
                sched_start_time: toTime(sched.sched_start_time),
                sched_end_time: toTime(sched.sched_end_time),
              },
            });
            schedIdMap.set(sched.client_id, existingSched.sched_id);
            nextScheduleStates.push({
              sched_id: existingSched.sched_id,
              category_set_id: null,
            });
            continue;
          }

          const createdSched = await tx.sched.create({
            data: {
              show_id: showId,
              sched_date: toDateOnly(sched.sched_date),
              sched_start_time: toTime(sched.sched_start_time),
              sched_end_time: toTime(sched.sched_end_time),
            },
          });
          schedIdMap.set(sched.client_id, createdSched.sched_id);
          nextScheduleStates.push({
            sched_id: createdSched.sched_id,
            category_set_id: null,
          });
        }

        for (const setItem of normalizedCategorySets) {
          const resolvedCategorySetId = existingCategorySetById.has(setItem.id)
            ? setItem.id
            : (
                await tx.categorySet.create({
                  data: {
                    set_name: setItem.set_name,
                    show_id: showId,
                  },
                })
              ).category_set_id;
          if (existingCategorySetById.has(resolvedCategorySetId)) {
            const existingSet = existingCategorySetById.get(resolvedCategorySetId)!;
            if (existingSet.set_name !== setItem.set_name) {
              await tx.categorySet.update({
                where: { category_set_id: resolvedCategorySetId },
                data: { set_name: setItem.set_name },
              });
            }
          }

          const normalizedSeatAssignments = { ...setItem.seat_assignments };
          const nextCategorySetState: ShowStructureCategorySetState = {
            category_set_id: resolvedCategorySetId,
            seatmap_id: trimmedSeatmapId,
            categories: setItem.categories.map((category) => ({
              category_name: category.category_name.trim(),
              price: category.price,
              color_code: category.color_code,
            })),
            seat_assignments: normalizedSeatAssignments,
          };
          nextCategorySetStates.push(nextCategorySetState);

          for (const clientId of setItem.sched_ids) {
            const schedId = schedIdMap.get(clientId);
            if (!schedId) continue;
            nextCategorySetIdBySchedId.set(schedId, resolvedCategorySetId);
          }

          const existingSetState = existingCategorySetById.has(resolvedCategorySetId)
            ? {
                category_set_id: resolvedCategorySetId,
                seatmap_id: currentShow.seatmap_id,
                categories: existingCategorySetById
                  .get(resolvedCategorySetId)!
                  .items.map((item) => ({
                    category_name: item.seatCategory.category_name,
                    price: item.seatCategory.price.toString(),
                    color_code: item.seatCategory.color_code,
                  })),
                seat_assignments: (() => {
                  const seatAssignments: Record<string, string> = {};
                  const firstSched = currentShow.scheds.find(
                    (sched) => sched.category_set_id === resolvedCategorySetId,
                  );
                  firstSched?.seatAssignments?.forEach((assignment) => {
                    seatAssignments[assignment.seat_id] =
                      assignment.set.seatCategory.category_name;
                  });
                  return seatAssignments;
                })(),
              }
            : null;

          const existingCategoryItemSignature = existingSetState
            ? existingSetState.categories
                .map((category) => buildShowStructureCategoryKey(category))
                .sort()
                .join("|")
            : null;
          const nextCategoryItemSignature = nextCategorySetState.categories
            .map((category) => buildShowStructureCategoryKey(category))
            .sort()
            .join("|");

          if (
            !existingSetState ||
            existingCategoryItemSignature !== nextCategoryItemSignature
          ) {
            if (existingCategorySetById.has(resolvedCategorySetId)) {
              await tx.categorySetItem.deleteMany({
                where: { category_set_id: resolvedCategorySetId },
              });
            }

            const desiredItemRows = setItem.categories
              .map((category) => {
                const seatCategoryId = categoryIdLookup.get(
                  buildShowStructureCategoryKey({
                    category_name: category.category_name.trim(),
                    price: category.price,
                    color_code: category.color_code,
                  }),
                );
                return seatCategoryId
                  ? {
                      category_set_id: resolvedCategorySetId,
                      seat_category_id: seatCategoryId,
                    }
                  : null;
              })
              .filter(
                (
                  item,
                ): item is {
                  category_set_id: string;
                  seat_category_id: string;
                } => Boolean(item),
              );

            if (desiredItemRows.length > 0) {
              await tx.categorySetItem.createMany({
                data: desiredItemRows,
                skipDuplicates: true,
              });
            }
          }
        }

        const schedIdsByCategorySetId = new Map<string, string[]>();
        const schedIdsWithoutCategorySet: string[] = [];
        for (const [schedId, categorySetId] of nextCategorySetIdBySchedId.entries()) {
          if (categorySetId) {
            const schedIds = schedIdsByCategorySetId.get(categorySetId) ?? [];
            schedIds.push(schedId);
            schedIdsByCategorySetId.set(categorySetId, schedIds);
          } else {
            schedIdsWithoutCategorySet.push(schedId);
          }
        }

        for (const [categorySetId, schedIds] of schedIdsByCategorySetId.entries()) {
          await tx.sched.updateMany({
            where: { sched_id: { in: schedIds } },
            data: { category_set_id: categorySetId },
          });
        }
        if (schedIdsWithoutCategorySet.length > 0) {
          await tx.sched.updateMany({
            where: { sched_id: { in: schedIdsWithoutCategorySet } },
            data: { category_set_id: null },
          });
        }

        const removedSchedIds = currentShow.scheds
          .map((sched) => sched.sched_id)
          .filter((schedId) => !schedIdMap.has(schedId));

        for (const schedId of schedIdMap.values()) {
          if (!nextCategorySetIdBySchedId.has(schedId)) {
            nextCategorySetIdBySchedId.set(schedId, null);
          }
        }

        nextScheduleStates.forEach((state) => {
          state.category_set_id =
            nextCategorySetIdBySchedId.get(state.sched_id) ?? null;
        });

        const nextScheduleStatesById = new Map<string, ShowStructureScheduleState>(
          nextScheduleStates.map((state) => [state.sched_id, state]),
        );
        const nextCategorySetStatesById = new Map<
          string,
          ShowStructureCategorySetState
        >(
          nextCategorySetStates.map((state) => [
            state.category_set_id,
            state,
          ]),
        );

        const affectedSchedIds = collectAffectedScheduleIdsForDerivedRows({
          previousSchedules: previousScheduleStates,
          nextSchedules: [...nextScheduleStatesById.values()],
          previousCategorySets: previousCategorySetStates,
          nextCategorySets: nextCategorySetStates,
        });

        if (affectedSchedIds.length > 0) {
          await tx.seatAssignment.deleteMany({
            where: { sched_id: { in: affectedSchedIds } },
          });
          await tx.set.deleteMany({
            where: { sched_id: { in: affectedSchedIds } },
          });

          const setRows: Array<{ sched_id: string; seat_category_id: string }> = [];
          for (const schedId of affectedSchedIds) {
            const nextSchedule = nextScheduleStatesById.get(schedId);
            if (!nextSchedule?.category_set_id) continue;

            const nextCategorySetState = nextCategorySetStatesById.get(
              nextSchedule.category_set_id,
            );
            if (!nextCategorySetState) continue;

            for (const category of nextCategorySetState.categories) {
              const seatCategoryId = categoryIdLookup.get(
                buildShowStructureCategoryKey(category),
              );
              if (!seatCategoryId) continue;
              setRows.push({ sched_id: schedId, seat_category_id: seatCategoryId });
            }
          }

          if (setRows.length > 0) {
            await tx.set.createMany({
              data: setRows,
              skipDuplicates: true,
            });
          }

          const createdSets = await tx.set.findMany({
            where: { sched_id: { in: affectedSchedIds } },
          });
          const setLookup = new Map<string, string>();
          createdSets.forEach((row) => {
            setLookup.set(`${row.sched_id}:${row.seat_category_id}`, row.set_id);
          });

          const seatAssignmentRows: Array<{
            seat_id: string;
            sched_id: string;
            set_id: string;
            seat_status: "OPEN";
          }> = [];

          for (const schedId of affectedSchedIds) {
            const nextSchedule = nextScheduleStatesById.get(schedId);
            if (!nextSchedule?.category_set_id) continue;

            const nextCategorySetState = nextCategorySetStatesById.get(
              nextSchedule.category_set_id,
            );
            if (!nextCategorySetState) continue;

            for (const [seatId, categoryName] of Object.entries(
              nextCategorySetState.seat_assignments,
            )) {
              const normalizedCategoryName = categoryName.trim().toLowerCase();
              const matchedCategory = nextCategorySetState.categories.find(
                (category) =>
                  category.category_name.trim().toLowerCase() ===
                  normalizedCategoryName,
              );
              if (!matchedCategory) continue;

              const seatCategoryId = categoryIdLookup.get(
                buildShowStructureCategoryKey(matchedCategory),
              );
              if (!seatCategoryId) continue;

              const setId = setLookup.get(`${schedId}:${seatCategoryId}`);
              if (!setId) continue;

              seatAssignmentRows.push({
                seat_id: seatId,
                sched_id: schedId,
                set_id: setId,
                seat_status: "OPEN",
              });
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

        if (removedSchedIds.length > 0) {
          await tx.seatAssignment.deleteMany({
            where: { sched_id: { in: removedSchedIds } },
          });
          await tx.set.deleteMany({
            where: { sched_id: { in: removedSchedIds } },
          });
          await tx.sched.deleteMany({
            where: { sched_id: { in: removedSchedIds } },
          });
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


