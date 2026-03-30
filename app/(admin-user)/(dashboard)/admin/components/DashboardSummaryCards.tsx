import { Activity, CircleDollarSign, Clock3, TicketCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  DashboardReservationBreakdown,
  DashboardScheduleStatusTotals,
  DashboardShowStatusTotals,
  DashboardSummary,
} from "@/lib/dashboard/types";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

type DashboardSummaryCardsProps = {
  summary: DashboardSummary;
  reservationBreakdown: DashboardReservationBreakdown;
  scheduleStatusTotals: DashboardScheduleStatusTotals;
  showStatusTotals: DashboardShowStatusTotals;
};

export function DashboardSummaryCards({
  summary,
  reservationBreakdown,
  scheduleStatusTotals,
  showStatusTotals,
}: DashboardSummaryCardsProps) {
  const cards = [
    {
      label: "Pending review",
      value: summary.pendingReview.toLocaleString(),
      description: `${reservationBreakdown.total.toLocaleString()} reservations recorded in the selected date range`,
      icon: Clock3,
      badge: summary.pendingReview > 0 ? "Needs action" : "Clear",
    },
    {
      label: "Confirmed reservations",
      value: summary.confirmedReservations.toLocaleString(),
      description: `${reservationBreakdown.statuses.CANCELLED.toLocaleString()} cancelled and ${reservationBreakdown.statuses.EXPIRED.toLocaleString()} expired during this period`,
      icon: TicketCheck,
      badge: "Bookings",
    },
    {
      label: "Paid revenue",
      value: currencyFormatter.format(summary.paidRevenue),
      description: "Completed payments within the selected date range",
      icon: CircleDollarSign,
      badge: "Collected",
    },
    {
      label: "Active schedules",
      value: summary.activeSchedules.toLocaleString(),
      description: `${scheduleStatusTotals.OPEN} open, ${scheduleStatusTotals.ON_GOING} running, ${showStatusTotals.OPEN} shows open for booking`,
      icon: Activity,
      badge: "Live ops",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.label}>
            <CardHeader className="gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardDescription>{card.label}</CardDescription>
                  <CardTitle className="text-2xl">{card.value}</CardTitle>
                </div>
                <div className="rounded-full border bg-muted/50 p-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground">
                {card.description}
              </p>
              <Badge variant="outline" className="shrink-0 self-start whitespace-nowrap">
                {card.badge}
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
