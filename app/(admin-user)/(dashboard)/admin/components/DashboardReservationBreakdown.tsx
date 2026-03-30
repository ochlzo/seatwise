import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DashboardReservationBreakdown } from "@/lib/dashboard/types";

const STATUS_COPY: Array<{
  key: keyof DashboardReservationBreakdown["statuses"];
  label: string;
}> = [
  { key: "PENDING", label: "Pending review" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "EXPIRED", label: "Expired" },
];

type DashboardReservationBreakdownProps = {
  breakdown: DashboardReservationBreakdown;
};

export function DashboardReservationBreakdown({
  breakdown,
}: DashboardReservationBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservation breakdown</CardTitle>
        <CardDescription>
          How reservations are currently distributed in the selected date range.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {STATUS_COPY.map((status) => {
          const count = breakdown.statuses[status.key];
          const percentage = breakdown.total > 0 ? Math.round((count / breakdown.total) * 100) : 0;

          return (
            <div key={status.key} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{status.label}</span>
                  <Badge variant="outline">{percentage}%</Badge>
                </div>
                <span className="text-sm text-muted-foreground">{count.toLocaleString()}</span>
              </div>
              <Progress value={percentage} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
