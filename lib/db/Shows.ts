import { prisma } from "@/lib/prisma";
import type { Prisma, ShowStatus } from "@prisma/client";

export async function getShows(params?: {
  status?: string;
  statusGroup?: "active";
  visibility?: "user" | "admin";
  sort?: string;
  seatmapId?: string;
  query?: string;
}) {
  const where: Prisma.ShowWhereInput = {};
  if (params?.status && params.status !== "ALL") {
    where.show_status = params.status as never;
  } else if (params?.statusGroup === "active") {
    where.show_status = { in: ["UPCOMING", "OPEN"] };
  }
  if (params?.visibility === "user") {
    const hiddenStatuses: ShowStatus[] = ["DRAFT", "CANCELLED", "POSTPONED"];
    if (where.show_status) {
      const statusValue =
        typeof where.show_status === "string"
          ? where.show_status
          : undefined;
      if (statusValue && hiddenStatuses.includes(statusValue)) {
        return [];
      }
    } else {
      where.show_status = { notIn: hiddenStatuses };
    }
  }
  if (params?.seatmapId) {
    where.seatmap_id = params.seatmapId;
  }
  if (params?.query) {
    const query = params.query.trim();
    if (query) {
      where.show_name = { contains: query, mode: "insensitive" };
    }
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
        include: {
          seatAssignments: {
            include: {
              set: {
                include: {
                  seatCategory: true,
                },
              },
            },
          },
        },
        orderBy: { sched_start_time: "asc" },
      },
      categorySets: {
        include: {
          items: {
            include: {
              seatCategory: true,
            },
          },
        },
      },
    },
  });
}
