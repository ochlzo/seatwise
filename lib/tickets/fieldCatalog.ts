export const TICKET_FIELD_CATALOG = [
  { key: "show_name", label: "Show Name" },
  { key: "venue", label: "Venue" },
  { key: "show_date", label: "Show Date" },
  { key: "show_time", label: "Show Time" },
  { key: "section", label: "Section" },
  { key: "row", label: "Row" },
  { key: "seat", label: "Seat" },
  { key: "reservation_number", label: "Booking Ref" },
  { key: "customer_name", label: "Customer Name" },
] as const;

export type TicketFieldKey = (typeof TICKET_FIELD_CATALOG)[number]["key"];

export type TicketFieldValueMap = Record<TicketFieldKey, string>;

const FIELD_LABEL_MAP = new Map<string, string>(
  TICKET_FIELD_CATALOG.map((field) => [field.key, field.label]),
);

export function getTicketFieldLabel(fieldKey: string) {
  return FIELD_LABEL_MAP.get(fieldKey) ?? fieldKey.replaceAll("_", " ");
}

export function createEmptyTicketFieldValueMap(): TicketFieldValueMap {
  return TICKET_FIELD_CATALOG.reduce(
    (fields, field) => {
      fields[field.key] = "";
      return fields;
    },
    {} as TicketFieldValueMap,
  );
}
