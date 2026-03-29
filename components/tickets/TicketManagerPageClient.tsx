"use client";

import * as React from "react";
import { Search, Ticket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filterTicketManagerRows, type TicketManagerRow, type TicketManagerStatus } from "@/lib/tickets/ticketManager";
import { cn } from "@/lib/utils";

type TicketManagerPageClientProps = {
  showName?: string;
  description?: string;
  rows: TicketManagerRow[];
  schedules: Array<{
    schedId: string;
    label: string;
  }>;
  embedded?: boolean;
  initialSchedId?: string;
};

const STATUS_OPTIONS: Array<{
  value: "ALL" | TicketManagerStatus;
  label: string;
}> = [
  { value: "ALL", label: "All statuses" },
  { value: "NOT_ISSUED", label: "Not issued" },
  { value: "VALID", label: "Valid" },
  { value: "CONSUMED", label: "Consumed" },
];

const STATUS_LABELS: Record<TicketManagerStatus, string> = {
  NOT_ISSUED: "Not issued",
  VALID: "Valid",
  CONSUMED: "Consumed",
};

const STATUS_BADGE_STYLES: Record<TicketManagerStatus, string> = {
  NOT_ISSUED: "border-slate-300 bg-slate-100 text-slate-700",
  VALID: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CONSUMED: "border-amber-200 bg-amber-50 text-amber-700",
};

export function TicketManagerPageClient({
  showName,
  description,
  rows,
  schedules,
  embedded = false,
  initialSchedId = "ALL",
}: TicketManagerPageClientProps) {
  const [query, setQuery] = React.useState("");
  const [selectedSchedId, setSelectedSchedId] = React.useState(initialSchedId);
  const [selectedStatus, setSelectedStatus] = React.useState<"ALL" | TicketManagerStatus>("ALL");
  const deferredQuery = React.useDeferredValue(query);

  React.useEffect(() => {
    React.startTransition(() => {
      setSelectedSchedId(initialSchedId);
    });
  }, [initialSchedId]);

  const filteredRows = React.useMemo(
    () =>
      filterTicketManagerRows(rows, {
        query: deferredQuery,
        schedId: selectedSchedId,
        status: selectedStatus,
      }),
    [deferredQuery, rows, selectedSchedId, selectedStatus],
  );

  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col",
        embedded
          ? "min-w-0"
          : "mx-auto max-w-7xl px-4 pb-8 pt-0 md:px-8",
      )}
    >
      {!embedded && showName && description ? (
        <div className="mb-6 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {showName}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
            {description}
          </p>
        </div>
      ) : null}

      <Card
        className={cn(
          "overflow-hidden border-sidebar-border/70",
          embedded && "border-0 shadow-none",
        )}
      >
        <CardHeader className="gap-4 border-b bg-card/80">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ticket className="h-5 w-5 text-primary" />
                Ticket Manager
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {embedded
                  ? "Review seat-level issuance and entry updates while scanning."
                  : "Review seat-level ticket issuance and entry status across schedules."}
              </p>
            </div>
            <div className="grid gap-3 md:min-w-[28rem] md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ref number, seat, guest, email, phone"
                  className="pl-9"
                  aria-label="Search tickets"
                />
              </div>
              <Select value={selectedSchedId} onValueChange={setSelectedSchedId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Schedule" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="ALL">All schedules</SelectItem>
                  {schedules.map((schedule) => (
                    <SelectItem key={schedule.schedId} value={schedule.schedId}>
                      {schedule.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedStatus}
                onValueChange={(value) =>
                  setSelectedStatus(value as "ALL" | TicketManagerStatus)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent align="end">
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[1024px] w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/30 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Ref number
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Seat number
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Guest name
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Guest email
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Guest phone number
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Schedule
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Ticket status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16">
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <Ticket className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm font-medium">No ticket rows found</p>
                        <p className="max-w-md text-sm text-muted-foreground">
                          Try changing the search term or filters to view another schedule or ticket status.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.seatAssignmentId} className="border-b align-top transition-colors hover:bg-muted/20">
                      <td className="px-4 py-4 text-sm font-medium">{row.reservationNumber}</td>
                      <td className="px-4 py-4 text-sm">{row.seatLabel}</td>
                      <td className="px-4 py-4 text-sm">{row.guestName}</td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{row.guestEmail}</td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{row.guestPhoneNumber}</td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{row.scheduleLabel}</td>
                      <td className="px-4 py-4 text-sm">
                        <Badge
                          variant="outline"
                          className={cn("font-medium", STATUS_BADGE_STYLES[row.ticketStatus])}
                        >
                          {STATUS_LABELS[row.ticketStatus]}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
