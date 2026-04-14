import { prisma } from "../prisma.ts";

import { buildTicketPdf as buildTicketPdfDocument } from "./buildTicketPdf.ts";
import { interpolateTicketFields } from "./interpolateTicketFields.ts";
import {
  buildTicketVerificationUrl,
  createSignedQrPayload,
} from "./qrPayload.ts";
import { renderTicketPng as renderTicketPngDocument } from "./renderTicketPng.ts";
import { normalizeTemplateVersion } from "./templateSchema.ts";
import type { TicketTemplateVersion } from "./types.ts";

type LoadedReservation = {
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
          price: number;
        };
      };
      seat: {
        seat_number: string;
      };
    };
  }>;
};

type StoredTicketTemplateVersion = {
  ticket_template_version_id: string;
  ticket_template_id: string;
  version_number: number;
  template_schema: TicketTemplateVersion | unknown;
  createdAt?: Date;
};

export type ResolvedTicketTemplateVersion = {
  ticket_template_version_id: string;
  ticket_template_id: string;
  version_number: number;
  template_schema: TicketTemplateVersion;
  createdAt?: Date;
};

export type IssueReservationTicketDb = {
  reservation: {
    findUnique(args: {
      where: { reservation_id: string };
      select?: unknown;
    }): Promise<LoadedReservation | null>;
    update(args: {
      where: { reservation_id: string };
      data: {
        ticket_template_version_id: string;
        ticket_issued_at: Date;
        ticket_delivery_error: string | null;
      };
    }): Promise<LoadedReservation>;
  };
  ticketTemplateVersion: {
    findUnique(args: {
      where: { ticket_template_version_id: string };
    }): Promise<StoredTicketTemplateVersion | null>;
    findFirst(args: {
      where: { ticket_template_id: string };
      orderBy: { version_number: "asc" | "desc" };
    }): Promise<StoredTicketTemplateVersion | null>;
  };
};

type IssueReservationTicketInput = {
  reservationId: string;
  baseUrl: string;
  secret?: string;
  issuedAt?: Date;
};

type IssueReservationTicketDeps = {
  db?: IssueReservationTicketDb;
  renderTicketPng?: (input: {
    template: ResolvedTicketTemplateVersion;
    fields: Partial<Record<string, string>>;
    qrValue: string;
  }) => Promise<Uint8Array>;
  buildTicketPdf?: (input: { ticketPng: Uint8Array }) => Promise<Uint8Array>;
};

export type IssuedReservationTicket = {
  reservationId: string;
  reservationNumber: string;
  customerName: string;
  email: string;
  showName: string;
  venue: string;
  scheduleLabel: string;
  seatLabels: string[];
  ticketTemplateVersionId: string;
  ticketIssuedAt: Date;
  ticketPdfs: Array<{
    seatAssignmentId: string;
    seatLabel: string;
    qrToken: string;
    verificationUrl: string;
    ticketPdf: Uint8Array;
    ticketPdfFilename: string;
  }>;
};

const DEFAULT_DB = prisma as unknown as IssueReservationTicketDb;
const MANILA_TIME_ZONE = "Asia/Manila";

function resolveBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new Error("Ticket issuance requires a base URL.");
  }

  return trimmed;
}

function formatScheduleLabel(schedule: LoadedReservation["sched"]) {
  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(schedule.sched_date);
  const timeLabel = new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(schedule.sched_start_time);

  return `${dateLabel}, ${timeLabel}`;
}

function buildIssuedTicketFilename(seatLabel: string, reservationNumber: string) {
  return `seatwise-ticket-${seatLabel}-${reservationNumber}.pdf`;
}

function formatSeatPrice(value: number | string | { toString(): string } | null | undefined) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : value && typeof value.toString === "function"
          ? Number.parseFloat(value.toString())
          : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(numericValue);
}

function mapTemplateVersion(
  version: StoredTicketTemplateVersion,
): ResolvedTicketTemplateVersion {
  return {
    ticket_template_version_id: version.ticket_template_version_id,
    ticket_template_id: version.ticket_template_id,
    version_number: version.version_number,
    template_schema: normalizeTemplateVersion(
      version.template_schema as Partial<TicketTemplateVersion> | null | undefined,
    ),
    createdAt: version.createdAt,
  };
}

async function loadReservation(
  reservationId: string,
  db: IssueReservationTicketDb,
) {
  const reservation = await db.reservation.findUnique({
    where: { reservation_id: reservationId },
    select: {
      reservation_id: true,
      reservation_number: true,
      first_name: true,
      last_name: true,
      email: true,
      status: true,
      ticket_template_version_id: true,
      ticket_issued_at: true,
      ticket_delivery_error: true,
      show: {
        select: {
          show_id: true,
          show_name: true,
          venue: true,
          ticket_template_id: true,
        },
      },
      sched: {
        select: {
          sched_id: true,
          sched_date: true,
          sched_start_time: true,
        },
      },
      reservedSeats: {
        select: {
          seatAssignment: {
            select: {
              seat_assignment_id: true,
              seat_id: true,
              updatedAt: true,
              seat: {
                select: {
                  seat_number: true,
                },
              },
              set: {
                select: {
                  seatCategory: {
                    select: {
                      category_name: true,
                      price: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!reservation) {
    throw new Error("Reservation not found.");
  }

  if (reservation.status !== "CONFIRMED") {
    throw new Error("Only confirmed reservations can be issued a ticket.");
  }

  return reservation;
}

async function resolveTemplateVersion(
  reservation: LoadedReservation,
  db: IssueReservationTicketDb,
) {
  if (reservation.ticket_template_version_id) {
    const storedVersion = await db.ticketTemplateVersion.findUnique({
      where: {
        ticket_template_version_id: reservation.ticket_template_version_id,
      },
    });

    if (!storedVersion) {
      throw new Error("Stored ticket template version could not be found.");
    }

    return mapTemplateVersion(storedVersion);
  }

  const ticketTemplateId = reservation.show.ticket_template_id?.trim();
  if (!ticketTemplateId) {
    throw new Error("Show does not have an assigned ticket template.");
  }

  const latestVersion = await db.ticketTemplateVersion.findFirst({
    where: {
      ticket_template_id: ticketTemplateId,
    },
    orderBy: {
      version_number: "desc",
    },
  });

  if (!latestVersion) {
    throw new Error("No saved ticket template version is available for this show.");
  }

  return mapTemplateVersion(latestVersion);
}

const defaultRenderTicketPng = async ({
  template,
  fields,
  qrValue,
}: {
  template: ResolvedTicketTemplateVersion;
  fields: Partial<Record<string, string>>;
  qrValue: string;
}) =>
  renderTicketPngDocument({
    template: template.template_schema,
    fields,
    qrValue,
  });

const defaultBuildTicketPdf = async ({ ticketPng }: { ticketPng: Uint8Array }) =>
  buildTicketPdfDocument({ ticketPng });

export async function issueReservationTicket(
  input: IssueReservationTicketInput,
  deps: IssueReservationTicketDeps = {},
): Promise<IssuedReservationTicket> {
  const db = deps.db ?? DEFAULT_DB;
  const reservation = await loadReservation(input.reservationId, db);
  const templateVersion = await resolveTemplateVersion(reservation, db);
  const baseUrl = resolveBaseUrl(input.baseUrl);
  const interpolated = interpolateTicketFields({
    reservation: {
      reservationId: reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
      firstName: reservation.first_name,
      lastName: reservation.last_name,
    },
    show: {
      showName: reservation.show.show_name,
      venue: reservation.show.venue,
    },
    schedule: {
      schedDate: reservation.sched.sched_date,
      schedStartTime: reservation.sched.sched_start_time,
    },
    seats: reservation.reservedSeats.map(({ seatAssignment }) => ({
      seatCategory: seatAssignment.set?.seatCategory?.category_name,
      price: seatAssignment.set?.seatCategory?.price,
      seat: seatAssignment.seat.seat_number,
    })),
    qrToken: "",
    verificationUrl: "",
  });
  const renderTicketPng = deps.renderTicketPng ?? defaultRenderTicketPng;
  const buildTicketPdf = deps.buildTicketPdf ?? defaultBuildTicketPdf;
  const ticketPdfs = await Promise.all(
    reservation.reservedSeats.map(async ({ seatAssignment }, index) => {
      const seatLabel = interpolated.seatLabels[index] ?? seatAssignment.seat.seat_number;
      const qrToken = createSignedQrPayload(
        {
          reservationId: reservation.reservation_id,
          reservationNumber: reservation.reservation_number,
          seatAssignmentId: seatAssignment.seat_assignment_id,
        },
        { secret: input.secret },
      );
      const verificationUrl = buildTicketVerificationUrl(qrToken, {
        baseUrl,
      });
      const ticketPng = await renderTicketPng({
        template: templateVersion,
        fields: {
          ...interpolated.fields,
          seat: seatLabel,
          seat_category: seatAssignment.set?.seatCategory?.category_name ?? "",
          price: formatSeatPrice(seatAssignment.set?.seatCategory?.price),
        },
        qrValue: verificationUrl,
      });
      const ticketPdf = await buildTicketPdf({ ticketPng });

      return {
        seatAssignmentId: seatAssignment.seat_assignment_id,
        seatLabel,
        qrToken,
        verificationUrl,
        ticketPdf,
        ticketPdfFilename: buildIssuedTicketFilename(
          seatLabel,
          reservation.reservation_number,
        ),
      };
    }),
  );
  const ticketIssuedAt = input.issuedAt ?? new Date();

  await db.reservation.update({
    where: {
      reservation_id: reservation.reservation_id,
    },
    data: {
      ticket_template_version_id: templateVersion.ticket_template_version_id,
      ticket_issued_at: ticketIssuedAt,
      ticket_delivery_error: null,
    },
  });

  return {
    reservationId: reservation.reservation_id,
    reservationNumber: reservation.reservation_number,
    customerName: `${reservation.first_name} ${reservation.last_name}`.trim(),
    email: reservation.email,
    showName: reservation.show.show_name,
    venue: reservation.show.venue,
    scheduleLabel: formatScheduleLabel(reservation.sched),
    seatLabels: interpolated.seatLabels,
    ticketTemplateVersionId: templateVersion.ticket_template_version_id,
    ticketIssuedAt,
    ticketPdfs,
  };
}

export { buildIssuedTicketFilename };
