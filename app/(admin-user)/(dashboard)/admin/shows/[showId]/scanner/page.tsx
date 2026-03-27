import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, Ticket } from "lucide-react";

import AdminShield from "@/components/AdminShield";
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
  const ticketTemplate = show.ticket_template_id
    ? await getTicketTemplateById(show.ticket_template_id, {
        teamId: adminContext.teamId,
        isSuperadmin: adminContext.isSuperadmin,
      })
    : null;

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
            This dedicated scanner route is ready. Live camera scanning and consume
            results land in Task 7.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-sidebar-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ticket className="h-4 w-4 text-primary" />
                Scanner Surface
              </CardTitle>
              <CardDescription>
                Admin staff will scan ticket QR codes here once the consume flow is
                implemented.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-8 text-center">
                <p className="text-sm font-medium">Scanner UI pending Task 7</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  The route and launcher are in place so the show-detail screen can
                  target the final scanner surface now.
                </p>
              </div>
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
                    scanner consume flow goes live.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
