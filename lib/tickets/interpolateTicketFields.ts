import {
  createEmptyTicketFieldValueMap,
  type TicketFieldValueMap,
} from "./fieldCatalog.ts";

const MANILA_TIME_ZONE = "Asia/Manila";

type TicketInterpolationSeat = {
  section?: string | null;
  row?: string | null;
  seat?: string | null;
};

type TicketInterpolationInput = {
  reservation: {
    reservationId: string;
    reservationNumber: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  show: {
    showName: string;
    venue: string;
  };
  schedule: {
    schedDate: string | Date;
    schedStartTime: string | Date;
  };
  seats: TicketInterpolationSeat[];
  qrToken: string;
  verificationUrl: string;
};

export type InterpolatedTicketFields = {
  fields: TicketFieldValueMap;
  seatLabels: string[];
  qrToken: string;
  verificationUrl: string;
};

function toTrimmedValue(value?: string | null) {
  return value?.trim() ?? "";
}

function formatShowDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatShowTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function joinUnique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => toTrimmedValue(value)).filter(Boolean)),
  ).join(", ");
}

function buildSeatLabel(seat: TicketInterpolationSeat) {
  return [seat.section, seat.row, seat.seat]
    .map((value) => toTrimmedValue(value))
    .filter(Boolean)
    .join(" / ");
}

export function interpolateTicketFields(
  input: TicketInterpolationInput,
): InterpolatedTicketFields {
  const fields = createEmptyTicketFieldValueMap();
  const seatLabels = input.seats.map(buildSeatLabel).filter(Boolean);

  fields.show_name = input.show.showName.trim();
  fields.venue = input.show.venue.trim();
  fields.show_date = formatShowDate(input.schedule.schedDate);
  fields.show_time = formatShowTime(input.schedule.schedStartTime);
  fields.section = joinUnique(input.seats.map((seat) => seat.section));
  fields.row = joinUnique(input.seats.map((seat) => seat.row));
  fields.seat = joinUnique(input.seats.map((seat) => seat.seat));
  fields.reservation_number = input.reservation.reservationNumber.trim();
  fields.customer_name = [input.reservation.firstName, input.reservation.lastName]
    .map((value) => toTrimmedValue(value))
    .filter(Boolean)
    .join(" ");

  return {
    fields,
    seatLabels,
    qrToken: input.qrToken,
    verificationUrl: input.verificationUrl,
  };
}
