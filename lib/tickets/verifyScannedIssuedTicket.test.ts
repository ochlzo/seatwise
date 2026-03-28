import assert from "node:assert/strict";
import test from "node:test";

import type { AdminContext } from "../auth/adminContext.ts";
import { createSignedQrPayload } from "./qrPayload.ts";
import { verifyScannedIssuedTicket } from "./verifyScannedIssuedTicket.ts";

const TEST_SECRET = "seatwise-ticket-secret";

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
    seatAssignment: {
      seat_assignment_id: string;
      seat_id: string;
      seat_status?: string;
      updatedAt?: Date;
      seat: {
        seat_number: string;
      };
    };
  }>;
};

const ADMIN_CONTEXT: AdminContext = {
  userId: "admin-123",
  firebaseUid: "firebase-admin-123",
  teamId: "team-alpha",
  teamName: "Team Alpha",
  isSuperadmin: false,
};

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
    ],
    ...overrides,
  };
}

function createVerifyDb(record: MemoryReservationRecord) {
  return {
    reservation: {
      async findUnique(args: { where: { reservation_id: string } }) {
        if (args.where.reservation_id !== record.reservation_id) {
          return null;
        }

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
          reservedSeats: record.reservedSeats.map(({ seatAssignment }) => ({
            seatAssignment: {
              ...seatAssignment,
              updatedAt: seatAssignment.updatedAt
                ? new Date(seatAssignment.updatedAt)
                : undefined,
              seat: { ...seatAssignment.seat },
            },
          })),
        };
      },
    },
  };
}

test("verifyScannedIssuedTicket returns a valid scoped result without consuming the ticket", async () => {
  const reservation = createIssuedReservation();
  const db = createVerifyDb(reservation);
  const token = createSignedQrPayload(
    {
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
      seatAssignmentId: "seat-assignment-1",
    },
    { secret: TEST_SECRET },
  );

  const result = await verifyScannedIssuedTicket(
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
    status: "VALID",
    verification: {
      status: "VALID",
      reservationNumber: "SW-2026-0001",
      showName: "Hamlet",
      venue: "Main Theater",
      scheduleDate: "Mar 28, 2026",
      scheduleTime: "7:30 PM",
      seatLabels: ["A1"],
      consumedAt: null,
    },
  });
  assert.equal(reservation.ticket_consumed_at, null);
});

test("verifyScannedIssuedTicket rejects tickets from a different schedule before consume", async () => {
  const reservation = createIssuedReservation({
    sched: {
      sched_id: "sched-789",
      sched_date: new Date("2026-03-29T00:00:00+08:00"),
      sched_start_time: new Date("2026-03-29T19:00:00+08:00"),
    },
  });
  const db = createVerifyDb(reservation);
  const token = createSignedQrPayload(
    {
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
      seatAssignmentId: "seat-assignment-1",
    },
    { secret: TEST_SECRET },
  );

  const result = await verifyScannedIssuedTicket(
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
  assert.equal(reservation.ticket_consumed_at, null);
});
