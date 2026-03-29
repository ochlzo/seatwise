import type { AdminContext } from "../auth/adminContext.ts";
import { prisma } from "../prisma.ts";

import {
  type LoadedIssuedTicketReservation,
  loadIssuedTicketReservation,
  mapIssuedTicketToPublicResult,
  type TicketVerificationInvalidResult,
  type TicketVerificationInvalidReason,
  type TicketVerificationSuccessResult,
  type VerifyIssuedTicketDb,
} from "./verifyIssuedTicket.ts";

export class TicketConsumeAuthorizationError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "TicketConsumeAuthorizationError";
    this.status = status;
  }
}

export type TicketConsumeInvalidReason =
  | TicketVerificationInvalidReason
  | "ALREADY_CONSUMED";

export type TicketConsumeResult =
  | {
      status: "CONSUMED";
      showId: string;
      schedId: string;
      seatIds: string[];
      seatAssignmentIds: string[];
      verification: TicketVerificationSuccessResult;
    }
  | {
      status: "INVALID";
      reason: "ALREADY_CONSUMED";
      verification: TicketVerificationSuccessResult;
    }
  | {
      status: "INVALID";
      reason: TicketVerificationInvalidReason;
      verification: TicketVerificationInvalidResult;
    };

type ConsumeIssuedTicketOptions = {
  token: string;
  showId: string;
  schedId: string;
  adminContext: AdminContext;
  secret?: string;
  consumedAt?: Date;
};

type ConsumeIssuedTicketDb = VerifyIssuedTicketDb & {
  reservation: VerifyIssuedTicketDb["reservation"] & {
    update(args: {
      where: { reservation_id: string };
      data: Partial<{
        ticket_consumed_at: Date;
        ticket_consumed_by_admin_id: string;
      }>;
    }): Promise<LoadedIssuedTicketReservation>;
  };
  seatAssignment: {
    update(args: {
      where: { seat_assignment_id: string };
      data: {
        seat_status: "CONSUMED";
      };
    }): Promise<{
      seat_assignment_id: string;
      seat_id: string;
      seat_status: "CONSUMED";
      updatedAt: Date;
      seat: {
        seat_number: string;
      };
    }>;
  };
  $transaction<T>(callback: (tx: ConsumeIssuedTicketDb) => Promise<T>): Promise<T>;
};

const DEFAULT_DB = prisma as unknown as ConsumeIssuedTicketDb;

function createShowMismatchResult(): TicketVerificationInvalidResult {
  return {
    status: "INVALID",
    reason: "SHOW_MISMATCH",
    message: "Ticket does not belong to this show.",
  };
}

function formatScheduleTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function createScheduleMismatchResult(
  reservation: LoadedIssuedTicketReservation,
): TicketVerificationInvalidResult {
  return {
    status: "INVALID",
    reason: "SCHEDULE_MISMATCH",
    message: `Invalid ticket. This is for the ${formatScheduleTime(
      reservation.sched.sched_start_time,
    )} schedule.`,
  };
}

function assertAdminCanConsume(
  adminContext: AdminContext | null | undefined,
  reservation: LoadedIssuedTicketReservation,
) {
  if (!adminContext) {
    throw new TicketConsumeAuthorizationError("Unauthorized", 401);
  }

  if (
    !adminContext.isSuperadmin &&
    reservation.show.team_id !== adminContext.teamId
  ) {
    throw new TicketConsumeAuthorizationError("Forbidden", 403);
  }
}

export async function consumeIssuedTicket(
  input: ConsumeIssuedTicketOptions,
  db: ConsumeIssuedTicketDb = DEFAULT_DB,
): Promise<TicketConsumeResult> {
  const loaded = await loadIssuedTicketReservation(
    input.token,
    { secret: input.secret },
    db,
  );

  if (!loaded.reservation) {
    return {
      status: "INVALID",
      reason: loaded.invalidResult.reason,
      verification: loaded.invalidResult,
    };
  }

  assertAdminCanConsume(input.adminContext, loaded.reservation);

  if (loaded.reservation.show.show_id !== input.showId) {
    return {
      status: "INVALID",
      reason: "SHOW_MISMATCH",
      verification: createShowMismatchResult(),
    };
  }

  if (loaded.reservation.sched.sched_id !== input.schedId) {
    return {
      status: "INVALID",
      reason: "SCHEDULE_MISMATCH",
      verification: createScheduleMismatchResult(loaded.reservation),
    };
  }

  const targetSeatAssignment = loaded.reservation.reservedSeats.find(
    ({ seatAssignment }) =>
      seatAssignment.seat_assignment_id === loaded.seatAssignmentId,
  )?.seatAssignment;

  if (!targetSeatAssignment) {
    return {
      status: "INVALID",
      reason: "TICKET_NOT_FOUND",
      verification: {
        status: "INVALID",
        reason: "TICKET_NOT_FOUND",
        message: "Ticket could not be found.",
      },
    };
  }

  if (targetSeatAssignment.seat_status === "CONSUMED") {
    return {
      status: "INVALID",
      reason: "ALREADY_CONSUMED",
      verification: mapIssuedTicketToPublicResult(
        loaded.reservation,
        loaded.seatAssignmentId,
      ),
    };
  }

  const consumedAt = input.consumedAt ?? new Date();
  const seatIds = [targetSeatAssignment.seat_id];
  const seatAssignmentIds = [targetSeatAssignment.seat_assignment_id];

  const consumedSeatAssignment = await db.$transaction(async (tx) => {
    const updatedSeatAssignment = await tx.seatAssignment.update({
      where: {
        seat_assignment_id: targetSeatAssignment.seat_assignment_id,
      },
      data: {
        seat_status: "CONSUMED",
      },
    });

    const allSeatsConsumed = loaded.reservation.reservedSeats.every(({ seatAssignment }) =>
      seatAssignment.seat_assignment_id === targetSeatAssignment.seat_assignment_id
        ? true
        : seatAssignment.seat_status === "CONSUMED",
    );

    if (allSeatsConsumed) {
      await tx.reservation.update({
        where: { reservation_id: loaded.reservation!.reservation_id },
        data: {
          ticket_consumed_at: consumedAt,
          ticket_consumed_by_admin_id: input.adminContext.userId,
        },
      });
    }

    return updatedSeatAssignment;
  });

  const consumedReservation: LoadedIssuedTicketReservation = {
    ...loaded.reservation,
    ticket_consumed_at:
      loaded.reservation.reservedSeats.length === 1 ||
      loaded.reservation.reservedSeats.every(({ seatAssignment }) =>
        seatAssignment.seat_assignment_id === targetSeatAssignment.seat_assignment_id
          ? true
          : seatAssignment.seat_status === "CONSUMED",
      )
        ? consumedAt
        : loaded.reservation.ticket_consumed_at,
    ticket_consumed_by_admin_id:
      loaded.reservation.reservedSeats.length === 1 ||
      loaded.reservation.reservedSeats.every(({ seatAssignment }) =>
        seatAssignment.seat_assignment_id === targetSeatAssignment.seat_assignment_id
          ? true
          : seatAssignment.seat_status === "CONSUMED",
      )
        ? input.adminContext.userId
        : loaded.reservation.ticket_consumed_by_admin_id,
    reservedSeats: loaded.reservation.reservedSeats.map(({ seatAssignment }) => ({
      seatAssignment: {
        ...seatAssignment,
        seat_status:
          seatAssignment.seat_assignment_id === consumedSeatAssignment.seat_assignment_id
            ? "CONSUMED"
            : seatAssignment.seat_status,
        updatedAt:
          seatAssignment.seat_assignment_id === consumedSeatAssignment.seat_assignment_id
            ? consumedSeatAssignment.updatedAt
            : seatAssignment.updatedAt,
        seat: {
          ...seatAssignment.seat,
        },
      },
    })),
  };

  return {
    status: "CONSUMED",
    showId: consumedReservation.show.show_id,
    schedId: consumedReservation.sched.sched_id,
    seatIds,
    seatAssignmentIds,
    verification: mapIssuedTicketToPublicResult(
      consumedReservation,
      loaded.seatAssignmentId,
    ),
  };
}
