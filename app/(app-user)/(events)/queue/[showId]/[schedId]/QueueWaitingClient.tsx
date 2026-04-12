"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Clock3, Users, CheckCircle2, AlertTriangle, Volume2, VolumeX } from "lucide-react";
import { getOrCreateGuestId } from "@/lib/guest";
import { getProceedWindowDeadline } from "@/lib/queue/proceedWindow";
import { QueueStatePanel } from "@/components/queue/QueueStatePanel";

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
  accessMode?: "default" | "dry-run";
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

const getQueueBadgeLabel = (status?: QueueStatusResponse["status"]) => {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "active":
      return "Ready";
    case "paused":
      return "Paused";
    case "expired":
      return "Turn missed";
    case "closed":
      return "Closed";
    case "not_joined":
      return "Not joined";
    default:
      return undefined;
  }
};

export function QueueWaitingClient({
  showId,
  schedId,
  accessMode = "default",
}: QueueWaitingClientProps) {
  const router = useRouter();
  const showScopeId = `${showId}:${schedId}`;
  const querySuffix = accessMode === "dry-run" ? "?accessMode=dry-run" : "";
  const showHref = accessMode === "dry-run" ? `/dry-run/${showId}` : `/${showId}`;
  const queueHref = `/queue/${showId}/${schedId}${querySuffix}`;
  const reserveHref = `/reserve/${showId}/${schedId}${querySuffix}`;
  const guestId = React.useMemo(() => getOrCreateGuestId(), []);
  const [status, setStatus] = React.useState<QueueStatusResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeferring, setIsDeferring] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isRejoining, setIsRejoining] = React.useState(false);
  const [isProceeding, setIsProceeding] = React.useState(false);
  const [hasProceedTimedOut, setHasProceedTimedOut] = React.useState(false);
  const [proceedDeadlineAt, setProceedDeadlineAt] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState<number>(0);
  const [isAlertMuted, setIsAlertMuted] = React.useState(false);
  const hasTerminatedRef = React.useRef(false);
  const allowNavigationRef = React.useRef(false);
  const hasProceedTimedOutRef = React.useRef(false);
  const alertAudioRef = React.useRef<HTMLAudioElement | null>(null);

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

  const handleRefreshStatus = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await fetchStatus();
    } finally {
      setIsRefreshing(false);
    }
  };

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
    // Start each visit with the alert enabled.
    setIsAlertMuted(false);
  }, [showScopeId]);

  React.useEffect(() => {
    router.prefetch(reserveHref);
    router.prefetch(showHref);
  }, [reserveHref, router, showHref]);

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

  const stopAlertSound = React.useCallback(() => {
    const audio = alertAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const playAlertSound = React.useCallback(async () => {
    if (typeof window === "undefined" || isAlertMuted) {
      stopAlertSound();
      return;
    }

    let audio = alertAudioRef.current;
    if (!audio) {
      audio = new Audio("/sounds/queue-turn-alert.mp3");
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0.9;
      alertAudioRef.current = audio;
    }

    try {
      await audio.play();
    } catch {
      // If autoplay is blocked, the user can retry by toggling mute or interacting again.
    }
  }, [isAlertMuted, stopAlertSound]);

  React.useEffect(() => {
    if (status?.status === "active" && proceedRemainingMs !== undefined && proceedRemainingMs > 0) {
      void playAlertSound();
      return;
    }

    stopAlertSound();
  }, [playAlertSound, proceedRemainingMs, status?.status, stopAlertSound]);

  React.useEffect(() => {
    return () => {
      stopAlertSound();
    };
  }, [stopAlertSound]);

  const toggleAlertMute = () => {
    const nextMuted = !isAlertMuted;
    setIsAlertMuted(nextMuted);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`seatwise:queue-alert-muted:${showScopeId}`, nextMuted ? "1" : "0");
    }
    if (nextMuted) {
      stopAlertSound();
    } else {
      void playAlertSound();
    }
  };

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
      router.push(showHref);
      return;
    }

    const confirmed = window.confirm("Leaving this page will remove you from the queue. Continue?");
    if (!confirmed) {
      return;
    }

    allowNavigationRef.current = true;
    void terminateTicket(true);
    router.push(showHref);
  };

  const proceedToReservation = async () => {
    if (!status?.ticketId || !status.activeToken || isProceeding || hasProceedTimedOut) {
      return;
    }

    setIsProceeding(true);
    setError(null);
    stopAlertSound();

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
      router.push(reserveHref);
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
          accessMode,
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
          router.push(queueHref);
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
    await terminateTicket(true);
    router.push(showHref);
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

  const activeStatusLabel = getQueueBadgeLabel(status?.status);
  const rankValue = toDisplayRank(status?.rank);
  const estimatedWaitMinutes =
    status?.estimatedWaitMinutes ?? Math.ceil((status?.etaMs ?? 0) / 60000);
  const queueTitle =
    status?.status === "active"
      ? "Your turn is ready"
      : status?.status === "paused"
        ? "The queue is paused"
        : status?.status === "expired" || status?.status === "not_joined"
          ? "You missed your turn"
          : "You're in line";
  const queueDescription =
    status?.status === "active"
      ? "You have one minute to move into the reservation room."
      : status?.status === "paused"
        ? status.message || "We’ll keep your place and update you when the queue resumes."
        : status?.status === "expired" || status?.status === "not_joined"
          ? PROCEED_WINDOW_EXPIRED_MESSAGE
          : status?.showName
            ? `We’ll keep this page updated while you wait for ${status.showName}.`
            : "We’ll keep this page updated while you wait.";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6 lg:p-8">
      {isLoading ? (
        <QueueStatePanel
          tone="neutral"
          icon={<Loader2 className="h-5 w-5 animate-spin" />}
          title="Checking your place"
          description="Please wait a moment while we load your queue status."
          badgeLabel="Queue"
        >
          <div className="text-sm text-muted-foreground">This usually takes just a moment.</div>
        </QueueStatePanel>
      ) : null}

      {!isLoading && error ? (
        <QueueStatePanel
          tone={isProceedWindowExpired ? "warning" : "danger"}
          icon={<AlertTriangle className="h-5 w-5" />}
          title={isProceedWindowExpired ? "You missed your turn" : "We couldn’t load your queue status"}
          description={
            isProceedWindowExpired
              ? PROCEED_WINDOW_EXPIRED_MESSAGE
              : "Something interrupted the update. You can try again or return to the show."
          }
          badgeLabel={isProceedWindowExpired ? "Missed turn" : "Try again"}
          footer={
            <div className="flex flex-col gap-3 sm:flex-row">
              {isProceedWindowExpired ? (
                <>
                      <Button onClick={handleRejoinQueue} disabled={isRejoining} className="sm:min-w-40">
                        {isRejoining ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Rejoining...
                          </>
                        ) : (
                          "Rejoin queue"
                        )}
                      </Button>
                  <Button variant="outline" onClick={goBackToShow} disabled={isRejoining} className="sm:min-w-40">
                        Exit
                  </Button>
                </>
              ) : (
                <>
                      <Button onClick={() => void handleRefreshStatus()} disabled={isRefreshing} className="sm:min-w-40">
                        {isRefreshing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Refreshing...
                          </>
                        ) : (
                          "Try again"
                        )}
                      </Button>
                  <Button variant="outline" onClick={goBackToShow} className="sm:min-w-40">
                    Exit
                  </Button>
                </>
              )}
            </div>
          }
        />
      ) : null}

      {!isLoading && !error && status ? (
        <QueueStatePanel
          tone={
            status.status === "active"
              ? "success"
              : status.status === "paused"
                ? "warning"
                : status.status === "expired" || status.status === "not_joined"
                  ? "danger"
                  : "neutral"
          }
          icon={
            status.status === "active" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : status.status === "paused" || status.status === "expired" || status.status === "not_joined" ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Users className="h-5 w-5" />
            )
          }
          title={queueTitle}
          description={queueDescription}
          badgeLabel={activeStatusLabel}
        >
          {status.status === "waiting" ? (
            <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-sidebar-border/70 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Your place</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight">
                  {rankValue ? `#${rankValue}` : "—"}
                </div>
                {status.rank === 1 ? (
                  <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                    You&apos;re next once the current turn clears.
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-sidebar-border/70 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated wait</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight">~{estimatedWaitMinutes} min</div>
              </div>
            </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" onClick={goBackToShow} className="sm:min-w-40">
                  Exit
                </Button>
              </div>
            </div>
          ) : null}

          {status.status === "active" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-sidebar-border/70 bg-background px-3 py-2 text-sm font-medium">
                  <Clock3 className="h-4 w-4" />
                  Proceed within{" "}
                  <span className="font-semibold">
                    {proceedRemainingMs !== undefined ? formatDuration(proceedRemainingMs) : "--:--"}
                  </span>
                </div>
              </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={proceedToReservation} disabled={isDeferring || isProceeding} className="sm:min-w-56">
                      {isProceeding ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Proceeding...
                        </>
                      ) : (
                        "Proceed to seats"
                      )}
                    </Button>
                    <Button
                  variant="outline"
                  onClick={handleMaybeLater}
                  disabled={isDeferring || isProceeding}
                  className="sm:min-w-40"
                      >
                        {isDeferring ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Going back...
                          </>
                        ) : (
                          "Not now"
                        )}
                      </Button>
                    <Button
                      variant="outline"
                      onClick={toggleAlertMute}
                      className="sm:min-w-44"
                    >
                      {isAlertMuted ? (
                        <>
                          <VolumeX className="mr-2 h-4 w-4" />
                          Unmute alert
                        </>
                      ) : (
                        <>
                          <Volume2 className="mr-2 h-4 w-4" />
                          Mute alert
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}

          {status.status === "paused" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-sidebar-border/70 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Your place</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight">{rankValue ? `#${rankValue}` : "—"}</div>
              </div>
              <div className="rounded-2xl border border-sidebar-border/70 bg-background/80 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimated wait</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight">~{estimatedWaitMinutes} min</div>
              </div>
            </div>
          ) : null}

          {(status.status === "closed" || status.status === "expired" || status.status === "not_joined") ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleRejoinQueue} disabled={isRejoining} className="sm:min-w-40">
                {isRejoining ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rejoining...
                  </>
                ) : (
                  "Rejoin queue"
                )}
              </Button>
              <Button variant="outline" onClick={goBackToShow} disabled={isRejoining} className="sm:min-w-40">
                Exit
              </Button>
            </div>
          ) : null}
        </QueueStatePanel>
      ) : null}
    </div>
  );
}
