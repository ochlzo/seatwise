import type { AdminContext } from "../auth/adminContext.ts";
import { prisma } from "../prisma.ts";

import {
  type LoadedIssuedTicketReservation,
  loadIssuedTicketReservation,
  mapIssuedTicketToPublicResult,
  type TicketVerificationInvalidReason,
  type TicketVerificationInvalidResult,
  type TicketVerificationSuccessResult,
  type VerifyIssuedTicketDb,
} from "./verifyIssuedTicket.ts";
import { TicketConsumeAuthorizationError } from "./consumeIssuedTicket.ts";

const DEFAULT_DB = prisma as unknown as VerifyIssuedTicketDb;

export type VerifyScannedIssuedTicketResult =
  | {
      status: "VALID" | "CONSUMED";
      verification: TicketVerificationSuccessResult;
    }
  | {
      status: "INVALID";
      reason: TicketVerificationInvalidReason;
      verification: TicketVerificationInvalidResult;
    };

type VerifyScannedIssuedTicketOptions = {
  token: string;
  showId: string;
  schedId: string;
  adminContext: AdminContext;
  secret?: string;
};

function formatScheduleTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
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

function createShowMismatchResult(): TicketVerificationInvalidResult {
  return createInvalidResult("SHOW_MISMATCH", "Ticket does not belong to this show.");
}

function createScheduleMismatchResult(
  reservation: LoadedIssuedTicketReservation,
): TicketVerificationInvalidResult {
  return createInvalidResult(
    "SCHEDULE_MISMATCH",
    `Invalid ticket. This is for the ${formatScheduleTime(
      reservation.sched.sched_start_time,
    )} schedule.`,
  );
}

function assertAdminCanVerify(
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

export async function verifyScannedIssuedTicket(
  input: VerifyScannedIssuedTicketOptions,
  db: VerifyIssuedTicketDb = DEFAULT_DB,
): Promise<VerifyScannedIssuedTicketResult> {
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

  assertAdminCanVerify(input.adminContext, loaded.reservation);

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

  const verification = mapIssuedTicketToPublicResult(loaded.reservation);

  return {
    status: verification.status,
    verification,
  };
}
