import assert from "node:assert/strict";
import test from "node:test";

import { createSignedQrPayload } from "./qrPayload.ts";
import { verifyIssuedTicket } from "./verifyIssuedTicket.ts";

const TEST_SECRET = "seatwise-ticket-secret";

type MemoryReservationRecord = {
  reservation_id: string;
  reservation_number: string;
  ticket_template_version_id: string | null;
  ticket_issued_at: Date | null;
  ticket_consumed_at: Date | null;
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
      seat: {
        seat_number: string;
      };
    };
  }>;
};

function cloneReservation(record: MemoryReservationRecord): MemoryReservationRecord {
  return {
    ...record,
    ticket_issued_at: record.ticket_issued_at
      ? new Date(record.ticket_issued_at)
      : null,
    ticket_consumed_at: record.ticket_consumed_at
      ? new Date(record.ticket_consumed_at)
      : null,
    show: { ...record.show },
    sched: {
      ...record.sched,
      sched_date: new Date(record.sched.sched_date),
      sched_start_time: new Date(record.sched.sched_start_time),
    },
    reservedSeats: record.reservedSeats.map((seat) => ({
      seatAssignment: {
        ...seat.seatAssignment,
        seat: { ...seat.seatAssignment.seat },
      },
    })),
  };
}

function createMemoryTicketDb(record: MemoryReservationRecord) {
  return {
    reservation: {
      async findUnique(args: { where: { reservation_id: string } }) {
        if (args.where.reservation_id !== record.reservation_id) {
          return null;
        }

        return cloneReservation(record);
      },
    },
  };
}

function createIssuedReservation(
  overrides: Partial<MemoryReservationRecord> = {},
): MemoryReservationRecord {
  return {
    reservation_id: "reservation-123",
    reservation_number: "SW-2026-0001",
    ticket_template_version_id: "ticket-template-version-1",
    ticket_issued_at: new Date("2026-03-28T18:00:00+08:00"),
    ticket_consumed_at: null,
    show: {
      show_id: "show-123",
      show_name: "Hamlet",
      venue: "Main Theater",
      team_id: "team-alpha",
    },
    sched: {
      sched_id: "sched-123",
      sched_date: new Date("2026-03-28T00:00:00+08:00"),
      sched_start_time: new Date("2026-03-28T19:30:00+08:00"),
    },
    reservedSeats: [
      {
        seatAssignment: {
          seat_assignment_id: "seat-assignment-1",
          seat_id: "seat-1",
          seat: {
            seat_number: "A1",
          },
        },
      },
      {
        seatAssignment: {
          seat_assignment_id: "seat-assignment-2",
          seat_id: "seat-2",
          seat: {
            seat_number: "A2",
          },
        },
      },
    ],
    ...overrides,
  };
}

test("verifyIssuedTicket returns a public-safe result for an issued ticket", async () => {
  const reservation = createIssuedReservation();
  const db = createMemoryTicketDb(reservation);
  const token = createSignedQrPayload(
    {
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
    },
    { secret: TEST_SECRET },
  );

  const result = await verifyIssuedTicket(token, { secret: TEST_SECRET }, db);

  assert.deepEqual(result, {
    status: "VALID",
    reservationNumber: "SW-2026-0001",
    showName: "Hamlet",
    venue: "Main Theater",
    scheduleDate: "Mar 28, 2026",
    scheduleTime: "7:30 PM",
    seatLabels: ["A1", "A2"],
    consumedAt: null,
  });
  assert.equal("reservationId" in result, false);
  assert.equal("customerName" in result, false);
});

test("verifyIssuedTicket still resolves consumed tickets as public-safe CONSUMED results", async () => {
  const reservation = createIssuedReservation({
    ticket_consumed_at: new Date("2026-03-28T20:15:00+08:00"),
  });
  const db = createMemoryTicketDb(reservation);
  const token = createSignedQrPayload(
    {
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
    },
    { secret: TEST_SECRET },
  );

  const result = await verifyIssuedTicket(token, { secret: TEST_SECRET }, db);

  assert.deepEqual(result, {
    status: "CONSUMED",
    reservationNumber: "SW-2026-0001",
    showName: "Hamlet",
    venue: "Main Theater",
    scheduleDate: "Mar 28, 2026",
    scheduleTime: "7:30 PM",
    seatLabels: ["A1", "A2"],
    consumedAt: "2026-03-28T12:15:00.000Z",
  });
});
