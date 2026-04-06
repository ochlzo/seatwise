const MANILA_TIME_ZONE = "Asia/Manila";

function normalizeTicketDate(value: string | Date) {
  if (value instanceof Date) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+08:00`);
  }

  if (/^\d{2}:\d{2}$/.test(value)) {
    return new Date(`1970-01-01T${value}:00+08:00`);
  }

  return new Date(value);
}

export function formatTicketShowDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(normalizeTicketDate(value));
}

export function formatTicketShowTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(normalizeTicketDate(value));
}
