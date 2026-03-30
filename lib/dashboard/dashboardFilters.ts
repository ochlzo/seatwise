import type { DashboardAdminScope, DashboardRange, DashboardSearchParams, NormalizedDashboardFilters } from "./types.ts";

const DASHBOARD_RANGE_VALUES = new Set<DashboardRange>(["7d", "30d", "90d", "custom"]);
const DEFAULT_RANGE: Exclude<DashboardRange, "custom"> = "30d";
const MANILA_TZ = "Asia/Manila";

const RANGE_LENGTHS: Record<Exclude<DashboardRange, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatManilaDateKey = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
};

const trimToNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const parseDateOnly = (value?: string | null) => {
  const trimmed = trimToNull(value);
  if (!trimmed || !DATE_ONLY_PATTERN.test(trimmed)) {
    return null;
  }

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatUtcDateKey(date) === trimmed ? trimmed : null;
};

const formatUtcDateKey = (value: Date) => value.toISOString().slice(0, 10);

const addUtcDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDateKey(date);
};

const getPresetWindow = (range: Exclude<DashboardRange, "custom">, now: Date) => {
  const to = formatManilaDateKey(now);
  const from = addUtcDays(to, -(RANGE_LENGTHS[range] - 1));
  return { from, to };
};

const normalizeRange = (range?: string | null): DashboardRange =>
  DASHBOARD_RANGE_VALUES.has((range ?? "") as DashboardRange)
    ? ((range ?? DEFAULT_RANGE) as DashboardRange)
    : DEFAULT_RANGE;

export function normalizeDashboardFilters(
  searchParams: DashboardSearchParams,
  adminScope: DashboardAdminScope,
  now = new Date(),
): NormalizedDashboardFilters {
  const requestedRange = normalizeRange(searchParams.range);
  const requestedFrom = parseDateOnly(searchParams.from);
  const requestedTo = parseDateOnly(searchParams.to);
  const hasValidCustomWindow =
    requestedFrom !== null &&
    requestedTo !== null &&
    requestedFrom <= requestedTo;

  const range: DashboardRange =
    requestedRange === "custom" && hasValidCustomWindow ? "custom" : DEFAULT_RANGE;
  const presetWindow = getPresetWindow(DEFAULT_RANGE, now);
  const dateWindow =
    range === "custom"
      ? { from: requestedFrom!, to: requestedTo! }
      : requestedRange === "custom"
        ? presetWindow
        : getPresetWindow(requestedRange as Exclude<DashboardRange, "custom">, now);

  const requestedTeamId = trimToNull(searchParams.teamId);
  const effectiveTeamId = adminScope.isSuperadmin ? requestedTeamId : adminScope.teamId;

  return {
    range: range === DEFAULT_RANGE && requestedRange !== "custom" ? requestedRange : range,
    from: dateWindow.from,
    to: dateWindow.to,
    teamId: effectiveTeamId,
    effectiveTeamId,
    showId: trimToNull(searchParams.showId),
  };
}

export function buildDashboardWindows(filters: NormalizedDashboardFilters) {
  const nextDate = addUtcDays(filters.to, 1);

  return {
    timestamps: {
      gte: new Date(`${filters.from}T00:00:00+08:00`),
      lt: new Date(`${nextDate}T00:00:00+08:00`),
    },
    scheduleDates: {
      gte: new Date(`${filters.from}T00:00:00.000Z`),
      lt: new Date(`${nextDate}T00:00:00.000Z`),
    },
  };
}
