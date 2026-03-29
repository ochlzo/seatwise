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

export function getTicketManagerStatus(
  ticketIssuedAt: string | Date | null | undefined,
  seatStatus: TicketManagerSeatStatus,
): TicketManagerStatus {
  if (!ticketIssuedAt) {
    return "NOT_ISSUED";
  }

  return seatStatus === "CONSUMED" ? "CONSUMED" : "VALID";
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
