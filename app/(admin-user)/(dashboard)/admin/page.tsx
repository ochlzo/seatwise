import AdminShield from "@/components/AdminShield";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { normalizeDashboardFilters } from "@/lib/dashboard/dashboardFilters";
import { getAdminDashboardData } from "@/lib/dashboard/getAdminDashboardData";
import type { DashboardSearchParams } from "@/lib/dashboard/types";

import { DashboardFilters } from "./DashboardFilters";
import { DashboardPaymentSummary } from "./components/DashboardPaymentSummary";
import { DashboardRecentReservations } from "./components/DashboardRecentReservations";
import { DashboardReservationBreakdown } from "./components/DashboardReservationBreakdown";
import { DashboardSummaryCards } from "./components/DashboardSummaryCards";
import { DashboardTopShows } from "./components/DashboardTopShows";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const [params, adminContext] = await Promise.all([
    searchParams,
    getCurrentAdminContext(),
  ]);

  const filters = normalizeDashboardFilters(params, {
    isSuperadmin: adminContext.isSuperadmin,
    teamId: adminContext.teamId,
  });

  const dashboard = await getAdminDashboardData({
    filters,
    adminScope: {
      isSuperadmin: adminContext.isSuperadmin,
      teamId: adminContext.teamId,
    },
  });

  const hasData =
    dashboard.reservationBreakdown.total > 0 ||
    dashboard.paymentSummary.total > 0 ||
    dashboard.recentReservations.length > 0 ||
    Object.values(dashboard.showStatusTotals).some((count) => count > 0) ||
    Object.values(dashboard.scheduleStatusTotals).some((count) => count > 0);

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0 md:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Operational Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor booking activity, paid revenue, and recent admin workload for the selected scope.
          </p>
        </div>

        <DashboardFilters
          filters={dashboard.filters}
          filterOptions={dashboard.filterOptions}
          adminTeamName={adminContext.teamName}
        />

        <DashboardSummaryCards
          summary={dashboard.summary}
          reservationBreakdown={dashboard.reservationBreakdown}
          scheduleStatusTotals={dashboard.scheduleStatusTotals}
          showStatusTotals={dashboard.showStatusTotals}
        />

        {!hasData ? (
          <Card>
            <CardHeader>
              <CardTitle>No dashboard data in this range</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Try a wider date range or switch to another team or show filter to inspect activity.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="flex flex-col gap-6">
              <DashboardReservationBreakdown breakdown={dashboard.reservationBreakdown} />
              <DashboardTopShows
                topShowsByReservations={dashboard.topShowsByReservations}
                topShowsByRevenue={dashboard.topShowsByRevenue}
              />
            </div>
            <div className="flex flex-col gap-6">
              <DashboardPaymentSummary
                paymentSummary={dashboard.paymentSummary}
                metricDateFields={dashboard.metricDateFields}
              />
              <DashboardRecentReservations reservations={dashboard.recentReservations} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
