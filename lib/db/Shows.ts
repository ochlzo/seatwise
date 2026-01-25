import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getShows() {
    const shows = await prisma.show.findMany({
        include: {
            _count: {
                select: { scheds: true }
            }
        },
        orderBy: { createdAt: "desc" },
    });

    return shows;
}

export async function getShowById(showId: string) {
    return prisma.show.findUnique({
        where: { show_id: showId },
        include: {
            scheds: {
                orderBy: { sched_start_time: "asc" }
            }
        }
    });
}
