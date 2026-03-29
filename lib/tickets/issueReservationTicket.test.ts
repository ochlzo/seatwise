import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyTicketTemplate } from "./templateSchema.ts";

type MemoryReservationRecord = {
  reservation_id: string;
  reservation_number: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  ticket_template_version_id: string | null;
  ticket_issued_at: Date | null;
  ticket_delivery_error: string | null;
  show: {
    show_id: string;
    show_name: string;
    venue: string;
    ticket_template_id: string | null;
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
      updatedAt?: Date;
      set?: {
        seatCategory?: {
          category_name: string;
        };
      };
      seat: {
        seat_number: string;
      };
    };
  }>;
};

type MemoryTemplateVersionRecord = {
  ticket_template_version_id: string;
  ticket_template_id: string;
  version_number: number;
  template_schema: ReturnType<typeof createEmptyTicketTemplate>;
  createdAt: Date;
};

function createTemplateVersion(
  input: Partial<MemoryTemplateVersionRecord> & {
    ticket_template_version_id: string;
    version_number: number;
  },
): MemoryTemplateVersionRecord {
  const template = createEmptyTicketTemplate();
  template.nodes.push(
    {
      id: "field-show-name",
      kind: "field",
      fieldKey: "show_name",
      x: 120,
      y: 120,
      width: 580,
      fontSize: 72,
    },
    {
      id: "field-reservation-number",
      kind: "field",
      fieldKey: "reservation_number",
      x: 120,
      y: 240,
      width: 420,
      fontSize: 54,
    },
    {
      id: "qr-ticket",
      kind: "qr",
      x: 2140,
      y: 110,
      size: 220,
    },
  );

  return {
    ticket_template_version_id: input.ticket_template_version_id,
    ticket_template_id: input.ticket_template_id ?? "ticket-template-1",
    version_number: input.version_number,
    template_schema: input.template_schema ?? template,
    createdAt: input.createdAt ?? new Date("2026-03-27T10:00:00Z"),
  };
}

function createReservationRecord(
  input: Partial<MemoryReservationRecord> & {
    reservation_id: string;
    reservation_number: string;
  },
): MemoryReservationRecord {
  return {
    reservation_id: input.reservation_id,
    reservation_number: input.reservation_number,
    first_name: input.first_name ?? "Ada",
    last_name: input.last_name ?? "Lovelace",
    email: input.email ?? "ada@example.com",
    status: input.status ?? "CONFIRMED",
    ticket_template_version_id: input.ticket_template_version_id ?? null,
    ticket_issued_at: input.ticket_issued_at ?? null,
    ticket_delivery_error: input.ticket_delivery_error ?? "Previous delivery failure",
    show: input.show ?? {
      show_id: "show-1",
      show_name: "Seatwise Live",
      venue: "Main Hall",
      ticket_template_id: "ticket-template-1",
    },
    sched: input.sched ?? {
      sched_id: "sched-1",
      sched_date: new Date("2026-04-10T00:00:00+08:00"),
      sched_start_time: new Date("2026-04-10T19:00:00+08:00"),
    },
    reservedSeats: input.reservedSeats ?? [
      {
        seatAssignment: {
          seat_assignment_id: "seat-assignment-1",
          seat_id: "seat-1",
          updatedAt: new Date("2026-03-28T18:00:00+08:00"),
          set: {
            seatCategory: {
              category_name: "VIP",
            },
          },
          seat: { seat_number: "A1" },
        },
      },
      {
        seatAssignment: {
          seat_assignment_id: "seat-assignment-2",
          seat_id: "seat-2",
          updatedAt: new Date("2026-03-28T18:00:00+08:00"),
          set: {
            seatCategory: {
              category_name: "VIP",
            },
          },
          seat: { seat_number: "A2" },
        },
      },
    ],
  };
}

function createIssueTicketDb(args: {
  reservation: MemoryReservationRecord;
  templateVersions: MemoryTemplateVersionRecord[];
}) {
  const reservation = structuredClone(args.reservation) as MemoryReservationRecord;
  const templateVersions = args.templateVersions.map((version) =>
    structuredClone(version),
  ) as MemoryTemplateVersionRecord[];

  return {
    records: {
      reservation,
      templateVersions,
    },
    db: {
      reservation: {
        async findUnique(args: { where: { reservation_id: string } }) {
          if (args.where.reservation_id !== reservation.reservation_id) {
            return null;
          }

          return structuredClone(reservation) as MemoryReservationRecord;
        },
        async update(args: {
          where: { reservation_id: string };
          data: {
            ticket_template_version_id: string;
            ticket_issued_at: Date;
            ticket_delivery_error: string | null;
          };
        }) {
          assert.equal(args.where.reservation_id, reservation.reservation_id);
          reservation.ticket_template_version_id = args.data.ticket_template_version_id;
          reservation.ticket_issued_at = args.data.ticket_issued_at;
          reservation.ticket_delivery_error = args.data.ticket_delivery_error;
          return structuredClone(reservation) as MemoryReservationRecord;
        },
      },
      ticketTemplateVersion: {
        async findUnique(args: {
          where: { ticket_template_version_id: string };
        }) {
          return (
            templateVersions.find(
              (version) =>
                version.ticket_template_version_id ===
                args.where.ticket_template_version_id,
            ) ?? null
          );
        },
        async findFirst(args: {
          where: { ticket_template_id: string };
          orderBy: { version_number: "asc" | "desc" };
        }) {
          const matches = templateVersions
            .filter(
              (version) =>
                version.ticket_template_id === args.where.ticket_template_id,
            )
            .sort((left, right) =>
              args.orderBy.version_number === "desc"
                ? right.version_number - left.version_number
                : left.version_number - right.version_number,
            );

          return matches[0] ?? null;
        },
      },
    },
  };
}

test("walk-in issuance uses the show's current template version and stores it on the reservation", async () => {
  const { issueReservationTicket } = await import("./issueReservationTicket.ts");
  const issuedAt = new Date("2026-03-28T18:00:00+08:00");
  const db = createIssueTicketDb({
    reservation: createReservationRecord({
      reservation_id: "reservation-walk-in",
      reservation_number: "4821",
    }),
    templateVersions: [
      createTemplateVersion({
        ticket_template_version_id: "ticket-template-version-1",
        version_number: 1,
      }),
      createTemplateVersion({
        ticket_template_version_id: "ticket-template-version-2",
        version_number: 2,
      }),
    ],
  });
  const renderCalls: Array<{
    qrValue: string;
    templateVersionNumber: number;
    seatCategory: string | undefined;
  }> = [];
  const buildPdfCalls: Uint8Array[] = [];

  const result = await issueReservationTicket(
    {
      reservationId: "reservation-walk-in",
      baseUrl: "https://seatwise.test",
      secret: "ticket-secret",
      issuedAt,
    },
    {
      db: db.db,
      renderTicketPng: async ({ template, qrValue, fields }) => {
        renderCalls.push({
          qrValue,
          templateVersionNumber: template.version_number,
          seatCategory: fields.seat_category,
        });
        return Buffer.from("ticket-png");
      },
      buildTicketPdf: async ({ ticketPng }) => {
        buildPdfCalls.push(ticketPng);
        return Uint8Array.from([0x25, 0x50, 0x44, 0x46]);
      },
    },
  );

  assert.equal(result.ticketTemplateVersionId, "ticket-template-version-2");
  assert.deepEqual(result.seatLabels, ["A1", "A2"]);
  assert.deepEqual(
    result.ticketPdfs.map((ticket) => ticket.ticketPdfFilename),
    ["seatwise-ticket-A1-4821.pdf", "seatwise-ticket-A2-4821.pdf"],
  );
  assert.deepEqual(
    result.ticketPdfs.map((ticket) => ticket.seatLabel),
    ["A1", "A2"],
  );
  assert.deepEqual(
    result.ticketPdfs.map((ticket) => ticket.seatAssignmentId),
    ["seat-assignment-1", "seat-assignment-2"],
  );
  assert.equal(db.records.reservation.ticket_template_version_id, "ticket-template-version-2");
  assert.equal(
    db.records.reservation.ticket_issued_at?.toISOString(),
    issuedAt.toISOString(),
  );
  assert.equal(db.records.reservation.ticket_delivery_error, null);
  assert.equal(renderCalls[0]?.templateVersionNumber, 2);
  assert.match(
    renderCalls[0]?.qrValue ?? "",
    /^https:\/\/seatwise\.test\/ticket\/verify\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  );
  assert.equal(renderCalls[0]?.seatCategory, "VIP");
  assert.equal(renderCalls.length, 2);
  assert.deepEqual(buildPdfCalls, [Buffer.from("ticket-png"), Buffer.from("ticket-png")]);
  assert.match(
    result.ticketPdfs[0]?.verificationUrl ?? "",
    /^https:\/\/seatwise\.test\/ticket\/verify\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  );
  assert.notEqual(result.ticketPdfs[0]?.qrToken, result.ticketPdfs[1]?.qrToken);
});

test("online verification issuance also uses the show's current template version", async () => {
  const { issueReservationTicket } = await import("./issueReservationTicket.ts");
  const db = createIssueTicketDb({
    reservation: createReservationRecord({
      reservation_id: "reservation-online",
      reservation_number: "5120",
      status: "CONFIRMED",
      show: {
        show_id: "show-2",
        show_name: "Seatwise Encore",
        venue: "Black Box Theater",
        ticket_template_id: "ticket-template-2",
      },
    }),
    templateVersions: [
      createTemplateVersion({
        ticket_template_version_id: "ticket-template-version-5",
        ticket_template_id: "ticket-template-2",
        version_number: 5,
      }),
      createTemplateVersion({
        ticket_template_version_id: "ticket-template-version-6",
        ticket_template_id: "ticket-template-2",
        version_number: 6,
      }),
    ],
  });

  const result = await issueReservationTicket(
    {
      reservationId: "reservation-online",
      baseUrl: "https://seatwise.test",
      secret: "ticket-secret",
      issuedAt: new Date("2026-03-28T20:00:00+08:00"),
    },
    {
      db: db.db,
      renderTicketPng: async () => Buffer.from("ticket-png"),
      buildTicketPdf: async () => Uint8Array.from([1, 2, 3]),
    },
  );

  assert.equal(result.ticketTemplateVersionId, "ticket-template-version-6");
  assert.equal(db.records.reservation.ticket_template_version_id, "ticket-template-version-6");
});

test("reissuing a reservation ticket reuses the stored template version instead of a newer show version", async () => {
  const { issueReservationTicket } = await import("./issueReservationTicket.ts");
  const db = createIssueTicketDb({
    reservation: createReservationRecord({
      reservation_id: "reservation-reissue",
      reservation_number: "9001",
      ticket_template_version_id: "ticket-template-version-3",
      ticket_issued_at: new Date("2026-03-28T18:00:00+08:00"),
      show: {
        show_id: "show-3",
        show_name: "Seatwise Reprise",
        venue: "Studio Hall",
        ticket_template_id: "ticket-template-3",
      },
    }),
    templateVersions: [
      createTemplateVersion({
        ticket_template_version_id: "ticket-template-version-3",
        ticket_template_id: "ticket-template-3",
        version_number: 3,
      }),
      createTemplateVersion({
        ticket_template_version_id: "ticket-template-version-4",
        ticket_template_id: "ticket-template-3",
        version_number: 4,
      }),
    ],
  });
  let renderedTemplateVersionId: string | null = null;

  const result = await issueReservationTicket(
    {
      reservationId: "reservation-reissue",
      baseUrl: "https://seatwise.test",
      secret: "ticket-secret",
      issuedAt: new Date("2026-03-29T09:15:00+08:00"),
    },
    {
      db: db.db,
      renderTicketPng: async ({ template }) => {
        renderedTemplateVersionId = template.ticket_template_version_id;
        return Buffer.from("ticket-png");
      },
      buildTicketPdf: async () => Uint8Array.from([9, 0, 0, 1]),
    },
  );

  assert.equal(result.ticketTemplateVersionId, "ticket-template-version-3");
  assert.equal(renderedTemplateVersionId, "ticket-template-version-3");
  assert.equal(db.records.reservation.ticket_template_version_id, "ticket-template-version-3");
});
