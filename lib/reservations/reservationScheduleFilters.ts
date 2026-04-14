type ReservationScheduleLike = {
  sched_id: string;
  sched_date: string;
  sched_start_time: string;
  sched_end_time: string;
};

type ReservationScheduleReservationLike = {
  seatAssignments: Array<{
    sched: ReservationScheduleLike;
  }>;
};

export type ReservationScheduleFilterShowLike = {
  showId: string;
  reservations: ReservationScheduleReservationLike[];
};

export type ReservationScheduleFilterOption = {
  id: string;
  label: string;
};

const MANILA_TIME_ZONE = "Asia/Manila";

const formatScheduleLabel = (schedule: ReservationScheduleLike) => {
  const date = new Date(schedule.sched_date);
  const startTime = new Date(schedule.sched_start_time);
  const endTime = new Date(schedule.sched_end_time);

  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);

  const timeFormatter = new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });

  return `${dateLabel}, ${timeFormatter.format(startTime)} - ${timeFormatter.format(endTime)}`;
};

export function isReservationScheduleFilterDisabled(selectedShowId: string) {
  return selectedShowId === "all";
}

export function buildReservationScheduleFilterOptions<T extends ReservationScheduleFilterShowLike>(
  shows: T[],
  selectedShowId: string,
): ReservationScheduleFilterOption[] {
  if (isReservationScheduleFilterDisabled(selectedShowId)) {
    return [];
  }

  const selectedShow = shows.find((show) => show.showId === selectedShowId);
  if (!selectedShow) {
    return [];
  }

  const optionsByScheduleId = new Map<
    string,
    { id: string; label: string; sortKey: string }
  >();

  for (const reservation of selectedShow.reservations) {
    const schedule = reservation.seatAssignments[0]?.sched;
    if (!schedule) continue;

    if (!optionsByScheduleId.has(schedule.sched_id)) {
      optionsByScheduleId.set(schedule.sched_id, {
        id: schedule.sched_id,
        label: formatScheduleLabel(schedule),
        sortKey: [
          schedule.sched_date,
          schedule.sched_start_time,
          schedule.sched_end_time,
          schedule.sched_id,
        ].join("|"),
      });
    }
  }

  return [...optionsByScheduleId.values()]
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
    .map(({ id, label }) => ({ id, label }));
}

export function filterReservationShowsBySchedule<
  T extends ReservationScheduleFilterShowLike,
>(shows: T[], selectedShowId: string, selectedScheduleId: string): T[] {
  const scopedShows =
    selectedShowId === "all"
      ? shows
      : shows.filter((show) => show.showId === selectedShowId);

  if (isReservationScheduleFilterDisabled(selectedShowId) || selectedScheduleId === "all") {
    return scopedShows;
  }

  return scopedShows
    .map((show) => ({
      ...show,
      reservations: show.reservations.filter((reservation) =>
        reservation.seatAssignments.some((seatAssignment) => seatAssignment.sched.sched_id === selectedScheduleId),
      ),
    }))
    .filter((show) => show.reservations.length > 0) as T[];
}
