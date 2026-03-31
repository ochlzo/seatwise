"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Footprints, Loader2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildAdminWalkInRoomHref,
  shouldAutoEnterWalkInRoom,
  type WalkInEntryState,
} from "@/lib/reservations/walkInEntry";

type PrepareResponse =
  | {
      success: true;
      state: "queued";
      showScopeId: string;
      showName?: string;
      ticketId?: string;
      rank?: number;
      estimatedWaitMinutes?: number;
      message?: string;
    }
  | {
      success: true;
      state: "active_and_paused";
      showScopeId: string;
      showName?: string;
      ticketId?: string;
      activeToken?: string;
      expiresAt?: number | null;
      message?: string;
    };

type ErrorResponse = {
  success?: false;
  error?: string;
  code?: string;
};

const POLL_MS = 4000;

export function AdminWalkInPreparationCard({
  showId,
  schedId,
  adminUserId,
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
  const [isExiting, setIsExiting] = React.useState(false);
  const previousStateRef = React.useRef<WalkInEntryState | null>(null);
  const allowNavigationRef = React.useRef(false);
  const hasTerminatedRef = React.useRef(false);
  const roomHref = React.useMemo(() => buildAdminWalkInRoomHref(showId, schedId), [schedId, showId]);
  const returnHref = React.useMemo(() => `/admin/shows/${showId}`, [showId]);

  const terminateQueueSession = React.useCallback(
    async (preferBeacon: boolean) => {
      if (!data?.ticketId || hasTerminatedRef.current) {
        return;
      }

      hasTerminatedRef.current = true;
      const payload = JSON.stringify({
        showId,
        schedId,
        guestId: adminUserId,
        ticketId: data.ticketId,
        activeToken: data.state === "active_and_paused" ? data.activeToken : undefined,
      });

      if (
        preferBeacon &&
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/queue/terminate", blob);
        return;
      }

      try {
        await fetch("/api/queue/terminate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      } catch {
        // Best effort
      }
    },
    [adminUserId, data, schedId, showId],
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

        const payload = (await response.json()) as PrepareResponse | ErrorResponse;
        if (!response.ok || !("success" in payload) || payload.success !== true) {
          throw new Error(("error" in payload ? payload.error : undefined) || "Failed to prepare walk-in.");
        }

        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to prepare walk-in.");
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

  React.useEffect(() => {
    if (data?.state !== "queued") return;
    const timer = window.setInterval(() => {
      void prepareWalkIn(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [data?.state, prepareWalkIn]);

  const activeSession = React.useMemo(
    () =>
      data?.state === "active_and_paused" &&
      data.ticketId &&
      data.activeToken
        ? {
            ticketId: data.ticketId,
            activeToken: data.activeToken,
            expiresAt: data.expiresAt ?? null,
            showScopeId: data.showScopeId,
          }
        : null,
    [data],
  );

  const persistActiveSession = React.useCallback(
    (session: NonNullable<typeof activeSession>) => {
      if (typeof window === "undefined") return;

      const storageKey = `seatwise:active:${session.showScopeId}:${session.ticketId}`;
      window.sessionStorage.setItem(storageKey, JSON.stringify(session));
    },
    [],
  );

  React.useEffect(() => {
    if (!data) return;

    const previousState = previousStateRef.current;
    previousStateRef.current = data.state;

    if (!activeSession) {
      return;
    }

    if (shouldAutoEnterWalkInRoom(previousState, data.state)) {
      persistActiveSession(activeSession);
      allowNavigationRef.current = true;
      router.replace(roomHref);
    }
  }, [activeSession, data, persistActiveSession, roomHref, router]);

  const handleEnterReservationRoom = () => {
    if (!activeSession) return;
    persistActiveSession(activeSession);
    allowNavigationRef.current = true;
    router.push(roomHref);
  };

  const handleExitQueue = React.useCallback(async () => {
    if (!data?.ticketId || isExiting) return;

    const confirmed = window.confirm(
      data.state === "active_and_paused"
        ? "Exiting now will release the reservation room and update the queue. Continue?"
        : "Exiting now will remove this walk-in from the queue. Continue?",
    );
    if (!confirmed) {
      return;
    }

    setIsExiting(true);
    setError(null);
    allowNavigationRef.current = true;

    try {
      await terminateQueueSession(false);
      router.push(returnHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to exit queue.");
      setIsExiting(false);
    }
  }, [data, isExiting, returnHref, router, terminateQueueSession]);

  React.useEffect(() => {
    hasTerminatedRef.current = false;
    allowNavigationRef.current = false;
  }, [showId, schedId, data?.ticketId]);

  React.useEffect(() => {
    const hasTerminableTicket = data?.state === "queued" || data?.state === "active_and_paused";
    if (!hasTerminableTicket || !data?.ticketId) return;

    const confirmLeaveMessage =
      data.state === "active_and_paused"
        ? "Leaving this page will release the reservation room and update the queue. Continue?"
        : "Leaving this page will remove this walk-in from the queue. Continue?";

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePageHide = () => {
      if (allowNavigationRef.current) return;
      void terminateQueueSession(true);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (allowNavigationRef.current) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.origin !== currentUrl.origin) return;

      const currentPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (currentPath === nextPath) return;
      if (nextUrl.pathname === roomHref && data.state === "active_and_paused") return;

      event.preventDefault();
      const confirmed = window.confirm(confirmLeaveMessage);
      if (!confirmed) return;

      allowNavigationRef.current = true;
      void terminateQueueSession(true);
      router.push(nextPath);
    };

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        if (allowNavigationRef.current) return;
        void terminateQueueSession(true);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [data?.state, data?.ticketId, roomHref, router, terminateQueueSession]);

  React.useEffect(() => {
    const hasTerminableTicket = data?.state === "queued" || data?.state === "active_and_paused";
    if (!hasTerminableTicket || !data?.ticketId) return;

    const backGuardMessage =
      data.state === "active_and_paused"
        ? "Leaving this page will release the reservation room and update the queue."
        : "Leaving this page will remove this walk-in from the queue.";
    const guardState = { __seatwiseQueueGuard: true, showId, schedId };

    window.history.pushState(guardState, "", window.location.href);

    const handlePopState = () => {
      if (allowNavigationRef.current) return;
      window.alert(backGuardMessage);
      window.history.pushState(guardState, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [data?.state, data?.ticketId, schedId, showId]);

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
                Walk-In Queue Status
              </CardTitle>
              <CardDescription>
                Monitor whether this walk-in can enter the reservation room now or needs to wait
                for the current queue session to finish.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void prepareWalkIn(true)}
              disabled={isLoading || isRefreshing}
            >
              {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing walk-in queue state...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Unable to prepare walk-in
              </div>
              <p className="mt-2">{error}</p>
            </div>
          )}

        {!isLoading && !error && data?.state === "queued" && (
          <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Users className="h-5 w-5" />
              <span className="font-medium">Walk-in is waiting for the reservation room</span>
            </div>
            <p className="text-sm text-amber-900/80 dark:text-amber-100/80">{data.message}</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-amber-200/70 bg-background/70 p-3 dark:border-amber-900/60">
                  <div className="text-xs text-muted-foreground">Ticket</div>
                  <div className="text-lg font-semibold">{data.ticketId ?? "-"}</div>
                </div>
                <div className="rounded-md border border-amber-200/70 bg-background/70 p-3 dark:border-amber-900/60">
                  <div className="text-xs text-muted-foreground">Queue rank</div>
                  <div className="text-lg font-semibold">
                    {typeof data.rank === "number" ? `#${data.rank}` : "-"}
                  </div>
                </div>
                <div className="rounded-md border border-amber-200/70 bg-background/70 p-3 dark:border-amber-900/60">
                  <div className="text-xs text-muted-foreground">Estimated wait</div>
                  <div className="text-lg font-semibold">
                    {typeof data.estimatedWaitMinutes === "number"
                      ? `~${data.estimatedWaitMinutes} min`
                      : "-"}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => void handleExitQueue()} disabled={isExiting}>
                  {isExiting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Exit queue
                </Button>
              </div>
            </div>
          )}

        {!isLoading && !error && data?.state === "active_and_paused" && (
          <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Walk-in may proceed to seat selection</span>
            </div>
            <p className="text-sm text-emerald-900/80 dark:text-emerald-100/80">{data.message}</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-emerald-200/70 bg-background/70 p-3 dark:border-emerald-900/60">
                  <div className="text-xs text-muted-foreground">Ticket</div>
                  <div className="text-lg font-semibold">{data.ticketId ?? "-"}</div>
                </div>
                <div className="rounded-md border border-emerald-200/70 bg-background/70 p-3 dark:border-emerald-900/60">
                  <div className="text-xs text-muted-foreground">Queue state</div>
                  <div className="text-lg font-semibold">Paused for this walk-in</div>
                </div>
                <div className="rounded-md border border-emerald-200/70 bg-background/70 p-3 dark:border-emerald-900/60">
                  <div className="text-xs text-muted-foreground">Room status</div>
                  <div className="text-lg font-semibold">Open until finalized or exited</div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => void handleExitQueue()} disabled={isExiting}>
                  {isExiting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Exit queue
                </Button>
                <Button onClick={handleEnterReservationRoom} className="gap-2" disabled={isExiting}>
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
