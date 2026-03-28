import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft } from "lucide-react";

import AdminShield from "@/components/AdminShield";
import { AdminTicketScanner } from "@/components/tickets/AdminTicketScanner";
import { PageHeader } from "@/components/page-header";
import { ThemeSwithcer } from "@/components/theme-swithcer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { getShowById } from "@/lib/db/Shows";
import { getTicketTemplateById } from "@/lib/db/TicketTemplates";

const formatScheduleLabel = (dateValue: Date, startValue: Date) => {
  const dateLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateValue));
  const timeLabel = new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(startValue));

  return `${dateLabel} at ${timeLabel}`;
};

export default async function AdminShowScannerPage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const { showId } = await params;
  const show = await getShowById(showId);

  if (!show) {
    notFound();
  }

  const adminContext = await getCurrentAdminContext();

  if (!adminContext.isSuperadmin && show.team_id !== adminContext.teamId) {
    notFound();
  }

  const ticketTemplate = show.ticket_template_id
    ? await getTicketTemplateById(show.ticket_template_id, {
        teamId: adminContext.teamId,
        isSuperadmin: adminContext.isSuperadmin,
      })
    : null;

  const schedules = show.scheds.map((schedule) => {
    const categoriesById = new Map<
      string,
      {
        category_id: string;
        name: string;
        color_code: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
        price: string;
      }
    >();
    const seatCategoryAssignments: Record<string, string> = {};
    const seatStatusById: Record<
      string,
      (typeof schedule.seatAssignments)[number]["seat_status"]
    > = {};

    schedule.seatAssignments.forEach((assignment) => {
      const categoryId = assignment.set.seat_category_id;
      seatCategoryAssignments[assignment.seat_id] = categoryId;
      seatStatusById[assignment.seat_id] = assignment.seat_status;

      if (!categoriesById.has(categoryId)) {
        categoriesById.set(categoryId, {
          category_id: categoryId,
          name: assignment.set.seatCategory.category_name,
          color_code: assignment.set.seatCategory.color_code,
          price: assignment.set.seatCategory.price.toString(),
        });
      }
    });

    return {
      schedId: schedule.sched_id,
      label: formatScheduleLabel(schedule.sched_date, schedule.sched_start_time),
      seatmapCategories: Array.from(categoriesById.values()),
      seatCategoryAssignments,
      seatStatusById,
    };
  });

  return (
    <>
      <PageHeader
        title="Ticket Scanner"
        rightSlot={
          <>
            <ThemeSwithcer />
            <AdminShield />
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 pt-0 md:p-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold md:text-xl">{show.show_name}</h2>
          <p className="text-sm text-muted-foreground">
            Scan signed ticket QR codes here to consume issued tickets for this
            show.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-sidebar-border">
            <CardHeader>
              <CardTitle className="text-base">Readiness</CardTitle>
              <CardDescription>
                Current show-level configuration for ticket scanning.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-sidebar-border/60 bg-muted/30 px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Assigned Ticket Template</p>
                  <p className="text-xs text-muted-foreground">
                    {ticketTemplate?.template_name ?? "No template assigned"}
                  </p>
                </div>
                <Badge variant={ticketTemplate ? "default" : "secondary"}>
                  {ticketTemplate ? "Ready" : "Missing"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-sidebar-border/60 bg-muted/30 px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Seatmap</p>
                  <p className="text-xs text-muted-foreground">
                    {show.seatmap_id ? "Seatmap assigned" : "No seatmap assigned"}
                  </p>
                </div>
                <Badge variant={show.seatmap_id ? "default" : "secondary"}>
                  {show.seatmap_id ? "Ready" : "Missing"}
                </Badge>
              </div>
              {!ticketTemplate ? (
                <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-sm">
                    Assign a ticket template on the show detail page before the
                    scanner consume flow is used for live entry.
                  </p>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild className="sm:flex-1">
                  <Link href={`/admin/shows/${show.show_id}`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back To Show
                  </Link>
                </Button>
                <Button variant="outline" asChild className="sm:flex-1">
                  <Link href="/admin/ticket-templates">Manage Ticket Templates</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <AdminTicketScanner
          showId={show.show_id}
          showName={show.show_name}
          seatmapId={show.seatmap_id}
          schedules={schedules}
        />
      </div>
    </>
  );
}
