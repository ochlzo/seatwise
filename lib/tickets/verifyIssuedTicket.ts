import { prisma } from "../prisma.ts";

import { verifySignedQrPayload } from "./qrPayload.ts";

const MANILA_TIME_ZONE = "Asia/Manila";

export type TicketVerificationInvalidReason =
  | "INVALID_TOKEN"
  | "TICKET_NOT_FOUND"
  | "TICKET_NOT_ISSUED"
  | "SHOW_MISMATCH"
  | "SCHEDULE_MISMATCH";

export type TicketVerificationInvalidResult = {
  status: "INVALID";
  reason: TicketVerificationInvalidReason;
  message: string;
};

export type TicketVerificationSuccessResult = {
  status: "VALID" | "CONSUMED";
  reservationNumber: string;
  showName: string;
  venue: string;
  scheduleDate: string;
  scheduleTime: string;
  seatLabels: [string];
  consumedAt: string | null;
};

export type TicketVerificationResult =
  | TicketVerificationInvalidResult
  | TicketVerificationSuccessResult;

export type LoadedIssuedTicketReservation = {
  reservation_id: string;
  reservation_number: string;
  ticket_template_version_id: string | null;
  ticket_issued_at: Date | null;
  ticket_consumed_at: Date | null;
  ticket_consumed_by_admin_id?: string | null;
  show: {
    show_id: string;
    show_name: string;
    venue: string;
    team_id: string | null;
  };
  sched: {
    sched_id: string;
    sched_date: Date;
    sched_start_time: Date;
  };
  reservedSeats: Array<{
    seatAssignment: {
      seat_assignment_id: string;
      seat_id: string;
      seat_status?: string;
      updatedAt?: Date;
      seat: {
        seat_number: string;
      };
    };
  }>;
};

export type VerifyIssuedTicketDb = {
  reservation: {
    findUnique(args: {
      where: { reservation_id: string };
      select?: unknown;
    }): Promise<LoadedIssuedTicketReservation | null>;
  };
};

type VerifyIssuedTicketOptions = {
  secret?: string;
};

type LoadedIssuedTicketResult =
  | {
      reservation: LoadedIssuedTicketReservation;
      seatAssignmentId: string;
      invalidResult: null;
    }
  | {
      reservation: null;
      seatAssignmentId: null;
      invalidResult: TicketVerificationInvalidResult;
    };

const DEFAULT_DB = prisma as unknown as VerifyIssuedTicketDb;

function formatScheduleDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatScheduleTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function createInvalidResult(
  reason: TicketVerificationInvalidReason,
  message: string,
): TicketVerificationInvalidResult {
  return {
    status: "INVALID",
    reason,
    message,
  };
}

export function mapIssuedTicketToPublicResult(
  reservation: LoadedIssuedTicketReservation,
  seatAssignmentId: string,
): TicketVerificationSuccessResult {
  const matchedSeat = reservation.reservedSeats.find(
    ({ seatAssignment }) => seatAssignment.seat_assignment_id === seatAssignmentId,
  )?.seatAssignment;

  if (!matchedSeat) {
    throw new Error("Issued ticket seat assignment could not be resolved.");
  }

  const isConsumed = matchedSeat.seat_status === "CONSUMED";
  return {
    status: isConsumed ? "CONSUMED" : "VALID",
    reservationNumber: reservation.reservation_number,
    showName: reservation.show.show_name,
    venue: reservation.show.venue,
    scheduleDate: formatScheduleDate(reservation.sched.sched_date),
    scheduleTime: formatScheduleTime(reservation.sched.sched_start_time),
    seatLabels: [matchedSeat.seat.seat_number],
    consumedAt: isConsumed ? matchedSeat.updatedAt?.toISOString() ?? null : null,
  };
}

export async function loadIssuedTicketReservation(
  token: string,
  options?: VerifyIssuedTicketOptions,
  db: VerifyIssuedTicketDb = DEFAULT_DB,
): Promise<LoadedIssuedTicketResult> {
  const payload = verifySignedQrPayload(token, options);

  if (!payload) {
    return {
      reservation: null,
      seatAssignmentId: null,
      invalidResult: createInvalidResult(
        "INVALID_TOKEN",
        "Ticket token is invalid.",
      ),
    };
  }

  const reservation = await db.reservation.findUnique({
    where: {
      reservation_id: payload.reservationId,
    },
    select: {
      reservation_id: true,
      reservation_number: true,
      ticket_template_version_id: true,
      ticket_issued_at: true,
      ticket_consumed_at: true,
      ticket_consumed_by_admin_id: true,
      show: {
        select: {
          show_id: true,
          show_name: true,
          venue: true,
          team_id: true,
        },
      },
      sched: {
        select: {
          sched_id: true,
          sched_date: true,
          sched_start_time: true,
        },
      },
      reservedSeats: {
        select: {
          seatAssignment: {
            select: {
              seat_assignment_id: true,
              seat_id: true,
              seat_status: true,
              updatedAt: true,
              seat: {
                select: {
                  seat_number: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!reservation || reservation.reservation_number !== payload.reservationNumber) {
    return {
      reservation: null,
      seatAssignmentId: null,
      invalidResult: createInvalidResult(
        "TICKET_NOT_FOUND",
        "Ticket could not be found.",
      ),
    };
  }

  const matchedSeat = reservation.reservedSeats.find(
    ({ seatAssignment }) =>
      seatAssignment.seat_assignment_id === payload.seatAssignmentId,
  );

  if (!matchedSeat) {
    return {
      reservation: null,
      seatAssignmentId: null,
      invalidResult: createInvalidResult(
        "TICKET_NOT_FOUND",
        "Ticket could not be found.",
      ),
    };
  }

  if (!reservation.ticket_template_version_id || !reservation.ticket_issued_at) {
    return {
      reservation: null,
      seatAssignmentId: null,
      invalidResult: createInvalidResult(
        "TICKET_NOT_ISSUED",
        "Ticket has not been issued.",
      ),
    };
  }

  return {
    reservation,
    seatAssignmentId: payload.seatAssignmentId,
    invalidResult: null,
  };
}

export async function verifyIssuedTicket(
  token: string,
  options?: VerifyIssuedTicketOptions,
  db: VerifyIssuedTicketDb = DEFAULT_DB,
): Promise<TicketVerificationResult> {
  const loaded = await loadIssuedTicketReservation(token, options, db);

  if (!loaded.reservation) {
    return loaded.invalidResult;
  }

  return mapIssuedTicketToPublicResult(
    loaded.reservation,
    loaded.seatAssignmentId,
  );
}
