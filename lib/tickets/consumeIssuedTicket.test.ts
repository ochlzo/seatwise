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
  updatedAt: Date;
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

type MemoryTicketDb = {
  reservation: {
    findUnique(args: { where: { reservation_id: string } }): Promise<MemoryReservationRecord | null>;
    update(args: {
      where: { reservation_id: string };
      data: Partial<{
        ticket_consumed_at: Date;
        ticket_consumed_by_admin_id: string;
      }>;
    }): Promise<MemoryReservationRecord>;
  };
  seatAssignment: {
    update(args: {
      where: { seat_assignment_id: string };
      data: { seat_status: SeatStatus };
    }): Promise<MemorySeatAssignmentRecord>;
  };
  $transaction<T>(callback: (tx: MemoryTicketDb) => Promise<T>): Promise<T>;
  getSnapshot(): {
    reservation: MemoryReservationRecord;
    mutationCounts: {
      reservationUpdates: number;
      seatAssignmentUpdates: number;
    };
  };
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
        updatedAt: new Date(seat.seatAssignment.updatedAt),
        seat: { ...seat.seatAssignment.seat },
      },
    })),
  };
}

function createMemoryTicketDb(record: MemoryReservationRecord): MemoryTicketDb {
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
        data: Partial<{
          ticket_consumed_at: Date;
          ticket_consumed_by_admin_id: string;
        }>;
      }) {
        if (args.where.reservation_id !== record.reservation_id) {
          throw new Error("Reservation not found");
        }

        mutationCounts.reservationUpdates += 1;
        record.ticket_consumed_at = args.data.ticket_consumed_at
          ? new Date(args.data.ticket_consumed_at)
          : record.ticket_consumed_at;
        record.ticket_consumed_by_admin_id =
          args.data.ticket_consumed_by_admin_id ?? record.ticket_consumed_by_admin_id;

        return cloneReservation(record);
      },
    },
    seatAssignment: {
      async update(args: {
        where: { seat_assignment_id: string };
        data: { seat_status: SeatStatus };
      }) {
        mutationCounts.seatAssignmentUpdates += 1;

        const seatAssignment = seatAssignments.get(args.where.seat_assignment_id);
        if (!seatAssignment) {
          throw new Error("Seat assignment not found");
        }
        seatAssignment.seat_status = args.data.seat_status;
        seatAssignment.updatedAt = new Date("2026-03-28T12:15:00.000Z");

        return {
          ...seatAssignment,
          seat_status: "CONSUMED" as const,
          updatedAt: new Date(seatAssignment.updatedAt),
          seat: { ...seatAssignment.seat },
        };
      },
    },
    async $transaction<T>(callback: (tx: MemoryTicketDb) => Promise<T>) {
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
          updatedAt: new Date("2026-03-28T18:00:00+08:00"),
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
          updatedAt: new Date("2026-03-28T18:00:00+08:00"),
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

test("consumeIssuedTicket marks only the scanned seat CONSUMED and keeps the reservation open until all seats are consumed", async () => {
  const reservation = createIssuedReservation();
  const db = createMemoryTicketDb(reservation);
  const token = createSignedQrPayload(
    {
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
      seatAssignmentId: "seat-assignment-1",
    },
    { secret: TEST_SECRET },
  );
  const finalConsumedAt = new Date("2026-03-28T12:15:00.000Z");

  const result = await consumeIssuedTicket(
    {
      token,
      showId: "show-123",
      schedId: "sched-123",
      adminContext: ADMIN_CONTEXT,
      secret: TEST_SECRET,
      consumedAt: finalConsumedAt,
    },
    db,
  );

  assert.equal(result.status, "CONSUMED");
  assert.equal(result.verification.status, "CONSUMED");
  assert.deepEqual(result.seatIds, ["seat-1"]);
  assert.deepEqual(result.verification.seatLabels, ["A1"]);

  const snapshot = db.getSnapshot();
  assert.equal(snapshot.reservation.ticket_consumed_by_admin_id, null);
  assert.equal(snapshot.reservation.ticket_consumed_at, null);
  assert.deepEqual(
    snapshot.reservation.reservedSeats.map(
      (seat: MemoryReservationRecord["reservedSeats"][number]) =>
        seat.seatAssignment.seat_status,
    ),
    ["CONSUMED", "RESERVED"],
  );
  assert.deepEqual(snapshot.mutationCounts, {
    reservationUpdates: 0,
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
          updatedAt: new Date("2026-03-28T20:15:00+08:00"),
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
          updatedAt: new Date("2026-03-28T18:00:00+08:00"),
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
      seatAssignmentId: "seat-assignment-1",
    },
    { secret: TEST_SECRET },
  );
  const finalConsumedAt = new Date("2026-03-28T12:15:00.000Z");

  const result = await consumeIssuedTicket(
    {
      token,
      showId: "show-123",
      schedId: "sched-123",
      adminContext: ADMIN_CONTEXT,
      secret: TEST_SECRET,
      consumedAt: finalConsumedAt,
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
      seatLabels: ["A1"],
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

test("consumeIssuedTicket rejects tickets from a different schedule with a schedule-specific message", async () => {
  const reservation = createIssuedReservation({
    sched: {
      sched_id: "sched-789",
      sched_date: new Date("2026-03-29T00:00:00+08:00"),
      sched_start_time: new Date("2026-03-29T19:00:00+08:00"),
    },
  });
  const db = createMemoryTicketDb(reservation);
  const token = createSignedQrPayload(
    {
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
      seatAssignmentId: "seat-assignment-1",
    },
    { secret: TEST_SECRET },
  );

  const result = await consumeIssuedTicket(
    {
      token,
      showId: "show-123",
      schedId: "sched-123",
      adminContext: ADMIN_CONTEXT,
      secret: TEST_SECRET,
    },
    db,
  );

  assert.deepEqual(result, {
    status: "INVALID",
    reason: "SCHEDULE_MISMATCH",
    verification: {
      status: "INVALID",
      reason: "SCHEDULE_MISMATCH",
      message: "Invalid ticket. This is for the 7:00 PM schedule.",
    },
  });

  const snapshot = db.getSnapshot();
  assert.deepEqual(snapshot.mutationCounts, {
    reservationUpdates: 0,
    seatAssignmentUpdates: 0,
  });
});

test("consumeIssuedTicket marks the reservation consumed once the final remaining seat is scanned", async () => {
  const reservation = createIssuedReservation({
    reservedSeats: [
      {
        seatAssignment: {
          seat_assignment_id: "seat-assignment-1",
          seat_id: "seat-1",
          seat_status: "CONSUMED",
          updatedAt: new Date("2026-03-28T20:15:00+08:00"),
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
          updatedAt: new Date("2026-03-28T18:00:00+08:00"),
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
      seatAssignmentId: "seat-assignment-2",
    },
    { secret: TEST_SECRET },
  );
  const finalConsumedAt = new Date("2026-03-28T12:15:00.000Z");

  const result = await consumeIssuedTicket(
    {
      token,
      showId: "show-123",
      schedId: "sched-123",
      adminContext: ADMIN_CONTEXT,
      secret: TEST_SECRET,
      consumedAt: finalConsumedAt,
    },
    db,
  );

  assert.equal(result.status, "CONSUMED");
  assert.deepEqual(result.verification.seatLabels, ["A2"]);

  const snapshot = db.getSnapshot();
  assert.equal(snapshot.reservation.ticket_consumed_by_admin_id, "admin-123");
  assert.equal(
    snapshot.reservation.ticket_consumed_at?.toISOString() ?? null,
    finalConsumedAt.toISOString(),
  );
  assert.deepEqual(snapshot.mutationCounts, {
    reservationUpdates: 1,
    seatAssignmentUpdates: 1,
  });
});
