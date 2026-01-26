"use server";

import "server-only";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const toDateOnly = (value: string | Date) => {
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    return new Date(`${value}T00:00:00`);
};

const toTime = (value: string | Date) => {
    if (value instanceof Date) {
        const hours = `${value.getHours()}`.padStart(2, "0");
        const minutes = `${value.getMinutes()}`.padStart(2, "0");
        return new Date(`1970-01-01T${hours}:${minutes}:00`);
    }
    return new Date(`1970-01-01T${value}:00`);
};

export async function updateShowAction(showId: string, data: any) {
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

        const { show_name, show_description, venue, address, show_status, show_start_date, show_end_date, scheds } = data;

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
                    show_start_date: new Date(show_start_date),
                    show_end_date: new Date(show_end_date),
                }
            });

            // 2. Clear existing schedules for this show to sync with the new list
            // (Alternatively, we could do more complex diffing, but clearing and re-adding is simpler for this flow)
            await tx.sched.deleteMany({
                where: { show_id: showId }
            });

            // 3. Add new schedules
            if (scheds && scheds.length > 0) {
                await tx.sched.createMany({
                    data: scheds.map((s: any) => ({
                        show_id: showId,
                        sched_date: toDateOnly(s.sched_date),
                        sched_start_time: toTime(s.sched_start_time),
                        sched_end_time: toTime(s.sched_end_time),
                    }))
                });
            }
        });

        revalidatePath("/admin/shows");
        revalidatePath(`/admin/shows/${showId}`);

        return { success: true };
    } catch (error: any) {
        console.error("Error in updateShowAction:", error);
        return { success: false, error: error.message || "Failed to update show" };
    }
}
