import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getSeatmaps(params?: { query?: string; sort?: string }) {
  // Force TS Re-eval
  const where: Prisma.SeatmapWhereInput = {};

  if (params?.query) {
    const query = params.query.trim();
    if (query) {
      where.OR = [
        { seatmap_name: { contains: query, mode: "insensitive" } },
        { shows: { some: { show_name: { contains: query, mode: "insensitive" } } } },
        { shows: { some: { venue: { contains: query, mode: "insensitive" } } } },
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
      shows: true,
    },
    orderBy,
  });
}

export async function getActiveSeatmaps() {
  return prisma.seatmap.findMany({
    where: { seatmap_status: "ACTIVE" },
    select: {
      seatmap_id: true,
      seatmap_name: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}
