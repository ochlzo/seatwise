"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Footprints, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildAdminWalkInRoomHref } from "@/lib/reservations/walkInEntry";

type PrepareResponse = {
  success: true;
  state: "ready";
  showScopeId: string;
  showName?: string;
  message?: string;
};

type ErrorResponse = {
  success?: false;
  error?: string;
  code?: string;
};

export function AdminWalkInPreparationCard({
  showId,
  schedId,
}: {
  showId: string;
  schedId: string;
  adminUserId: string;
}) {
  const router = useRouter();
  const [data, setData] = React.useState<PrepareResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isEntering, setIsEntering] = React.useState(false);
  const roomHref = React.useMemo(
    () => buildAdminWalkInRoomHref(showId, schedId),
    [schedId, showId],
  );

  const prepareWalkIn = React.useCallback(
    async (background = false) => {
      if (background) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        setError(null);
        const response = await fetch("/api/admin/walk-in/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showId, schedId }),
        });

        const payload = (await response.json()) as
          | PrepareResponse
          | ErrorResponse;
        if (
          !response.ok ||
          !("success" in payload) ||
          payload.success !== true
        ) {
          throw new Error(
            ("error" in payload ? payload.error : undefined) ||
              "Failed to prepare walk-in.",
          );
        }

        setData(payload);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to prepare walk-in.",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [schedId, showId],
  );

  React.useEffect(() => {
    void prepareWalkIn(false);
  }, [prepareWalkIn]);

  const handleEnterReservationRoom = () => {
    setIsEntering(true);
    router.push(roomHref);
  };

  return (
    <div className="space-y-6">
      <Card className="border-sidebar-border shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Badge
                variant="outline"
                className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <Footprints className="mr-1 h-3.5 w-3.5" />
                Walk-In Admission
              </Badge>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Walk-In Reservation Room
              </CardTitle>
              <CardDescription>
                Walk-in reservations no longer join the queue. Enter the room
                directly and submit when ready.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void prepareWalkIn(true)}
              disabled={isLoading || isRefreshing || isEntering}
            >
              {isRefreshing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing walk-in reservation room...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Unable to prepare walk-in room
              </div>
              <p className="mt-2">{error}</p>
            </div>
          )}

          {!isLoading && !error && data?.state === "ready" && (
            <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">
                  Walk-in reservation room is ready
                </span>
              </div>
              <p className="text-sm text-emerald-900/80 dark:text-emerald-100/80">
                {data.message}
              </p>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={handleEnterReservationRoom}
                  className="gap-2"
                  disabled={isEntering}
                >
                  {isEntering ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Enter reservation room
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
