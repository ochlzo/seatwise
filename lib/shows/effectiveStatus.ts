import {
  ReservationStatus,
  type Prisma,
  type SchedStatus,
  type ShowStatus,
} from "@prisma/client";
import { isSchedStatusReservable } from "./reservationEligibility.ts";

const MANILA_TZ = "Asia/Manila";

type ScheduleForStatus = {
  sched_date: Date | string;
  sched_start_time: Date | string;
  sched_end_time: Date | string;
  status?: SchedStatus | null;
};

type ShowForStatus<TSchedule extends ScheduleForStatus = ScheduleForStatus> = {
  show_status: ShowStatus;
  scheds: TSchedule[];
};

const formatDateKey = (value: Date) => {
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

const formatTimeKey = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);

const toDateKey = (value: string | Date) => {
  if (typeof value === "string") {
    return value.includes("T") ? formatDateKey(new Date(value)) : value;
  }
  return formatDateKey(value);
};

const toTimeKey = (value: string | Date) => {
  if (typeof value === "string") {
    if (value.includes("T")) {
      return formatTimeKey(new Date(value));
    }
    return value.slice(0, 5);
  }
  return formatTimeKey(value);
};

const getNowKeys = () => {
  const now = new Date();
  return {
    dateKey: formatDateKey(now),
    timeKey: formatTimeKey(now),
  };
};

export type EffectiveSchedStatus = "OPEN" | "ON_GOING" | "FULLY_BOOKED" | "CLOSED";
export { isSchedStatusReservable };

export function getEffectiveSchedStatus(schedule: ScheduleForStatus): EffectiveSchedStatus {
  const schedDateKey = toDateKey(schedule.sched_date);
  const startTimeKey = toTimeKey(schedule.sched_start_time);
  const endTimeKey = toTimeKey(schedule.sched_end_time);
  const { dateKey: nowDateKey, timeKey: nowTimeKey } = getNowKeys();

  if (
    nowDateKey > schedDateKey ||
    (nowDateKey === schedDateKey && nowTimeKey >= endTimeKey)
  ) {
    return "CLOSED";
  }

  if (
    nowDateKey === schedDateKey &&
    nowTimeKey >= startTimeKey &&
    nowTimeKey < endTimeKey
  ) {
    return "ON_GOING";
  }

  if (schedule.status === "FULLY_BOOKED") {
    return "FULLY_BOOKED";
  }

  return "OPEN";
}

export function getEffectiveShowStatus<TSchedule extends ScheduleForStatus>(
  show: ShowForStatus<TSchedule>,
): ShowStatus {
  if (show.show_status !== "OPEN") {
    return show.show_status;
  }

  if (show.scheds.length === 0) {
    return show.show_status;
  }

  const scheduleStatuses = show.scheds.map(getEffectiveSchedStatus);
  if (scheduleStatuses.some((status) => status === "ON_GOING")) {
    return "ON_GOING";
  }
  if (scheduleStatuses.every((status) => status === "CLOSED")) {
    return "CLOSED";
  }

  return "OPEN";
}

export async function syncScheduleCapacityStatuses(
  tx: Prisma.TransactionClient,
  schedIds: string[],
) {
  const uniqueSchedIds = Array.from(new Set(schedIds.filter(Boolean)));
  if (uniqueSchedIds.length === 0) {
    return;
  }

  const schedules = await tx.sched.findMany({
    where: {
      sched_id: { in: uniqueSchedIds },
    },
    select: {
      sched_id: true,
      status: true,
      seatAssignments: {
        select: {
          seat_status: true,
        },
      },
    },
  });

  await Promise.all(
    schedules.map(async (schedule) => {
      const hasOpenSeats = schedule.seatAssignments.some(
        (assignment) => assignment.seat_status === "OPEN",
      );
      const nextStatus = hasOpenSeats ? null : "FULLY_BOOKED";
      if (schedule.status === nextStatus) {
        return;
      }
      await tx.sched.update({
        where: { sched_id: schedule.sched_id },
        data: { status: nextStatus },
      });
    }),
  );
}

export async function countBlockingReservations(
  db: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  showId: string,
) {
  return db.reservation.count({
    where: {
      show_id: showId,
      status: {
        in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
      },
    },
  });
}

export async function hasShowReachedFinalScheduleEnd(
  db: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  showId: string,
) {
  const schedules = await db.sched.findMany({
    where: { show_id: showId },
    select: {
      sched_date: true,
      sched_end_time: true,
    },
  });

  if (schedules.length === 0) {
    return false;
  }

  const { dateKey: nowDateKey, timeKey: nowTimeKey } = getNowKeys();
  return schedules.every((schedule) => {
    const schedDateKey = toDateKey(schedule.sched_date);
    const endTimeKey = toTimeKey(schedule.sched_end_time);
    return (
      nowDateKey > schedDateKey ||
      (nowDateKey === schedDateKey && nowTimeKey >= endTimeKey)
    );
  });
}
