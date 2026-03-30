import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardRecentReservation } from "@/lib/dashboard/types";

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type DashboardRecentReservationsProps = {
  reservations: DashboardRecentReservation[];
};

export function DashboardRecentReservations({
  reservations,
}: DashboardRecentReservationsProps) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Recent reservations</CardTitle>
            <CardDescription>
              Prioritizes reservations still waiting for admin review.
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
            <div
              key={reservation.id}
              className="rounded-lg border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {reservation.guestName} · {reservation.reservationNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">{reservation.showName}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{reservation.status}</p>
                  <p>{dateFormatter.format(reservation.createdAt)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Payment: {reservation.paymentStatus ?? "N/A"}</span>
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
      </CardContent>
    </Card>
  );
}
