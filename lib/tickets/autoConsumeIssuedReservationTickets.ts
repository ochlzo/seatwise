import type { AdminContext } from "../auth/adminContext.ts";

import {
  consumeIssuedTicket,
  type TicketConsumeResult,
} from "./consumeIssuedTicket.ts";
import type { IssuedReservationTicket } from "./issueReservationTicket.ts";

type AutoConsumeIssuedReservationTicketsInput = {
  issuedTicket: IssuedReservationTicket;
  showId: string;
  schedId: string;
  adminContext: AdminContext;
  secret?: string;
  consumedAt?: Date;
};

type AutoConsumeIssuedReservationTicketsDeps = {
  consumeIssuedTicket?: typeof consumeIssuedTicket;
};

function assertAutoConsumeResult(
  result: TicketConsumeResult,
  seatLabel: string,
) {
  if (result.status === "CONSUMED") {
    return;
  }

  if (result.reason === "ALREADY_CONSUMED") {
    return;
  }

  const message =
    "message" in result.verification
      ? result.verification.message
      : "Ticket could not be consumed.";

  throw new Error(
    `Failed to auto-consume walk-in ticket for seat ${seatLabel}: ${message}`,
  );
}

export async function autoConsumeIssuedReservationTickets(
  input: AutoConsumeIssuedReservationTicketsInput,
  deps: AutoConsumeIssuedReservationTicketsDeps = {},
) {
  const consumeTicket = deps.consumeIssuedTicket ?? consumeIssuedTicket;

  for (const ticket of input.issuedTicket.ticketPdfs) {
    const result = await consumeTicket({
      token: ticket.qrToken,
      showId: input.showId,
      schedId: input.schedId,
      adminContext: input.adminContext,
      secret: input.secret,
      consumedAt: input.consumedAt,
    });

    assertAutoConsumeResult(result, ticket.seatLabel);
  }
}
