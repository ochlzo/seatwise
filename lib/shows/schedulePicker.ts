const MANILA_TZ = "Asia/Manila";

const formatManilaDateKey = (value: Date) => {
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

const formatManilaTimeKey = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);

type PriceLike = {
  toString(): string;
};

type SeatAssignmentSource = {
  set: {
    seatCategory: {
      category_name: string;
      price: PriceLike | string | number;
    };
  };
};

export type SchedulePickerSource = {
  sched_id?: string | null;
  sched_date: string | Date;
  sched_start_time: string | Date;
  sched_end_time: string | Date;
  effective_status?: "OPEN" | "ON_GOING" | "FULLY_BOOKED" | "CLOSED";
  seatAssignments?: SeatAssignmentSource[];
};

export type SchedulePickerOption = {
  sched_id: string;
  sched_date: string;
  sched_start_time: string;
  sched_end_time: string;
  effective_status?: "OPEN" | "ON_GOING" | "FULLY_BOOKED" | "CLOSED";
  categories: Array<{
    name: string;
    price: string;
  }>;
};

const toPriceString = (value: PriceLike | string | number) => value.toString();

export function serializeSchedulesForPicker(
  schedules: SchedulePickerSource[] | undefined | null,
): SchedulePickerOption[] {
  return (schedules ?? []).map((schedule) => {
    const categories =
      schedule.seatAssignments
        ?.map((assignment) => ({
          name: assignment.set.seatCategory.category_name,
          price: toPriceString(assignment.set.seatCategory.price),
        }))
        .filter(
          (category, index, collection) =>
            index === collection.findIndex((item) => item.name === category.name),
        ) ?? [];

    return {
      sched_id: schedule.sched_id ?? "",
      sched_date: formatManilaDateKey(new Date(schedule.sched_date)),
      sched_start_time: formatManilaTimeKey(new Date(schedule.sched_start_time)),
      sched_end_time: formatManilaTimeKey(new Date(schedule.sched_end_time)),
      effective_status: schedule.effective_status,
      categories,
    };
  });
}

export function hasSelectableSchedules(schedules: SchedulePickerOption[]) {
  return schedules.some(
    (schedule) =>
      schedule.effective_status != null && isSchedStatusReservable(schedule.effective_status),
  );
}
import { isSchedStatusReservable } from "./reservationEligibility.ts";
