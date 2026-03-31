"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock3, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import { getOrCreateGuestId } from "@/lib/guest";

type QueueStatusResponse = {
  success: boolean;
  status: "waiting" | "active" | "paused" | "expired" | "closed" | "not_joined";
  showScopeId: string;
  showName?: string;
  ticketId?: string;
  name?: string;
  rank?: number;
  etaMs?: number;
  estimatedWaitMinutes?: number;
  activeToken?: string;
  expiresAt?: number | null;
  message?: string;
  error?: string;
};

type QueueWaitingClientProps = {
  showId: string;
  schedId: string;
};

const POLL_WAITING_MS = 4000;
const POLL_OTHER_MS = 8000;

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const toDisplayRank = (rank?: number) => {
  if (typeof rank !== "number" || !Number.isFinite(rank)) return null;
  return rank;
};

const HIDDEN_TERMINATE_DELAY_MS = 30_000;

export function QueueWaitingClient({ showId, schedId }: QueueWaitingClientProps) {
  const router = useRouter();
  const guestId = React.useMemo(() => getOrCreateGuestId(), []);
  const [status, setStatus] = React.useState<QueueStatusResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeferring, setIsDeferring] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState<number>(0);
  const hasTerminatedRef = React.useRef(false);
  const allowNavigationRef = React.useRef(false);
  const hiddenTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasTerminableTicket =
    !!status?.ticketId &&
    (status.status === "waiting" || status.status === "active" || status.status === "paused");

  const terminateTicket = React.useCallback(
    async (preferBeacon: boolean) => {
      if (!hasTerminableTicket || !status?.ticketId || hasTerminatedRef.current) {
        return;
      }

      hasTerminatedRef.current = true;
      const payload = JSON.stringify({
        showId,
        schedId,
        guestId,
        ticketId: status.ticketId,
        activeToken: status.activeToken,
      });

      if (preferBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
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
        // Best effort termination during navigation.
      }
    },
    [guestId, hasTerminableTicket, schedId, showId, status?.activeToken, status?.ticketId],
  );

  const fetchStatus = React.useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(
        `/api/queue/status?showId=${encodeURIComponent(showId)}&schedId=${encodeURIComponent(schedId)}&guestId=${encodeURIComponent(guestId)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as QueueStatusResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch queue status");
      }
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch queue status");
    } finally {
      setIsLoading(false);
    }
  }, [guestId, showId, schedId]);

  React.useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  React.useEffect(() => {
    const intervalMs = status?.status === "waiting" ? POLL_WAITING_MS : POLL_OTHER_MS;
    const timer = window.setInterval(() => {
      void fetchStatus();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [fetchStatus, status?.status]);

  React.useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    router.prefetch(`/reserve/${showId}/${schedId}`);
    router.prefetch(`/${showId}`);
  }, [router, schedId, showId]);

  React.useEffect(() => {
    if (!status || status.status !== "active" || !status.ticketId || !status.activeToken || !status.expiresAt) {
      return;
    }

    const storageKey = `seatwise:active:${status.showScopeId}:${status.ticketId}`;
    const payload = {
      ticketId: status.ticketId,
      activeToken: status.activeToken,
      expiresAt: status.expiresAt,
      showScopeId: status.showScopeId,
    };
    sessionStorage.setItem(storageKey, JSON.stringify(payload));
  }, [status]);

  const expiresInMs =
    status?.status === "active" && status.expiresAt ? status.expiresAt - now : undefined;

  const goBackToShow = () => {
    if (!hasTerminableTicket) {
      router.push(`/${showId}`);
      return;
    }

    const confirmed = window.confirm("Leaving this page will remove you from the queue. Continue?");
    if (!confirmed) {
      return;
    }

    allowNavigationRef.current = true;
    void terminateTicket(true);
    router.push(`/${showId}`);
  };

  const proceedToReservation = () => {
    allowNavigationRef.current = true;
    router.push(`/reserve/${showId}/${schedId}`);
  };

  const handleMaybeLater = async () => {
    if (!hasTerminableTicket || isDeferring) return;

    setIsDeferring(true);
    setError(null);
    allowNavigationRef.current = true;
    void terminateTicket(true);
    router.push(`/${showId}`);
  };

  React.useEffect(() => {
    hasTerminatedRef.current = false;
    allowNavigationRef.current = false;
  }, [showId, schedId, status?.ticketId]);

  React.useEffect(() => {
    if (!hasTerminableTicket) return;

    const confirmLeaveMessage = "Leaving this page will remove you from the queue.";
    const reservePath = `/reserve/${showId}/${schedId}`;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      if (allowNavigationRef.current) return;
      // `persisted` is true when the page enters the bfcache (tab switch on desktop).
      // When false, the page is truly being discarded: tab close, browser close,
      // or removing the browser from the recent-apps list on mobile.
      if (event.persisted) return;
      // Cancel the visibility timer — pagehide supersedes it.
      if (hiddenTimerRef.current !== null) {
        clearTimeout(hiddenTimerRef.current);
        hiddenTimerRef.current = null;
      }
      void terminateTicket(true);
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
      if (nextUrl.pathname === reservePath && status?.status === "active") return;

      event.preventDefault();
      const confirmed = window.confirm(confirmLeaveMessage);
      if (!confirmed) return;

      allowNavigationRef.current = true;
      void terminateTicket(true);
      router.push(nextPath);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (allowNavigationRef.current) return;
        // On mobile, switching apps also fires visibilitychange:hidden.
        // Use a grace-period timer so we only terminate after the user
        // has been away for a meaningful duration (not just a quick app switch).
        if (hiddenTimerRef.current === null) {
          hiddenTimerRef.current = setTimeout(() => {
            hiddenTimerRef.current = null;
            void terminateTicket(true);
          }, HIDDEN_TERMINATE_DELAY_MS);
        }
      } else {
        // User came back — cancel any pending termination.
        if (hiddenTimerRef.current !== null) {
          clearTimeout(hiddenTimerRef.current);
          hiddenTimerRef.current = null;
        }
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
      if (hiddenTimerRef.current !== null) {
        clearTimeout(hiddenTimerRef.current);
        hiddenTimerRef.current = null;
      }
    };
  }, [hasTerminableTicket, router, schedId, showId, status?.status, terminateTicket]);

  React.useEffect(() => {
    if (!hasTerminableTicket) return;

    const backGuardMessage = "Leaving this page will remove you from the queue.";
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
  }, [hasTerminableTicket, schedId, showId]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Queue Status
          </CardTitle>
          <CardDescription>
            {status?.showName ? `${status.showName}` : "Loading show..."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading queue status...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {!isLoading && !error && status && (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{status.status.toUpperCase()}</Badge>
                {status.ticketId && (
                  <span className="text-xs text-muted-foreground">Ticket: {status.ticketId}</span>
                )}
              </div>

              {status.message && (
                <p className="text-sm text-muted-foreground">{status.message}</p>
              )}

              {status.status === "waiting" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">You&apos;re in</div>
                      <div className="text-2xl font-semibold">
                        {toDisplayRank(status.rank) ? `#${toDisplayRank(status.rank)}` : "-"}
                      </div>
                      {status.rank === 1 && (
                        <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Almost there - someone is still finalizing their seat, and you&apos;re next in line.
                        </p>
                      )}
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Estimated wait</div>
                      <div className="text-2xl font-semibold">
                        ~{status.estimatedWaitMinutes ?? Math.ceil((status.etaMs ?? 0) / 60000)} min
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-start gap-2">
                    <Button variant="outline" onClick={goBackToShow}>
                      Exit queue
                    </Button>
                  </div>
                </div>
              )}

              {status.status === "active" && (
                <div className="space-y-3 rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Your turn is active</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock3 className="h-4 w-4" />
                    Expires in:{" "}
                    <span className="font-semibold">
                      {expiresInMs !== undefined ? formatDuration(expiresInMs) : "--:--"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Use this active window to proceed with seat reservation.
                  </div>
                  <div className="flex items-center justify-start gap-2">
                    <Button onClick={proceedToReservation} className="w-fit" disabled={isDeferring}>
                      Proceed to seat reservation
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleMaybeLater}
                      disabled={isDeferring}
                      className="w-fit"
                    >
                      {isDeferring ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Leaving...
                        </>
                      ) : (
                        "Maybe later"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {status.status === "paused" && (
                <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Queue temporarily paused</span>
                  </div>
                  <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
                    {status.message}
                  </p>
                  {typeof status.rank === "number" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md border border-amber-200/70 bg-background/70 p-3 dark:border-amber-900/60">
                        <div className="text-xs text-muted-foreground">Your spot</div>
                        <div className="text-2xl font-semibold">#{status.rank}</div>
                      </div>
                      <div className="rounded-md border border-amber-200/70 bg-background/70 p-3 dark:border-amber-900/60">
                        <div className="text-xs text-muted-foreground">Estimated wait</div>
                        <div className="text-2xl font-semibold">
                          ~{status.estimatedWaitMinutes ?? Math.ceil((status.etaMs ?? 0) / 60000)} min
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-start gap-2">
                    <Button variant="outline" onClick={goBackToShow}>
                      Leave queue and go back
                    </Button>
                  </div>
                </div>
              )}

              {(status.status === "closed" || status.status === "expired" || status.status === "not_joined") && (
                <Button variant="outline" onClick={goBackToShow}>
                  Back to show
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
