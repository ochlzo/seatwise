import assert from "node:assert/strict";
import test from "node:test";

import type { AdminContext } from "../auth/adminContext.ts";
import type { IssuedReservationTicket } from "./issueReservationTicket.ts";
import { autoConsumeIssuedReservationTickets } from "./autoConsumeIssuedReservationTickets.ts";

const ADMIN_CONTEXT: AdminContext = {
  userId: "admin-123",
  firebaseUid: "firebase-admin-123",
  teamId: "team-alpha",
  teamName: "Team Alpha",
  isSuperadmin: false,
};

function createIssuedTicket(): IssuedReservationTicket {
  return {
    reservationId: "reservation-123",
    reservationNumber: "SW-1001",
    customerName: "Ada Lovelace",
    email: "ada@example.com",
    showName: "Seatwise Live",
    venue: "Main Hall",
    scheduleLabel: "Apr 10, 2026, 7:00 PM",
    seatLabels: ["A1", "A2"],
    ticketTemplateVersionId: "ticket-template-version-1",
    ticketIssuedAt: new Date("2026-03-29T10:00:00.000Z"),
    ticketPdfs: [
      {
        seatAssignmentId: "seat-assignment-1",
        seatLabel: "A1",
        qrToken: "token-1",
        verificationUrl: "https://seatwise.test/ticket/verify/token-1",
        ticketPdf: Uint8Array.from([1, 2, 3]),
        ticketPdfFilename: "ticket-a1.pdf",
      },
      {
        seatAssignmentId: "seat-assignment-2",
        seatLabel: "A2",
        qrToken: "token-2",
        verificationUrl: "https://seatwise.test/ticket/verify/token-2",
        ticketPdf: Uint8Array.from([4, 5, 6]),
        ticketPdfFilename: "ticket-a2.pdf",
      },
    ],
  };
}

test("autoConsumeIssuedReservationTickets consumes every issued walk-in ticket seat", async () => {
  const issuedTicket = createIssuedTicket();
  const consumedAt = new Date("2026-03-29T10:05:00.000Z");
  const calls: Array<{ token: string; showId: string; schedId: string; consumedAt: Date | undefined }> = [];

  await autoConsumeIssuedReservationTickets(
    {
      issuedTicket,
      showId: "show-123",
      schedId: "sched-123",
      adminContext: ADMIN_CONTEXT,
      consumedAt,
    },
    {
      consumeIssuedTicket: async (input) => {
        calls.push({
          token: input.token,
          showId: input.showId,
          schedId: input.schedId,
          consumedAt: input.consumedAt,
        });
        return {
          status: "CONSUMED",
          showId: input.showId,
          schedId: input.schedId,
          seatIds: [`seat-for-${input.token}`],
          seatAssignmentIds: [`assignment-for-${input.token}`],
          verification: {
            status: "CONSUMED",
            reservationNumber: issuedTicket.reservationNumber,
            showName: issuedTicket.showName,
            venue: issuedTicket.venue,
            scheduleDate: "Mar 29, 2026",
            scheduleTime: "6:00 PM",
            seatLabels: ["A1"],
            consumedAt: consumedAt.toISOString(),
          },
        };
      },
    },
  );

  assert.deepEqual(
    calls.map((call) => call.token),
    ["token-1", "token-2"],
  );
  assert.deepEqual(
    calls.map((call) => call.consumedAt?.toISOString()),
    [consumedAt.toISOString(), consumedAt.toISOString()],
  );
});

test("autoConsumeIssuedReservationTickets tolerates already-consumed tickets", async () => {
  const issuedTicket = createIssuedTicket();
  let callCount = 0;

  await autoConsumeIssuedReservationTickets(
    {
      issuedTicket,
      showId: "show-123",
      schedId: "sched-123",
      adminContext: ADMIN_CONTEXT,
    },
    {
      consumeIssuedTicket: async () => {
        callCount += 1;
        return {
          status: "INVALID",
          reason: "ALREADY_CONSUMED",
          verification: {
            status: "CONSUMED",
            reservationNumber: issuedTicket.reservationNumber,
            showName: issuedTicket.showName,
            venue: issuedTicket.venue,
            scheduleDate: "Mar 29, 2026",
            scheduleTime: "6:00 PM",
            seatLabels: ["A1"],
            consumedAt: "2026-03-29T10:05:00.000Z",
          },
        };
      },
    },
  );

  assert.equal(callCount, 2);
});

test("autoConsumeIssuedReservationTickets fails fast on invalid consume responses", async () => {
  const issuedTicket = createIssuedTicket();

  await assert.rejects(
    () =>
      autoConsumeIssuedReservationTickets(
        {
          issuedTicket,
          showId: "show-123",
          schedId: "sched-123",
          adminContext: ADMIN_CONTEXT,
        },
        {
          consumeIssuedTicket: async () => ({
            status: "INVALID",
            reason: "SCHEDULE_MISMATCH",
            verification: {
              status: "INVALID",
              reason: "SCHEDULE_MISMATCH",
              message: "Invalid ticket. This is for the 7:00 PM schedule.",
            },
          }),
        },
      ),
    /Failed to auto-consume walk-in ticket for seat A1/,
  );
});
