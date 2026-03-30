import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { DashboardPaymentSummary as DashboardPaymentSummaryData } from "@/lib/dashboard/types";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

type DashboardPaymentSummaryProps = {
  paymentSummary: DashboardPaymentSummaryData;
};

export function DashboardPaymentSummary({
  paymentSummary,
}: DashboardPaymentSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment summary</CardTitle>
        <CardDescription>
          Revenue collected and payment outcomes for the selected date range.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Paid revenue</p>
            <p className="text-2xl font-semibold">{currencyFormatter.format(paymentSummary.paidRevenue)}</p>
          </div>
          <Badge variant="secondary">{paymentSummary.paidCount} completed payments</Badge>
        </div>

        <Separator />

        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(paymentSummary.statuses).map(([status, count]) => (
            <div key={status} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {PAYMENT_STATUS_LABELS[status] ?? status.replaceAll("_", " ")}
              </p>
              <p className="mt-2 text-xl font-semibold">{count.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
