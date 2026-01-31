"use server";

import "server-only";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma, ShowStatus } from "@prisma/client";

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

const toTime = (value: string | Date) => {
    if (typeof value === "string") {
        return new Date(`1970-01-01T${value}:00+08:00`);
    }
    const timeKey = toManilaTimeKey(value);
    return new Date(`1970-01-01T${timeKey}:00+08:00`);
};

type UpdateShowSched = {
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
    show_status: ShowStatus;
    show_start_date: string | Date;
    show_end_date: string | Date;
    seatmap_id?: string | null;
    scheds?: UpdateShowSched[];
    category_sets?: UpdateCategorySet[];
};

export async function updateShowAction(showId: string, data: UpdateShowPayload) {
    try {
        const { adminAuth } = await import("@/lib/firebaseAdmin");
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        if (!sessionCookie) {
            throw new Error("Unauthorized");
        }

        // Verify session to ensure user is admin
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
        const user = await prisma.user.findUnique({
            where: { firebase_uid: decodedToken.uid }
        });

        if (user?.role !== "ADMIN") {
            throw new Error("Forbidden");
        }

        const { show_name, show_description, venue, address, show_status, show_start_date, show_end_date, seatmap_id, scheds = [], category_sets = [] } = data;

        // Transaction to update show, schedules, and category sets
        await prisma.$transaction(async (tx) => {
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
                    seatmap_id: seatmap_id || undefined,
                }
            });

            // 2. Clear existing schedules, category sets, and related data
            await tx.seatAssignment.deleteMany({
                where: { sched: { show_id: showId } }
            });
            await tx.set.deleteMany({
                where: { sched: { show_id: showId } }
            });
            await tx.categorySetItem.deleteMany({
                where: { categorySet: { show_id: showId } }
            });
            await tx.categorySet.deleteMany({
                where: { show_id: showId }
            });
            await tx.sched.deleteMany({
                where: { show_id: showId }
            });

            // 3. Create new schedules
            const schedIdMap = new Map<string, string>(); // temp_id -> db_sched_id
            if (scheds && scheds.length > 0) {
                for (let i = 0; i < scheds.length; i++) {
                    const sched = scheds[i];
                    const createdSched = await tx.sched.create({
                        data: {
                            show_id: showId,
                            sched_date: toDateOnly(sched.sched_date),
                            sched_start_time: toTime(sched.sched_start_time),
                            sched_end_time: toTime(sched.sched_end_time),
                        },
                    });
                    // Use index as temp ID
                    schedIdMap.set(`${toManilaDateKey(toDateOnly(sched.sched_date))}_${sched.sched_start_time}`, createdSched.sched_id);
                }
            }

            // 4. Create category sets if provided
            if (category_sets.length > 0 && seatmap_id) {
                const allDbSchedIds = Array.from(schedIdMap.values());

                // Create/Reuse Categories
                const flatCategories = category_sets.flatMap((setItem) => setItem.categories);
                const uniqueCategoryMap = new Map<string, typeof flatCategories[number]>();
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

                // Create Category Sets
                for (let index = 0; index < category_sets.length; index += 1) {
                    const setItem = category_sets[index];
                    const setName = setItem.set_name?.trim() || `Set ${index + 1}`;

                    const createdSet = await tx.categorySet.create({
                        data: {
                            set_name: setName,
                            show_id: showId,
                        },
                    });

                    // Determine target schedules
                    const targetSchedIds = setItem.apply_to_all
                        ? allDbSchedIds
                        : setItem.sched_ids
                            .map((tempId) => {
                                // Find matching sched by reconstructing temp ID
                                for (const [key, dbId] of schedIdMap.entries()) {
                                    if (tempId.includes(key) || key.includes(tempId)) {
                                        return dbId;
                                    }
                                }
                                return null;
                            })
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

                for (const setItem of category_sets) {
                    if (!setItem.seat_assignments) continue;

                    const targetSchedIds = setItem.apply_to_all
                        ? allDbSchedIds
                        : setItem.sched_ids
                            .map((tempId) => {
                                for (const [key, dbId] of schedIdMap.entries()) {
                                    if (tempId.includes(key) || key.includes(tempId)) {
                                        return dbId;
                                    }
                                }
                                return null;
                            })
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
        }, {
            maxWait: 5000,
            timeout: 20000,
        });

        revalidatePath("/admin/shows");
        revalidatePath(`/admin/shows/${showId}`);

        return { success: true };
    } catch (error: unknown) {
        console.error("Error in updateShowAction:", error);
        const message =
            error instanceof Error ? error.message : "Failed to update show";
        return { success: false, error: message };
    }
}
