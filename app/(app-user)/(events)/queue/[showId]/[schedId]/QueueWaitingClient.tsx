"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock3, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import { getOrCreateGuestId } from "@/lib/guest";
import { getProceedWindowDeadline } from "@/lib/queue/proceedWindow";

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
const PROCEED_WINDOW_EXPIRED_MESSAGE =
  "It was your turn but you were away, sorry. Rejoin the queue to try again.";

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

export function QueueWaitingClient({ showId, schedId }: QueueWaitingClientProps) {
  const router = useRouter();
  const showScopeId = `${showId}:${schedId}`;
  const guestId = React.useMemo(() => getOrCreateGuestId(), []);
  const [status, setStatus] = React.useState<QueueStatusResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeferring, setIsDeferring] = React.useState(false);
  const [isRejoining, setIsRejoining] = React.useState(false);
  const [isProceeding, setIsProceeding] = React.useState(false);
  const [hasProceedTimedOut, setHasProceedTimedOut] = React.useState(false);
  const [proceedDeadlineAt, setProceedDeadlineAt] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState<number>(0);
  const hasTerminatedRef = React.useRef(false);
  const allowNavigationRef = React.useRef(false);
  const hasProceedTimedOutRef = React.useRef(false);

  const clearStoredSession = React.useCallback(() => {
    if (typeof window === "undefined") return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(`seatwise:active:${showScopeId}:`)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
  }, [showScopeId]);

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
    if (hasProceedTimedOutRef.current) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(
        `/api/queue/status?showId=${encodeURIComponent(showId)}&schedId=${encodeURIComponent(schedId)}&guestId=${encodeURIComponent(guestId)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as QueueStatusResponse;
      if (hasProceedTimedOutRef.current) {
        return;
      }
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
    hasProceedTimedOutRef.current = hasProceedTimedOut;
  }, [hasProceedTimedOut]);

  React.useEffect(() => {
    if (hasProceedTimedOut) {
      return;
    }

    const intervalMs = status?.status === "waiting" ? POLL_WAITING_MS : POLL_OTHER_MS;
    const timer = window.setInterval(() => {
      void fetchStatus();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [fetchStatus, hasProceedTimedOut, status?.status]);

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

  React.useEffect(() => {
    if (status?.status !== "active") {
      setProceedDeadlineAt(null);
      return;
    }

    setProceedDeadlineAt((current) => current ?? getProceedWindowDeadline(now));
  }, [now, status?.status, status?.ticketId]);

  const proceedRemainingMs =
    status?.status === "active" && proceedDeadlineAt ? proceedDeadlineAt - now : undefined;

  React.useEffect(() => {
    if (hasProceedTimedOut) {
      return;
    }

    if (status?.status !== "active" || proceedRemainingMs === undefined || proceedRemainingMs > 0) {
      return;
    }

    setHasProceedTimedOut(true);
    setError(PROCEED_WINDOW_EXPIRED_MESSAGE);
    clearStoredSession();
    void terminateTicket(true);

    setStatus((current) =>
      current
        ? {
            ...current,
            status: "expired",
            message: PROCEED_WINDOW_EXPIRED_MESSAGE,
          }
        : current,
    );
  }, [clearStoredSession, hasProceedTimedOut, proceedRemainingMs, status?.status, terminateTicket]);

  const isProceedWindowExpired = hasProceedTimedOut || error === PROCEED_WINDOW_EXPIRED_MESSAGE;

  const goBackToShow = () => {
    if (hasProceedTimedOut || !hasTerminableTicket) {
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

  const proceedToReservation = async () => {
    if (!status?.ticketId || !status.activeToken || isProceeding || hasProceedTimedOut) {
      return;
    }

    setIsProceeding(true);
    setError(null);

    try {
      const response = await fetch("/api/queue/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          schedId,
          guestId,
          ticketId: status.ticketId,
          activeToken: status.activeToken,
          proceed: true,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        valid?: boolean;
        reason?: string;
        error?: string;
        session?: {
          ticketId: string;
          activeToken: string;
          expiresAt: number | null;
          startedAt: number;
          userId: string;
          mode: "online" | "walk_in";
        };
      };

      if (!response.ok || !data.success || !data.valid || !data.session) {
        if (data.valid === false || data.reason === "missing" || data.reason === "expired") {
          setHasProceedTimedOut(true);
          setError(PROCEED_WINDOW_EXPIRED_MESSAGE);
          clearStoredSession();
          void terminateTicket(true);
          return;
        }

        throw new Error(data.error || "Failed to prepare your reservation window");
      }

      const storageKey = `seatwise:active:${showScopeId}:${data.session.ticketId}`;
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          ...data.session,
          showScopeId,
        }),
      );
      allowNavigationRef.current = true;
      router.push(`/reserve/${showId}/${schedId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to prepare your reservation window",
      );
    } finally {
      setIsProceeding(false);
    }
  };

  const handleRejoinQueue = async () => {
    if (isRejoining) return;

    setIsRejoining(true);
    setError(null);

    try {
      const response = await fetch("/api/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          schedId,
          guestId,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        showName?: string;
        status?: "waiting" | "active";
        ticket?: { ticketId: string };
        rank?: number;
        estimatedWaitMinutes?: number;
        activeToken?: string;
        expiresAt?: number | null;
      };

      if (!response.ok || !data.success) {
        const normalizedError = data.error?.toLowerCase() ?? "";
        if (normalizedError.includes("already in the queue")) {
          void fetchStatus();
          return;
        }
        throw new Error(data.error || "Failed to rejoin queue");
      }

      if (data.ticket?.ticketId) {
        const storageKey = `seatwise:active:${showScopeId}:${data.ticket.ticketId}`;
        if (data.status === "active" && data.activeToken && data.expiresAt) {
          sessionStorage.setItem(
            storageKey,
            JSON.stringify({
              ticketId: data.ticket.ticketId,
              activeToken: data.activeToken,
              expiresAt: data.expiresAt,
              showScopeId,
            }),
          );
        } else {
          clearStoredSession();
        }
      }

      setHasProceedTimedOut(false);
      setProceedDeadlineAt(
        data.status === "active" ? getProceedWindowDeadline() : null,
      );
      setStatus({
        success: true,
        status: data.status ?? "waiting",
        showScopeId,
        showName: data.showName ?? status?.showName,
        ticketId: data.ticket?.ticketId,
        rank: data.rank,
        estimatedWaitMinutes: data.estimatedWaitMinutes,
        activeToken: data.activeToken,
        expiresAt: data.expiresAt ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rejoin queue");
    } finally {
      setIsRejoining(false);
    }
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

    const handlePageHide = () => {
      if (allowNavigationRef.current) return;
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

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("click", handleDocumentClick, true);
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
            <div
              className={
                isProceedWindowExpired
                  ? "rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20"
                  : ""
              }
            >
              <div
                className={
                  isProceedWindowExpired
                    ? "mx-auto flex max-w-lg flex-col items-center gap-4 text-center"
                    : "flex items-center gap-2 text-sm text-red-600"
                }
              >
                <AlertTriangle className={isProceedWindowExpired ? "h-6 w-6" : "h-4 w-4"} />
                <span className={isProceedWindowExpired ? "text-base font-medium sm:text-lg" : ""}>
                  {error}
                </span>
              </div>
              {isProceedWindowExpired && (
                <div className="mt-4 flex w-full max-w-xs items-center justify-center gap-3">
                  <Button onClick={handleRejoinQueue} disabled={isRejoining} className="flex-1">
                    {isRejoining ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Rejoin queue
                  </Button>
                  <Button
                    variant="outline"
                    onClick={goBackToShow}
                    disabled={isRejoining}
                    className="flex-1"
                  >
                    Back to show
                  </Button>
                </div>
              )}
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
                      {proceedRemainingMs !== undefined ? formatDuration(proceedRemainingMs) : "--:--"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Use this active window to proceed with seat reservation.
                  </div>
                  <div className="flex items-center justify-start gap-2">
                    <Button
                      onClick={proceedToReservation}
                      className="w-fit"
                      disabled={isDeferring || isProceeding}
                    >
                      {isProceeding ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Preparing...
                        </>
                      ) : (
                        "Proceed to seat reservation"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleMaybeLater}
                      disabled={isDeferring || isProceeding}
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
