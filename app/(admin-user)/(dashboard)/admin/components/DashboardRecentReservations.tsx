import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  DashboardRecentReservation,
  DashboardRecentReservationsPagination,
  NormalizedDashboardFilters,
} from "@/lib/dashboard/types";

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending review",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

type DashboardRecentReservationsProps = {
  reservations: DashboardRecentReservation[];
  filters: NormalizedDashboardFilters;
  pagination: DashboardRecentReservationsPagination;
};

export function DashboardRecentReservations({
  reservations,
  filters,
  pagination,
}: DashboardRecentReservationsProps) {
  const buildPageHref = (page: number) => {
    const params = new URLSearchParams();

    params.set("range", filters.range);

    if (filters.range === "custom") {
      params.set("from", filters.from);
      params.set("to", filters.to);
    }

    if (filters.teamId) {
      params.set("teamId", filters.teamId);
    }

    if (filters.showId) {
      params.set("showId", filters.showId);
    }

    if (page > 1) {
      params.set("recentPage", String(page));
    }

    return `/admin?${params.toString()}`;
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Recent reservations</CardTitle>
            <CardDescription>
              Latest reservations, with review items shown first.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/reservations">Open reservations</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {reservations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reservations matched the selected filters.
          </p>
        ) : (
          reservations.map((reservation) => (
            <div key={reservation.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {reservation.guestName} - {reservation.reservationNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">{reservation.showName}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status}</p>
                  <p>{dateFormatter.format(reservation.createdAt)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  Payment:{" "}
                  {reservation.paymentStatus
                    ? (PAYMENT_STATUS_LABELS[reservation.paymentStatus] ?? reservation.paymentStatus)
                    : "N/A"}
                </span>
                <span>
                  Amount:{" "}
                  {reservation.paymentAmount !== null
                    ? reservation.paymentAmount.toLocaleString("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      })
                    : "N/A"}
                </span>
                {reservation.teamName ? <span>Team: {reservation.teamName}</span> : null}
              </div>
            </div>
          ))
        )}

        {pagination.totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              {pagination.hasPreviousPage ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={buildPageHref(pagination.page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
              )}
              {pagination.hasNextPage ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={buildPageHref(pagination.page + 1)}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
