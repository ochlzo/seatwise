import assert from "node:assert/strict";
import test from "node:test";

import {
  applyConsumedTicketRows,
  buildTicketManagerRows,
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

test("applyConsumedTicketRows marks matching issued rows as consumed without mutating others", () => {
  const rows = [
    createRow({
      reservationId: "reservation-1",
      seatAssignmentId: "seat-assignment-1",
      seatLabel: "A-1",
      ticketStatus: "VALID",
      issuedAt: "2026-04-05T11:00:00.000Z",
    }),
    createRow({
      reservationId: "reservation-2",
      seatAssignmentId: "seat-assignment-2",
      seatLabel: "A-2",
      ticketStatus: "VALID",
      issuedAt: "2026-04-05T11:05:00.000Z",
    }),
    createRow({
      reservationId: "reservation-3",
      seatAssignmentId: "seat-assignment-3",
      seatLabel: "A-3",
      ticketStatus: "NOT_ISSUED",
      issuedAt: null,
    }),
  ];

  const updated = applyConsumedTicketRows(rows, ["seat-assignment-2", "seat-assignment-3"]);

  assert.deepEqual(updated.map((row) => row.ticketStatus), [
    "VALID",
    "CONSUMED",
    "NOT_ISSUED",
  ]);
  assert.equal(updated[0], rows[0]);
  assert.notEqual(updated[1], rows[1]);
  assert.equal(updated[2], rows[2]);
});

test("buildTicketManagerRows flattens reservations into schedule-aware ticket rows", () => {
  const rows = buildTicketManagerRows([
    {
      reservation_id: "reservation-1",
      reservation_number: "REF-1001",
      first_name: "Alex",
      last_name: "Cruz",
      email: "alex@example.com",
      phone_number: "09171234567",
      sched_id: "sched-a",
      ticket_issued_at: new Date("2026-03-31T11:00:00.000Z"),
      sched: {
        sched_date: new Date("2026-03-31T00:00:00.000Z"),
        sched_start_time: new Date("2026-03-31T11:00:00.000Z"),
      },
      reservedSeats: [
        {
          seatAssignment: {
            seat_assignment_id: "seat-assignment-1",
            seat_status: "RESERVED",
            seat: {
              seat_number: "A1",
            },
          },
        },
        {
          seatAssignment: {
            seat_assignment_id: "seat-assignment-2",
            seat_status: "CONSUMED",
            seat: {
              seat_number: "A2",
            },
          },
        },
      ],
    },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].reservationId, "reservation-1");
  assert.equal(rows[0].schedId, "sched-a");
  assert.match(rows[0].scheduleLabel, /Mar/);
  assert.equal(rows[0].ticketStatus, "VALID");
  assert.equal(rows[1].ticketStatus, "CONSUMED");
});
