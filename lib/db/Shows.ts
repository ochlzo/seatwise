import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getShows(params?: { status?: string; sort?: string; seatmapId?: string }) {
  const where: Prisma.ShowWhereInput = {};
  if (params?.status && params.status !== "ALL") {
    where.show_status = params.status as never;
  }
  if (params?.seatmapId) {
    where.seatmap_id = params.seatmapId;
  }

  let orderBy: Prisma.ShowOrderByWithRelationInput = { createdAt: "desc" };
  if (params?.sort === "oldest") {
    orderBy = { createdAt: "asc" };
  }

  const shows = await prisma.show.findMany({
    where,
    include: {
      scheds: {
        select: {
          sched_start_time: true,
          sched_end_time: true,
        },
        orderBy: {
          sched_start_time: "asc",
        },
      },
      _count: {
        select: { scheds: true },
      },
    },
    orderBy,
  });

  return shows;
}

export async function getShowById(showId: string) {
  return prisma.show.findUnique({
    where: { show_id: showId },
    include: {
      scheds: {
        orderBy: { sched_start_time: "asc" },
      },
    },
  });
}
