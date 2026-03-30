import { TrendingUp, Wallet } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardTopShow } from "@/lib/dashboard/types";

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

type DashboardTopShowsProps = {
  topShowsByReservations: DashboardTopShow[];
  topShowsByRevenue: DashboardTopShow[];
};

export function DashboardTopShows({
  topShowsByReservations,
  topShowsByRevenue,
}: DashboardTopShowsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top shows</CardTitle>
        <CardDescription>
          Ranked from grouped dashboard data instead of client-side sorting of a full admin list.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="reservations">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="reservations">
              <TrendingUp className="h-4 w-4" />
              Reservation volume
            </TabsTrigger>
            <TabsTrigger value="revenue">
              <Wallet className="h-4 w-4" />
              Paid revenue
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reservations" className="mt-4 space-y-3">
            {topShowsByReservations.map((show, index) => (
              <div key={show.showId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {index + 1}. {show.showName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {show.reservationCount.toLocaleString()} reservations
                  </p>
                </div>
                <p className="text-sm font-medium">{currencyFormatter.format(show.paidRevenue)}</p>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="revenue" className="mt-4 space-y-3">
            {topShowsByRevenue.map((show, index) => (
              <div key={show.showId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {index + 1}. {show.showName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {show.reservationCount.toLocaleString()} reservations in the same range
                  </p>
                </div>
                <p className="text-sm font-medium">{currencyFormatter.format(show.paidRevenue)}</p>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
