import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getSeatmaps(params?: { query?: string; sort?: string }) {
  const where: Prisma.SeatmapWhereInput = {};

  if (params?.query) {
    const query = params.query.trim();
    if (query) {
      where.OR = [
        { seatmap_name: { contains: query, mode: "insensitive" } },
        { sched: { show: { show_name: { contains: query, mode: "insensitive" } } } },
        { sched: { show: { venue: { contains: query, mode: "insensitive" } } } },
      ];
    }
  }

  let orderBy: Prisma.SeatmapOrderByWithRelationInput = { createdAt: "desc" };
  if (params?.sort === "oldest") {
    orderBy = { createdAt: "asc" };
  }

  return prisma.seatmap.findMany({
    where,
    include: {
      scheds: {
        include: {
          show: true,
        },
      },
    },
    orderBy,
  });
}
