import { prisma } from "@/lib/prisma";
import { Prisma, ReservationStatus, type ShowStatus } from "@prisma/client";
import {
  getEffectiveSchedStatus,
  getEffectiveShowStatus,
} from "@/lib/shows/effectiveStatus";

type AdminScope = {
  teamId: string | null;
  isSuperadmin: boolean;
};

export async function getShows(params?: {
  status?: string;
  statusGroup?: "active";
  visibility?: "user" | "admin";
  sort?: string;
  seatmapId?: string;
  query?: string;
  adminScope?: AdminScope;
}) {
  const where: Prisma.ShowWhereInput = {};
  if (params?.status && params.status !== "ALL") {
    where.show_status = params.status as never;
  } else if (params?.statusGroup === "active") {
    where.show_status = { in: ["UPCOMING", "OPEN", "ON_GOING"] };
  }
  if (params?.visibility === "user") {
    const hiddenStatuses: ShowStatus[] = ["DRAFT", "CANCELLED"];
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
  if (params?.visibility !== "user") {
    const adminScope = params?.adminScope;
    if (!adminScope) {
      throw new Error("Missing admin scope for admin show query.");
    }
    if (!adminScope.isSuperadmin) {
      if (!adminScope.teamId) {
        return [];
      }
      where.team_id = adminScope.teamId;
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
          sched_id: true,
          sched_date: true,
          sched_start_time: true,
          sched_end_time: true,
          status: true,
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

  const derivedShows = shows.map((show) => ({
    ...show,
    show_status: getEffectiveShowStatus(show),
  }));

  if (params?.status && params.status !== "ALL") {
    return derivedShows.filter((show) => show.show_status === params.status);
  }

  if (params?.statusGroup === "active") {
    return derivedShows.filter((show) =>
      ["UPCOMING", "OPEN", "ON_GOING"].includes(show.show_status),
    );
  }

  return derivedShows;
}

export async function getShowById(showId: string) {
  const [show, blockingReservationCount] = await prisma.$transaction([
    prisma.show.findUnique({
      where: { show_id: showId },
      include: {
        _count: {
          select: {
            reservations: true,
          },
        },
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
    }),
    prisma.reservation.count({
      where: {
        show_id: showId,
        status: {
          in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
        },
      },
    }),
  ]);

  if (!show) {
    return null;
  }

  let linkedTemplateIds: string[] = [];
  try {
    const rows = await prisma.$queryRaw<Array<{ ticket_template_id: string }>>(
      Prisma.sql`
        SELECT "ticket_template_id"
        FROM "ShowTicketTemplate"
        WHERE "show_id" = ${showId}
        ORDER BY "createdAt" ASC
      `,
    );
    linkedTemplateIds = rows.map((row) => row.ticket_template_id);
  } catch {
    // Backward compatibility: older DB/client states may not have the join table yet.
    linkedTemplateIds = [];
  }

  const orderedTemplateIds =
    linkedTemplateIds.length > 0
      ? linkedTemplateIds
      : show.ticket_template_id
        ? [show.ticket_template_id]
        : [];

  const templates = orderedTemplateIds.length
    ? await prisma.ticketTemplate.findMany({
        where: {
          ticket_template_id: {
            in: orderedTemplateIds,
          },
        },
        select: {
          ticket_template_id: true,
          template_name: true,
          versions: {
            orderBy: { version_number: "desc" },
            take: 1,
            select: {
              version_number: true,
            },
          },
        },
      })
    : [];

  const templateById = new Map(
    templates.map((template) => [template.ticket_template_id, template]),
  );
  const ticket_templates = orderedTemplateIds
    .map((templateId) => {
      const template = templateById.get(templateId);
      if (!template) return null;
      return {
        ticket_template_id: template.ticket_template_id,
        template_name: template.template_name,
        latestVersionNumber: template.versions[0]?.version_number ?? null,
      };
    })
    .filter((template): template is NonNullable<typeof template> => Boolean(template));

  return {
    ...show,
    ticket_templates,
    blockingReservationCount,
    show_status: getEffectiveShowStatus(show),
    scheds: show.scheds.map((sched) => ({
      ...sched,
      effective_status: getEffectiveSchedStatus(sched),
    })),
  };
}
