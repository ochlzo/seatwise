"use client";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  Ticket,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TicketVerificationResult as TicketVerificationResultData } from "@/lib/tickets/verifyIssuedTicket";

type TicketVerificationResultProps = {
  result: TicketVerificationResultData | null;
  loading?: boolean;
  title?: string;
  description?: string;
  emptyMessage?: string;
  className?: string;
};

function formatConsumedAt(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

export function TicketVerificationResult({
  result,
  loading = false,
  title = "Ticket Status",
  description,
  emptyMessage = "Scan or open a ticket to view its verification status.",
  className,
}: TicketVerificationResultProps) {
  if (loading) {
    return (
      <Card className={cn("border-sidebar-border", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Checking ticket
          </CardTitle>
          <CardDescription>
            Looking up the signed ticket token.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className={cn("border-sidebar-border", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
          <CardDescription>{description ?? emptyMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (result.status === "INVALID") {
    return (
      <Card className={cn("border-destructive/40", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Invalid Ticket
          </CardTitle>
          <CardDescription>{result.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isConsumed = result.status === "CONSUMED";
  const consumedAtLabel = formatConsumedAt(result.consumedAt);

  return (
    <Card className={cn("border-sidebar-border", className)}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {isConsumed ? (
                <Clock3 className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              {title}
            </CardTitle>
            <CardDescription>
              {description ??
                (isConsumed
                  ? "This ticket was already consumed."
                  : "This signed ticket is valid.")}
            </CardDescription>
          </div>
          <Badge variant={isConsumed ? "secondary" : "default"}>
            {result.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Booking Ref
          </p>
          <p className="font-semibold">{result.reservationNumber}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Show
          </p>
          <p className="font-semibold">{result.showName}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Venue
          </p>
          <p>{result.venue}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Schedule
          </p>
          <p>{`${result.scheduleDate} at ${result.scheduleTime}`}</p>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Seats
          </p>
          <div className="flex flex-wrap gap-2">
            {result.seatLabels.map((seatLabel) => (
              <Badge key={seatLabel} variant="outline">
                {seatLabel}
              </Badge>
            ))}
          </div>
        </div>
        {consumedAtLabel ? (
          <div className="space-y-1 sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Consumed At
            </p>
            <p>{consumedAtLabel}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
