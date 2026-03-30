import type {
  PaymentStatus,
  Prisma,
  PrismaClient,
  ReservationStatus,
  SchedStatus,
  ShowStatus,
} from "@prisma/client";

import { prisma } from "../prisma.ts";
import {
  getEffectiveSchedStatus,
  getEffectiveShowStatus,
} from "../shows/effectiveStatus.ts";

import { buildDashboardWindows } from "./dashboardFilters.ts";
import { getDashboardFilterOptions } from "./getDashboardFilterOptions.ts";
import {
  DASHBOARD_METRIC_DATE_FIELDS,
  type AdminDashboardData,
  type AdminDashboardFilterOptions,
  type DashboardAdminScope,
  type DashboardRecentReservation,
  type DashboardScheduleStatusTotals,
  type DashboardSearchParams,
  type DashboardShowStatusTotals,
  type NormalizedDashboardFilters,
} from "./types.ts";

type ReservationGroupRow = {
  status: ReservationStatus;
  _count: { _all: number };
};

type PaymentGroupRow = {
  status: PaymentStatus;
  _count: { _all: number };
};

type RevenueRow = {
  amount: number;
  reservation: {
    show: {
      show_id: string;
      show_name: string;
    };
  };
};

type ScheduleStatusRecord = {
  sched_id: string;
  sched_date: Date | string;
  sched_start_time: Date | string;
  sched_end_time: Date | string;
  status: SchedStatus | null;
  show: {
    show_id: string;
    show_name: string;
  };
};

type ShowStatusRecord = {
  show_id: string;
  show_name: string;
  show_status: ShowStatus;
  team: {
    name: string;
  } | null;
  scheds: Array<{
    sched_id: string;
    sched_date: Date | string;
    sched_start_time: Date | string;
    sched_end_time: Date | string;
    status: SchedStatus | null;
  }>;
};

type RecentReservationRecord = {
  reservation_id: string;
  reservation_number: string;
  first_name: string;
  last_name: string;
  createdAt: Date;
  status: ReservationStatus;
  show: {
    show_id: string;
    show_name: string;
    team: {
      name: string;
    } | null;
  };
  sched: {
    sched_id: string;
    sched_date: Date;
    sched_start_time: Date;
  };
  payment: {
    status: PaymentStatus;
    amount: { toString(): string };
  } | null;
};

export type DashboardAggregationInput = {
  filters: NormalizedDashboardFilters;
  filterOptions: AdminDashboardFilterOptions;
  reservationStatusRows: ReservationGroupRow[];
  paymentStatusRows: PaymentGroupRow[];
  paidRevenue: {
    amount: number;
    count: number;
  };
  schedules: ScheduleStatusRecord[];
  shows: ShowStatusRecord[];
  reservationTopShowRows: Array<{
    show_id: string;
    _count: { _all: number };
  }>;
  paidRevenueRows: RevenueRow[];
  recentReservations: RecentReservationRecord[];
};

type GetAdminDashboardDataArgs = {
  filters: NormalizedDashboardFilters;
  adminScope: DashboardAdminScope;
  db?: PrismaClient;
};

const DEFAULT_RESERVATION_COUNTS: Record<ReservationStatus, number> = {
  PENDING: 0,
  CONFIRMED: 0,
  CANCELLED: 0,
  EXPIRED: 0,
};

const DEFAULT_PAYMENT_COUNTS: Record<PaymentStatus, number> = {
  PENDING: 0,
  PAID: 0,
  FAILED: 0,
  REFUNDED: 0,
};

const DEFAULT_SHOW_STATUS_TOTALS: DashboardShowStatusTotals = {
  DRAFT: 0,
  UPCOMING: 0,
  OPEN: 0,
  ON_GOING: 0,
  CLOSED: 0,
  CANCELLED: 0,
};

const DEFAULT_SCHEDULE_STATUS_TOTALS: DashboardScheduleStatusTotals = {
  OPEN: 0,
  ON_GOING: 0,
  FULLY_BOOKED: 0,
  CLOSED: 0,
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }
  if (value && typeof value === "object" && "toString" in value) {
    return Number(value.toString());
  }
  return 0;
};

const buildScopedShowWhere = (
  filters: NormalizedDashboardFilters,
): Prisma.ShowWhereInput | undefined => {
  const where: Prisma.ShowWhereInput = {};

  if (filters.effectiveTeamId) {
    where.team_id = filters.effectiveTeamId;
  }

  if (filters.showId) {
    where.show_id = filters.showId;
  }

  return Object.keys(where).length > 0 ? where : undefined;
};

const buildShowWindowWhere = (
  filters: NormalizedDashboardFilters,
  scheduleWindow: { gte: Date; lt: Date },
): Prisma.ShowWhereInput | undefined => {
  const baseWhere = buildScopedShowWhere(filters) ?? {};

  return {
    ...baseWhere,
    scheds: {
      some: {
        sched_date: {
          gte: scheduleWindow.gte,
          lt: scheduleWindow.lt,
        },
      },
    },
  };
};

const validateShowFilter = (
  filters: NormalizedDashboardFilters,
  filterOptions: AdminDashboardFilterOptions,
) => {
  const hasSelectedShow =
    filters.showId !== null &&
    filterOptions.shows.some((show) => show.value === filters.showId);

  return hasSelectedShow ? filters : { ...filters, showId: null };
};

const sortTopShows = <T extends { reservationCount: number; paidRevenue: number; showName: string }>(
  items: T[],
  metric: "reservationCount" | "paidRevenue",
) =>
  [...items]
    .sort((left, right) => right[metric] - left[metric] || left.showName.localeCompare(right.showName))
    .slice(0, 5);

export function buildAdminDashboardData({
  filters,
  filterOptions,
  reservationStatusRows,
  paymentStatusRows,
  paidRevenue,
  schedules,
  shows,
  reservationTopShowRows,
  paidRevenueRows,
  recentReservations,
}: DashboardAggregationInput): AdminDashboardData {
  const reservationCounts = { ...DEFAULT_RESERVATION_COUNTS };
  for (const row of reservationStatusRows) {
    reservationCounts[row.status] = row._count._all;
  }

  const paymentCounts = { ...DEFAULT_PAYMENT_COUNTS };
  for (const row of paymentStatusRows) {
    paymentCounts[row.status] = row._count._all;
  }

  const showStatusTotals = { ...DEFAULT_SHOW_STATUS_TOTALS };
  for (const show of shows) {
    const effectiveStatus = getEffectiveShowStatus(show);
    showStatusTotals[effectiveStatus] += 1;
  }

  const scheduleStatusTotals = { ...DEFAULT_SCHEDULE_STATUS_TOTALS };
  for (const schedule of schedules) {
    const effectiveStatus = getEffectiveSchedStatus(schedule);
    scheduleStatusTotals[effectiveStatus] += 1;
  }

  const topShows = new Map<
    string,
    {
      showId: string;
      showName: string;
      reservationCount: number;
      paidRevenue: number;
    }
  >();

  for (const row of reservationTopShowRows) {
    const existing = topShows.get(row.show_id);
    const showName =
      shows.find((show) => show.show_id === row.show_id)?.show_name ??
      filterOptions.shows.find((show) => show.value === row.show_id)?.label ??
      row.show_id;

    topShows.set(row.show_id, {
      showId: row.show_id,
      showName,
      reservationCount: row._count._all,
      paidRevenue: existing?.paidRevenue ?? 0,
    });
  }

  for (const row of paidRevenueRows) {
    const showId = row.reservation.show.show_id;
    const current = topShows.get(showId) ?? {
      showId,
      showName: row.reservation.show.show_name,
      reservationCount: 0,
      paidRevenue: 0,
    };

    current.paidRevenue += row.amount;
    topShows.set(showId, current);
  }

  const rankedShows = Array.from(topShows.values());

  const prioritizedReservations = [...recentReservations].sort((left, right) => {
    if (left.status === "PENDING" && right.status !== "PENDING") {
      return -1;
    }
    if (left.status !== "PENDING" && right.status === "PENDING") {
      return 1;
    }
    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  const normalizedRecentReservations: DashboardRecentReservation[] = prioritizedReservations
    .slice(0, 8)
    .map((reservation) => ({
      id: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
      guestName: `${reservation.first_name} ${reservation.last_name}`.trim(),
      showId: reservation.show.show_id,
      showName: reservation.show.show_name,
      teamName: reservation.show.team?.name ?? null,
      schedId: reservation.sched.sched_id,
      schedDate: reservation.sched.sched_date,
      schedStartTime: reservation.sched.sched_start_time,
      createdAt: reservation.createdAt,
      status: reservation.status,
      paymentStatus: reservation.payment?.status ?? null,
      paymentAmount: reservation.payment ? toNumber(reservation.payment.amount) : null,
    }));

  return {
    filters,
    filterOptions,
    metricDateFields: DASHBOARD_METRIC_DATE_FIELDS,
    summary: {
      pendingReview: reservationCounts.PENDING,
      confirmedReservations: reservationCounts.CONFIRMED,
      paidRevenue: paidRevenue.amount,
      activeSchedules: scheduleStatusTotals.OPEN + scheduleStatusTotals.ON_GOING + scheduleStatusTotals.FULLY_BOOKED,
    },
    reservationBreakdown: {
      total: Object.values(reservationCounts).reduce((sum, value) => sum + value, 0),
      statuses: reservationCounts,
    },
    paymentSummary: {
      total: Object.values(paymentCounts).reduce((sum, value) => sum + value, 0),
      paidRevenue: paidRevenue.amount,
      paidCount: paidRevenue.count,
      statuses: paymentCounts,
    },
    showStatusTotals,
    scheduleStatusTotals,
    topShowsByReservations: sortTopShows(rankedShows, "reservationCount"),
    topShowsByRevenue: sortTopShows(rankedShows, "paidRevenue"),
    recentReservations: normalizedRecentReservations,
  };
}

export async function getAdminDashboardData({
  filters,
  adminScope,
  db = prisma,
}: GetAdminDashboardDataArgs): Promise<AdminDashboardData> {
  const initialFilterOptions = await getDashboardFilterOptions({
    adminScope,
    teamId: filters.effectiveTeamId,
    db,
  });
  const effectiveFilters = validateShowFilter(filters, initialFilterOptions);
  const filterOptions =
    effectiveFilters.showId === filters.showId
      ? initialFilterOptions
      : {
          ...initialFilterOptions,
          shows: initialFilterOptions.shows,
        };

  const windows = buildDashboardWindows(effectiveFilters);
  const scopedShowWhere = buildScopedShowWhere(effectiveFilters);
  const showWindowWhere = buildShowWindowWhere(effectiveFilters, windows.scheduleDates);

  const [
    reservationStatusRows,
    paymentStatusRows,
    paidRevenueAggregate,
    schedules,
    shows,
    reservationTopShowRows,
    paidRevenueRows,
    recentReservations,
  ] = await Promise.all([
    db.reservation.groupBy({
      by: ["status"],
      where: {
        createdAt: windows.timestamps,
        ...(scopedShowWhere ? { show: scopedShowWhere } : {}),
      },
      _count: { _all: true },
    }),
    db.payment.groupBy({
      by: ["status"],
      where: {
        createdAt: windows.timestamps,
        ...(scopedShowWhere
          ? {
              reservation: {
                show: scopedShowWhere,
              },
            }
          : {}),
      },
      _count: { _all: true },
    }),
    db.payment.aggregate({
      where: {
        status: "PAID",
        paid_at: windows.timestamps,
        ...(scopedShowWhere
          ? {
              reservation: {
                show: scopedShowWhere,
              },
            }
          : {}),
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.sched.findMany({
      where: {
        sched_date: windows.scheduleDates,
        ...(scopedShowWhere ? { show: scopedShowWhere } : {}),
      },
      select: {
        sched_id: true,
        sched_date: true,
        sched_start_time: true,
        sched_end_time: true,
        status: true,
        show: {
          select: {
            show_id: true,
            show_name: true,
          },
        },
      },
    }),
    db.show.findMany({
      where: showWindowWhere,
      select: {
        show_id: true,
        show_name: true,
        show_status: true,
        team: {
          select: {
            name: true,
          },
        },
        scheds: {
          where: {
            sched_date: windows.scheduleDates,
          },
          select: {
            sched_id: true,
            sched_date: true,
            sched_start_time: true,
            sched_end_time: true,
            status: true,
          },
        },
      },
    }),
    db.reservation.groupBy({
      by: ["show_id"],
      where: {
        createdAt: windows.timestamps,
        ...(scopedShowWhere ? { show: scopedShowWhere } : {}),
      },
      _count: { _all: true },
    }),
    db.payment.findMany({
      where: {
        status: "PAID",
        paid_at: windows.timestamps,
        ...(scopedShowWhere
          ? {
              reservation: {
                show: scopedShowWhere,
              },
            }
          : {}),
      },
      select: {
        amount: true,
        reservation: {
          select: {
            show: {
              select: {
                show_id: true,
                show_name: true,
              },
            },
          },
        },
      },
    }),
    db.reservation.findMany({
      where: {
        createdAt: windows.timestamps,
        ...(scopedShowWhere ? { show: scopedShowWhere } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
      select: {
        reservation_id: true,
        reservation_number: true,
        first_name: true,
        last_name: true,
        createdAt: true,
        status: true,
        payment: {
          select: {
            status: true,
            amount: true,
          },
        },
        show: {
          select: {
            show_id: true,
            show_name: true,
            team: {
              select: {
                name: true,
              },
            },
          },
        },
        sched: {
          select: {
            sched_id: true,
            sched_date: true,
            sched_start_time: true,
          },
        },
      },
    }),
  ]);

  return buildAdminDashboardData({
    filters: effectiveFilters,
    filterOptions,
    reservationStatusRows,
    paymentStatusRows,
    paidRevenue: {
      amount: toNumber(paidRevenueAggregate._sum.amount),
      count: paidRevenueAggregate._count._all,
    },
    schedules,
    shows,
    reservationTopShowRows,
    paidRevenueRows: paidRevenueRows.map((row) => ({
      amount: toNumber(row.amount),
      reservation: row.reservation,
    })),
    recentReservations,
  });
}
