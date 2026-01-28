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
};

export async function updateShowAction(showId: string, data: UpdateShowPayload) {
    try {
        const { adminAuth } = await import("@/lib/firebaseAdmin");
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        if (!sessionCookie) {
            throw new Error("Unauthorized");
        }

        // Verify session to ensure user is admin (verifyAdmin is already used in layout, but double check here)
        const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
        const user = await prisma.user.findUnique({
            where: { firebase_uid: decodedToken.uid }
        });

        if (user?.role !== "ADMIN") {
            throw new Error("Forbidden");
        }

        const { show_name, show_description, venue, address, show_status, show_start_date, show_end_date, seatmap_id, scheds } = data;

        // Transaction to update show and its schedules
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
                    seatmap_id: seatmap_id || null,
                }
            });

            // 2. Clear existing schedules for this show to sync with the new list
            // (Alternatively, we could do more complex diffing, but clearing and re-adding is simpler for this flow)
            await tx.sched.deleteMany({
                where: { show_id: showId }
            });

            // 3. Add new schedules
            if (scheds && scheds.length > 0) {
                const schedData = scheds.map((s) => ({
                    show_id: showId,
                    sched_date: toDateOnly(s.sched_date),
                    sched_start_time: toTime(s.sched_start_time),
                    sched_end_time: toTime(s.sched_end_time),
                })) as Prisma.SchedCreateManyInput[];
                await tx.sched.createMany({
                    data: schedData,
                });
            }
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
