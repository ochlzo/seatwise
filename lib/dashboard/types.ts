import type {
  PaymentStatus,
  ReservationStatus,
  ShowStatus,
} from "@prisma/client";

export type DashboardRange = "7d" | "30d" | "90d" | "custom";

export type DashboardSearchParams = {
  range?: string;
  from?: string;
  to?: string;
  teamId?: string;
  showId?: string;
};

export type DashboardAdminScope = {
  isSuperadmin: boolean;
  teamId: string | null;
};

export type NormalizedDashboardFilters = {
  range: DashboardRange;
  from: string;
  to: string;
  teamId: string | null;
  effectiveTeamId: string | null;
  showId: string | null;
};

export type DashboardFilterOption = {
  value: string;
  label: string;
};

export type AdminDashboardFilterOptions = {
  canFilterTeams: boolean;
  teams: DashboardFilterOption[];
  shows: DashboardFilterOption[];
};

export type DashboardMetricDateField =
  | "Reservation.createdAt"
  | "Payment.createdAt"
  | "Payment.paid_at"
  | "Sched.sched_date";

export const DASHBOARD_METRIC_DATE_FIELDS: Record<string, DashboardMetricDateField> = {
  reservationCounts: "Reservation.createdAt",
  paymentStatusCounts: "Payment.createdAt",
  paidRevenue: "Payment.paid_at",
  showStatusTotals: "Sched.sched_date",
  scheduleStatusTotals: "Sched.sched_date",
  recentReservations: "Reservation.createdAt",
  topShowsByReservations: "Reservation.createdAt",
  topShowsByRevenue: "Payment.paid_at",
};

export type DashboardSummary = {
  pendingReview: number;
  confirmedReservations: number;
  paidRevenue: number;
  activeSchedules: number;
};

export type DashboardReservationBreakdown = {
  total: number;
  statuses: Record<ReservationStatus, number>;
};

export type DashboardPaymentSummary = {
  total: number;
  paidRevenue: number;
  paidCount: number;
  statuses: Record<PaymentStatus, number>;
};

export type DashboardShowStatusTotals = Record<ShowStatus, number>;

export type DashboardScheduleStatus =
  | "OPEN"
  | "ON_GOING"
  | "FULLY_BOOKED"
  | "CLOSED";

export type DashboardScheduleStatusTotals = Record<DashboardScheduleStatus, number>;

export type DashboardTopShow = {
  showId: string;
  showName: string;
  reservationCount: number;
  paidRevenue: number;
};

export type DashboardRecentReservation = {
  id: string;
  reservationNumber: string;
  guestName: string;
  showId: string;
  showName: string;
  teamName: string | null;
  schedId: string;
  schedDate: Date;
  schedStartTime: Date;
  createdAt: Date;
  status: ReservationStatus;
  paymentStatus: PaymentStatus | null;
  paymentAmount: number | null;
};

export type AdminDashboardData = {
  filters: NormalizedDashboardFilters;
  filterOptions: AdminDashboardFilterOptions;
  metricDateFields: typeof DASHBOARD_METRIC_DATE_FIELDS;
  summary: DashboardSummary;
  reservationBreakdown: DashboardReservationBreakdown;
  paymentSummary: DashboardPaymentSummary;
  showStatusTotals: DashboardShowStatusTotals;
  scheduleStatusTotals: DashboardScheduleStatusTotals;
  topShowsByReservations: DashboardTopShow[];
  topShowsByRevenue: DashboardTopShow[];
  recentReservations: DashboardRecentReservation[];
};
