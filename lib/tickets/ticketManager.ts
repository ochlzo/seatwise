export type TicketManagerSeatStatus = "OPEN" | "RESERVED" | "CONSUMED";

export type TicketManagerStatus = "NOT_ISSUED" | "VALID" | "CONSUMED";

export type TicketManagerStatusFilter = TicketManagerStatus | "ALL";

export type TicketManagerRow = {
  reservationId: string;
  reservationNumber: string;
  schedId: string;
  scheduleLabel: string;
  seatAssignmentId: string;
  seatLabel: string;
  guestName: string;
  guestEmail: string;
  guestPhoneNumber: string;
  ticketStatus: TicketManagerStatus;
  issuedAt: string | null;
};

type TicketManagerReservationLike = {
  reservation_id: string;
  reservation_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  sched_id: string;
  ticket_issued_at: string | Date | null;
  sched: {
    sched_date: Date;
    sched_start_time: Date;
  };
  reservedSeats: Array<{
    seatAssignment: {
      seat_assignment_id: string;
      seat_status: TicketManagerSeatStatus;
      seat: {
        seat_number: string;
      };
    };
  }>;
};

type TicketManagerScheduleLike = {
  sched_id: string;
  sched_date: Date;
  sched_start_time: Date;
};

const MANILA_TIME_ZONE = "Asia/Manila";

export function formatTicketManagerScheduleLabel(
  dateValue: Date,
  startTimeValue: Date,
) {
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateValue));

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(startTimeValue));

  return `${dateLabel} at ${timeLabel}`;
}

export function getTicketManagerStatus(
  ticketIssuedAt: string | Date | null | undefined,
  seatStatus: TicketManagerSeatStatus,
): TicketManagerStatus {
  if (!ticketIssuedAt) {
    return "NOT_ISSUED";
  }

  return seatStatus === "CONSUMED" ? "CONSUMED" : "VALID";
}

export function buildTicketManagerSchedules(
  schedules: TicketManagerScheduleLike[],
) {
  return schedules.map((schedule) => ({
    schedId: schedule.sched_id,
    label: formatTicketManagerScheduleLabel(
      schedule.sched_date,
      schedule.sched_start_time,
    ),
  }));
}

export function buildTicketManagerRows(
  reservations: TicketManagerReservationLike[],
): TicketManagerRow[] {
  return reservations.flatMap((reservation) => {
    const guestName = `${reservation.first_name} ${reservation.last_name}`.trim();
    const scheduleLabel = formatTicketManagerScheduleLabel(
      reservation.sched.sched_date,
      reservation.sched.sched_start_time,
    );

    return reservation.reservedSeats.map(({ seatAssignment }) => ({
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
      schedId: reservation.sched_id,
      scheduleLabel,
      seatAssignmentId: seatAssignment.seat_assignment_id,
      seatLabel: seatAssignment.seat.seat_number,
      guestName,
      guestEmail: reservation.email,
      guestPhoneNumber: reservation.phone_number,
      ticketStatus: getTicketManagerStatus(
        reservation.ticket_issued_at,
        seatAssignment.seat_status,
      ),
      issuedAt:
        reservation.ticket_issued_at instanceof Date
          ? reservation.ticket_issued_at.toISOString()
          : reservation.ticket_issued_at,
    }));
  });
}

export function applyConsumedTicketRows(
  rows: TicketManagerRow[],
  seatAssignmentIds: string[],
): TicketManagerRow[] {
  if (seatAssignmentIds.length === 0) {
    return rows;
  }

  const consumedSeatAssignmentIds = new Set(seatAssignmentIds);

  return rows.map((row): TicketManagerRow => {
    if (
      !consumedSeatAssignmentIds.has(row.seatAssignmentId) ||
      row.ticketStatus === "NOT_ISSUED" ||
      row.ticketStatus === "CONSUMED"
    ) {
      return row;
    }

    return {
      ...row,
      ticketStatus: "CONSUMED",
    };
  });
}

type FilterTicketManagerRowsOptions = {
  query?: string;
  schedId?: string;
  status?: TicketManagerStatusFilter;
};

export function filterTicketManagerRows(
  rows: TicketManagerRow[],
  filters: FilterTicketManagerRowsOptions,
) {
  const normalizedQuery = filters.query?.trim().toLowerCase() ?? "";
  const normalizedSchedId = filters.schedId?.trim() ?? "ALL";
  const normalizedStatus = filters.status ?? "ALL";

  return rows.filter((row) => {
    if (normalizedSchedId !== "ALL" && row.schedId !== normalizedSchedId) {
      return false;
    }

    if (normalizedStatus !== "ALL" && row.ticketStatus !== normalizedStatus) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      row.reservationNumber,
      row.seatLabel,
      row.guestName,
      row.guestEmail,
      row.guestPhoneNumber,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
