import assert from "node:assert/strict";
import test from "node:test";

import {
  filterTicketManagerRows,
  getTicketManagerStatus,
  type TicketManagerRow,
} from "./ticketManager.ts";

function createRow(overrides: Partial<TicketManagerRow> = {}): TicketManagerRow {
  return {
    reservationId: "reservation-1",
    reservationNumber: "REF-1001",
    schedId: "sched-a",
    scheduleLabel: "Apr 5, 2026 at 7:00 PM",
    seatAssignmentId: "seat-assignment-1",
    seatLabel: "A-1",
    guestName: "Alex Cruz",
    guestEmail: "alex@example.com",
    guestPhoneNumber: "09171234567",
    ticketStatus: "NOT_ISSUED",
    issuedAt: null,
    ...overrides,
  };
}

test("getTicketManagerStatus resolves NOT_ISSUED when a ticket has not been issued", () => {
  assert.equal(getTicketManagerStatus(null, "RESERVED"), "NOT_ISSUED");
  assert.equal(getTicketManagerStatus(null, "CONSUMED"), "NOT_ISSUED");
});

test("getTicketManagerStatus resolves VALID and CONSUMED from issued tickets", () => {
  const issuedAt = new Date("2026-04-05T11:00:00.000Z");

  assert.equal(getTicketManagerStatus(issuedAt, "RESERVED"), "VALID");
  assert.equal(getTicketManagerStatus(issuedAt, "CONSUMED"), "CONSUMED");
});

test("filterTicketManagerRows applies search, schedule, and status filters together", () => {
  const rows = [
    createRow(),
    createRow({
      reservationId: "reservation-2",
      reservationNumber: "REF-2002",
      schedId: "sched-b",
      seatAssignmentId: "seat-assignment-2",
      seatLabel: "B-4",
      guestName: "Bianca Reyes",
      guestEmail: "bianca@example.com",
      guestPhoneNumber: "09998887777",
      ticketStatus: "VALID",
      issuedAt: "2026-04-05T11:00:00.000Z",
    }),
    createRow({
      reservationId: "reservation-3",
      reservationNumber: "REF-3003",
      schedId: "sched-b",
      seatAssignmentId: "seat-assignment-3",
      seatLabel: "C-7",
      guestName: "Carlos Dela Cruz",
      guestEmail: "carlos@example.com",
      guestPhoneNumber: "09225554444",
      ticketStatus: "CONSUMED",
      issuedAt: "2026-04-05T11:30:00.000Z",
    }),
  ];

  const filtered = filterTicketManagerRows(rows, {
    query: "carlos",
    schedId: "sched-b",
    status: "CONSUMED",
  });

  assert.deepEqual(filtered.map((row) => row.reservationId), ["reservation-3"]);
});
