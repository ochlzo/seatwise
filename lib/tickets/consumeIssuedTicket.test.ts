import assert from "node:assert/strict";
import test from "node:test";

import type { SeatStatus } from "@prisma/client";

import type { AdminContext } from "../auth/adminContext.ts";
import { createSignedQrPayload } from "./qrPayload.ts";
import { consumeIssuedTicket } from "./consumeIssuedTicket.ts";

const TEST_SECRET = "seatwise-ticket-secret";

type MemorySeatAssignmentRecord = {
  seat_assignment_id: string;
  seat_id: string;
  seat_status: SeatStatus;
  seat: {
    seat_number: string;
  };
};

type MemoryReservationRecord = {
  reservation_id: string;
  reservation_number: string;
  ticket_template_version_id: string | null;
  ticket_issued_at: Date | null;
  ticket_consumed_at: Date | null;
  ticket_consumed_by_admin_id: string | null;
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
    seatAssignment: MemorySeatAssignmentRecord;
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
  const seatAssignments = new Map(
    record.reservedSeats.map(({ seatAssignment }) => [
      seatAssignment.seat_assignment_id,
      {
        ...seatAssignment,
        seat: { ...seatAssignment.seat },
      },
    ]),
  );

  const mutationCounts = {
    reservationUpdates: 0,
    seatAssignmentUpdates: 0,
  };

  const db = {
    reservation: {
      async findUnique(args: { where: { reservation_id: string } }) {
        if (args.where.reservation_id !== record.reservation_id) {
          return null;
        }

        return cloneReservation({
          ...record,
          reservedSeats: Array.from(seatAssignments.values()).map((seatAssignment) => ({
            seatAssignment: {
              ...seatAssignment,
              seat: { ...seatAssignment.seat },
            },
          })),
        });
      },
      async update(args: {
        where: { reservation_id: string };
        data: {
          ticket_consumed_at: Date;
          ticket_consumed_by_admin_id: string;
        };
      }) {
        if (args.where.reservation_id !== record.reservation_id) {
          throw new Error("Reservation not found");
        }

        mutationCounts.reservationUpdates += 1;
        record.ticket_consumed_at = new Date(args.data.ticket_consumed_at);
        record.ticket_consumed_by_admin_id = args.data.ticket_consumed_by_admin_id;

        return cloneReservation(record);
      },
    },
    seatAssignment: {
      async updateMany(args: {
        where: { seat_assignment_id: { in: string[] } };
        data: { seat_status: SeatStatus };
      }) {
        mutationCounts.seatAssignmentUpdates += 1;

        args.where.seat_assignment_id.in.forEach((seatAssignmentId) => {
          const seatAssignment = seatAssignments.get(seatAssignmentId);
          if (seatAssignment) {
            seatAssignment.seat_status = args.data.seat_status;
          }
        });

        return { count: args.where.seat_assignment_id.in.length };
      },
    },
    async $transaction<T>(callback: (tx: typeof db) => Promise<T>) {
      return callback(db);
    },
    getSnapshot() {
      return {
        reservation: cloneReservation({
          ...record,
          reservedSeats: Array.from(seatAssignments.values()).map((seatAssignment) => ({
            seatAssignment: {
              ...seatAssignment,
              seat: { ...seatAssignment.seat },
            },
          })),
        }),
        mutationCounts: { ...mutationCounts },
      };
    },
  };

  return db;
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
    ticket_consumed_by_admin_id: null,
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
          seat_status: "RESERVED",
          seat: {
            seat_number: "A1",
          },
        },
      },
      {
        seatAssignment: {
          seat_assignment_id: "seat-assignment-2",
          seat_id: "seat-2",
          seat_status: "RESERVED",
          seat: {
            seat_number: "A2",
          },
        },
      },
    ],
    ...overrides,
  };
}

const ADMIN_CONTEXT: AdminContext = {
  userId: "admin-123",
  firebaseUid: "firebase-admin-123",
  teamId: "team-alpha",
  teamName: "Team Alpha",
  isSuperadmin: false,
};

test("consumeIssuedTicket marks the reservation consumed and all linked seats CONSUMED", async () => {
  const reservation = createIssuedReservation();
  const db = createMemoryTicketDb(reservation);
  const token = createSignedQrPayload(
    {
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
    },
    { secret: TEST_SECRET },
  );

  const result = await consumeIssuedTicket(
    {
      token,
      showId: "show-123",
      adminContext: ADMIN_CONTEXT,
      secret: TEST_SECRET,
    },
    db,
  );

  assert.equal(result.status, "CONSUMED");
  assert.equal(result.verification.status, "CONSUMED");
  assert.deepEqual(result.seatIds, ["seat-1", "seat-2"]);

  const snapshot = db.getSnapshot();
  assert.equal(snapshot.reservation.ticket_consumed_by_admin_id, "admin-123");
  assert.equal(
    snapshot.reservation.ticket_consumed_at?.toISOString() ?? null,
    result.verification.consumedAt,
  );
  assert.deepEqual(
    snapshot.reservation.reservedSeats.map((seat) => seat.seatAssignment.seat_status),
    ["CONSUMED", "CONSUMED"],
  );
  assert.deepEqual(snapshot.mutationCounts, {
    reservationUpdates: 1,
    seatAssignmentUpdates: 1,
  });
});

test("consumeIssuedTicket returns an already-consumed invalid result without mutating data again", async () => {
  const reservation = createIssuedReservation({
    ticket_consumed_at: new Date("2026-03-28T20:15:00+08:00"),
    ticket_consumed_by_admin_id: "admin-previous",
    reservedSeats: [
      {
        seatAssignment: {
          seat_assignment_id: "seat-assignment-1",
          seat_id: "seat-1",
          seat_status: "CONSUMED",
          seat: {
            seat_number: "A1",
          },
        },
      },
      {
        seatAssignment: {
          seat_assignment_id: "seat-assignment-2",
          seat_id: "seat-2",
          seat_status: "CONSUMED",
          seat: {
            seat_number: "A2",
          },
        },
      },
    ],
  });
  const db = createMemoryTicketDb(reservation);
  const token = createSignedQrPayload(
    {
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
    },
    { secret: TEST_SECRET },
  );

  const result = await consumeIssuedTicket(
    {
      token,
      showId: "show-123",
      adminContext: ADMIN_CONTEXT,
      secret: TEST_SECRET,
    },
    db,
  );

  assert.deepEqual(result, {
    status: "INVALID",
    reason: "ALREADY_CONSUMED",
    verification: {
      status: "CONSUMED",
      reservationNumber: "SW-2026-0001",
      showName: "Hamlet",
      venue: "Main Theater",
      scheduleDate: "Mar 28, 2026",
      scheduleTime: "7:30 PM",
      seatLabels: ["A1", "A2"],
      consumedAt: "2026-03-28T12:15:00.000Z",
    },
  });

  const snapshot = db.getSnapshot();
  assert.equal(
    snapshot.reservation.ticket_consumed_at?.toISOString(),
    "2026-03-28T12:15:00.000Z",
  );
  assert.equal(snapshot.reservation.ticket_consumed_by_admin_id, "admin-previous");
  assert.deepEqual(snapshot.mutationCounts, {
    reservationUpdates: 0,
    seatAssignmentUpdates: 0,
  });
});
