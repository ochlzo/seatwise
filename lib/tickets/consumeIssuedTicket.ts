import type { AdminContext } from "../auth/adminContext.ts";
import { prisma } from "../prisma.ts";

import {
  type LoadedIssuedTicketReservation,
  loadIssuedTicketReservation,
  mapIssuedTicketToPublicResult,
  type TicketVerificationInvalidReason,
  type TicketVerificationResult,
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
      verification: TicketVerificationResult;
    }
  | {
      status: "INVALID";
      reason: TicketConsumeInvalidReason;
      verification: TicketVerificationResult;
    };

type ConsumeIssuedTicketOptions = {
  token: string;
  showId: string;
  adminContext: AdminContext;
  secret?: string;
  consumedAt?: Date;
};

type ConsumeIssuedTicketDb = VerifyIssuedTicketDb & {
  reservation: VerifyIssuedTicketDb["reservation"] & {
    update(args: {
      where: { reservation_id: string };
      data: {
        ticket_consumed_at: Date;
        ticket_consumed_by_admin_id: string;
      };
    }): Promise<LoadedIssuedTicketReservation>;
  };
  seatAssignment: {
    updateMany(args: {
      where: {
        seat_assignment_id: {
          in: string[];
        };
      };
      data: {
        seat_status: "CONSUMED";
      };
    }): Promise<{ count: number }>;
  };
  $transaction<T>(callback: (tx: ConsumeIssuedTicketDb) => Promise<T>): Promise<T>;
};

const DEFAULT_DB = prisma as unknown as ConsumeIssuedTicketDb;

function createShowMismatchResult(): TicketVerificationResult {
  return {
    status: "INVALID",
    reason: "SHOW_MISMATCH",
    message: "Ticket does not belong to this show.",
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

  if (loaded.reservation.ticket_consumed_at) {
    return {
      status: "INVALID",
      reason: "ALREADY_CONSUMED",
      verification: mapIssuedTicketToPublicResult(loaded.reservation),
    };
  }

  const consumedAt = input.consumedAt ?? new Date();
  const seatIds = loaded.reservation.reservedSeats.map(
    ({ seatAssignment }) => seatAssignment.seat_id,
  );
  const seatAssignmentIds = loaded.reservation.reservedSeats.map(
    ({ seatAssignment }) => seatAssignment.seat_assignment_id,
  );

  await db.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { reservation_id: loaded.reservation!.reservation_id },
      data: {
        ticket_consumed_at: consumedAt,
        ticket_consumed_by_admin_id: input.adminContext.userId,
      },
    });

    if (seatAssignmentIds.length > 0) {
      await tx.seatAssignment.updateMany({
        where: {
          seat_assignment_id: {
            in: seatAssignmentIds,
          },
        },
        data: {
          seat_status: "CONSUMED",
        },
      });
    }
  });

  const consumedReservation: LoadedIssuedTicketReservation = {
    ...loaded.reservation,
    ticket_consumed_at: consumedAt,
    ticket_consumed_by_admin_id: input.adminContext.userId,
    reservedSeats: loaded.reservation.reservedSeats.map(({ seatAssignment }) => ({
      seatAssignment: {
        ...seatAssignment,
        seat_status: "CONSUMED",
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
    verification: mapIssuedTicketToPublicResult(consumedReservation),
  };
}
