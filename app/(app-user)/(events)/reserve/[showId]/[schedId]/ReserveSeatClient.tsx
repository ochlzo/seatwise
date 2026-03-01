"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock3, Loader2, Plus, X, CheckCircle2, CreditCard, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { type SeatmapPreviewCategory } from "@/components/seatmap/CategoryAssignPanel";
import { toast } from "@/components/ui/sonner";
import { ReservationSuccessPanel } from "@/components/queue/ReservationSuccessPanel";
import { GcashUploadPanel } from "@/components/queue/GcashUploadPanel";
import { getOrCreateGuestId } from "@/lib/guest";

type StoredActiveSession = {
  ticketId: string;
  activeToken: string;
  expiresAt: number;
  showScopeId: string;
};

type ActiveValidationResponse = {
  success: boolean;
  valid?: boolean;
  error?: string;
  showName?: string;
  session?: {
    ticketId: string;
    activeToken: string;
    expiresAt: number;
    startedAt: number;
    userId: string;
  };
};

type ReserveSeatCategory = SeatmapPreviewCategory & {
  price: string;
};

type ReserveSeatClientProps = {
  showId: string;
  schedId: string;
  seatmapId?: string | null;
  seatmapCategories: ReserveSeatCategory[];
  seatCategoryAssignments: Record<string, string>;
  seatNumbersById: Record<string, string>;
  seatStatusById: Record<string, "OPEN" | "RESERVED">;
};

const EXPIRED_WINDOW_MESSAGE = "Your active reservation window has expired. Rejoin the queue.";
const MAX_SELECTED_SEATS = 10;

type ReservationStep = "seats" | "contact" | "payment" | "success";

const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const parseCurrency = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getStoredSession = (showScopeId: string): StoredActiveSession | null => {
  if (typeof window === "undefined") return null;

  for (let i = 0; i < window.sessionStorage.length; i += 1) {
    const key = window.sessionStorage.key(i);
    if (!key || !key.startsWith(`seatwise:active:${showScopeId}:`)) {
      continue;
    }

    const raw = window.sessionStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as StoredActiveSession;
      if (parsed.showScopeId === showScopeId && parsed.ticketId && parsed.activeToken) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
};

const clearStoredSession = (showScopeId: string) => {
  if (typeof window === "undefined") return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < window.sessionStorage.length; i += 1) {
    const key = window.sessionStorage.key(i);
    if (key?.startsWith(`seatwise:active:${showScopeId}:`)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
};

export function ReserveSeatClient({
  showId,
  schedId,
  seatmapId,
  seatmapCategories,
  seatCategoryAssignments,
  seatNumbersById,
  seatStatusById,
}: ReserveSeatClientProps) {
  const router = useRouter();
  const guestId = React.useMemo(() => getOrCreateGuestId(), []);
  const showScopeId = `${showId}:${schedId}`;
  const hasHandledExpiryRef = React.useRef(false);
  const hasShownOneMinuteToastRef = React.useRef(false);
  const hasShownTwentySecondToastRef = React.useRef(false);
  const hasTerminatedRef = React.useRef(false);
  const allowNavigationRef = React.useRef(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [isLeaving, setIsLeaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showName, setShowName] = React.useState<string>("");
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null);
  const [now, setNow] = React.useState<number>(0);
  const [selectedSeatIds, setSelectedSeatIds] = React.useState<string[]>([]);
  const [pendingSeatId, setPendingSeatId] = React.useState<string | null>(null);
  const [selectionMessage, setSelectionMessage] = React.useState<string | null>(null);
  const [isRejoining, setIsRejoining] = React.useState(false);
  const [step, setStep] = React.useState<ReservationStep>("seats");
  const [screenshotUrl, setScreenshotUrl] = React.useState<string>("");
  const [contactDetails, setContactDetails] = React.useState({
    firstName: "",
    lastName: "",
    address: "",
    email: "",
    phoneNumber: "",
  });

  React.useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    hasHandledExpiryRef.current = false;
    hasShownOneMinuteToastRef.current = false;
    hasShownTwentySecondToastRef.current = false;
  }, [showScopeId]);

  const notifyExpiry = React.useCallback(
    async (stored: StoredActiveSession) => {
      try {
        await fetch("/api/queue/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId,
            schedId,
            guestId,
            ticketId: stored.ticketId,
            activeToken: stored.activeToken,
          }),
        });
      } catch {
        // Best effort cleanup request; UI fallback still handles local session reset.
      }
    },
    [guestId, schedId, showId],
  );

  React.useEffect(() => {
    const verify = async () => {
      setIsLoading(true);
      setError(null);

      const stored = getStoredSession(showScopeId);
      if (!stored) {
        setError("No active queue session found. Join the queue first.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/queue/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId,
            schedId,
            guestId,
            ticketId: stored.ticketId,
            activeToken: stored.activeToken,
          }),
        });

        const data = (await response.json()) as ActiveValidationResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to validate active session");
        }

        if (!data.valid || !data.session) {
          clearStoredSession(showScopeId);
          setError(EXPIRED_WINDOW_MESSAGE);
          setIsLoading(false);
          return;
        }

        setShowName(data.showName || "");
        setExpiresAt(data.session.expiresAt);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to validate active session");
        setIsLoading(false);
      }
    };

    void verify();
  }, [guestId, schedId, showId, showScopeId]);

  React.useEffect(() => {
    if (step === "success" || !expiresAt) return;
    if (expiresAt > now) return;
    if (hasHandledExpiryRef.current) return;

    hasHandledExpiryRef.current = true;
    const stored = getStoredSession(showScopeId);
    if (stored) {
      void notifyExpiry(stored);
    }
    clearStoredSession(showScopeId);
    setError(EXPIRED_WINDOW_MESSAGE);
  }, [expiresAt, now, notifyExpiry, showScopeId]);

  React.useEffect(() => {
    if (step === "success" || !expiresAt || isLoading || !!error) return;

    const remainingMs = expiresAt - now;
    if (remainingMs <= 0) return;

    if (remainingMs <= 20_000 && !hasShownTwentySecondToastRef.current) {
      hasShownTwentySecondToastRef.current = true;
      hasShownOneMinuteToastRef.current = true;
      toast("Hurry! 20 seconds left!");
      return;
    }

    if (remainingMs <= 60_000 && !hasShownOneMinuteToastRef.current) {
      hasShownOneMinuteToastRef.current = true;
      toast("1 minute left");
    }
  }, [error, expiresAt, isLoading, now]);

  React.useEffect(() => {
    setSelectedSeatIds([]);
    setPendingSeatId(null);
    setSelectionMessage(null);
  }, [showId, schedId]);

  const terminateQueueSession = React.useCallback(
    async (preferBeacon: boolean) => {
      const stored = getStoredSession(showScopeId);
      if (!stored || hasTerminatedRef.current) {
        return;
      }

      hasTerminatedRef.current = true;
      const payload = JSON.stringify({
        showId,
        schedId,
        guestId,
        ticketId: stored.ticketId,
        activeToken: stored.activeToken,
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
    [guestId, schedId, showId, showScopeId],
  );

  React.useEffect(() => {
    hasTerminatedRef.current = false;
    allowNavigationRef.current = false;
  }, [showScopeId]);

  React.useEffect(() => {
    if (step === "success") return;

    const confirmLeaveMessage = "Leaving this page will remove you from the queue. Continue?";
    const reservePath = `/reserve/${showId}/${schedId}`;
    const queuePath = `/queue/${showId}/${schedId}`;

    const shouldGuard = () => {
      if (allowNavigationRef.current) return false;
      return !!getStoredSession(showScopeId);
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldGuard()) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePageHide = () => {
      if (!shouldGuard()) return;
      void terminateQueueSession(true);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!shouldGuard()) return;
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
      if (nextUrl.pathname === reservePath || nextUrl.pathname === queuePath) return;

      event.preventDefault();
      const confirmed = window.confirm(confirmLeaveMessage);
      if (!confirmed) return;

      allowNavigationRef.current = true;
      terminateQueueSession(false).finally(() => {
        router.push(nextPath);
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [router, schedId, showId, showScopeId, step, terminateQueueSession]);

  const goToQueue = () => {
    router.push(`/queue/${showId}/${schedId}`);
  };

  const handleRejoinQueue = async () => {
    setIsRejoining(true);
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

      const data = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        const normalizedError = data.error?.toLowerCase() ?? "";
        if (normalizedError.includes("already in the queue")) {
          router.push(`/queue/${showId}/${schedId}`);
          return;
        }
        throw new Error(data.error || "Failed to rejoin queue");
      }

      router.push(`/queue/${showId}/${schedId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rejoin queue");
    } finally {
      setIsRejoining(false);
    }
  };

  const handleDeclineRejoin = () => {
    router.push(`/${showId}`);
  };

  const handleLeaveReservationRoom = async () => {
    const stored = getStoredSession(showScopeId);
    if (!stored) {
      clearStoredSession(showScopeId);
      router.push(`/${showId}`);
      return;
    }

    setIsLeaving(true);
    try {
      const response = await fetch("/api/queue/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          schedId,
          guestId,
          ticketId: stored.ticketId,
          activeToken: stored.activeToken,
        }),
      });

      const data = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to leave reservation room");
      }

      allowNavigationRef.current = true;
      clearStoredSession(showScopeId);
      router.push(`/${showId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave reservation room");
    } finally {
      setIsLeaving(false);
    }
  };

  // Step transition: seats → payment
  const handleProceedToContact = () => {
    if (selectedSeatIds.length === 0) {
      setSelectionMessage("Please select at least one seat.");
      return;
    }
    setSelectionMessage(null);
    setStep("contact");
  };

  // Step transition: contact -> payment
  const handleProceedToPayment = () => {
    const firstName = contactDetails.firstName.trim();
    const lastName = contactDetails.lastName.trim();
    const address = contactDetails.address.trim();
    const email = contactDetails.email.trim();
    const phoneNumber = contactDetails.phoneNumber.trim();

    if (!firstName || !lastName || !address || !email || !phoneNumber) {
      setError("Please complete all contact fields.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please provide a valid email address.");
      return;
    }

    if (!/^[+\d][\d\s\-()]{7,}$/.test(phoneNumber)) {
      setError("Please provide a valid phone number.");
      return;
    }

    setError(null);
    setStep("payment");
  };

  const handleBackToSeats = () => {
    setStep("seats");
  };

  const handleBackToContact = () => {
    setStep("contact");
  };

  // Callback from GcashUploadPanel when upload completes
  const handleScreenshotUploaded = React.useCallback((url: string) => {
    setScreenshotUrl(url);
  }, []);

  // Final confirmation: complete reservation with screenshot
  const handleConfirmReservation = async () => {
    if (!screenshotUrl) {
      toast.error("Please upload your GCash payment screenshot first.");
      return;
    }

    const stored = getStoredSession(showScopeId);
    if (!stored) {
      setError("No active queue session found. Join the queue first.");
      return;
    }

    setIsCompleting(true);
    try {
      const response = await fetch("/api/queue/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          schedId,
          guestId,
          ticketId: stored.ticketId,
          activeToken: stored.activeToken,
          seatIds: selectedSeatIds,
          screenshotUrl,
          firstName: contactDetails.firstName,
          lastName: contactDetails.lastName,
          address: contactDetails.address,
          email: contactDetails.email,
          phoneNumber: contactDetails.phoneNumber,
        }),
      });

      const data = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to complete reservation session");
      }

      clearStoredSession(showScopeId);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete reservation session");
    } finally {
      setIsCompleting(false);
    }
  };

  const remaining = expiresAt ? expiresAt - now : 0;
  const isExpiredWindowError = error === EXPIRED_WINDOW_MESSAGE;
  const isSuccess = step === "success";

  const categoriesById = React.useMemo(
    () => new Map(seatmapCategories.map((category) => [category.category_id, category])),
    [seatmapCategories],
  );

  const selectedBreakdown = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const seatId of selectedSeatIds) {
      const categoryId = seatCategoryAssignments[seatId];
      if (!categoryId) continue;
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([categoryId, count]) => ({
        category: categoriesById.get(categoryId) ?? null,
        count,
        unitPrice: parseCurrency(categoriesById.get(categoryId)?.price ?? "0"),
      }))
      .filter((item) => item.category !== null)
      .sort((a, b) => b.count - a.count)
      .map((item) => ({
        ...item,
        lineTotal: item.count * item.unitPrice,
      }));
  }, [categoriesById, seatCategoryAssignments, selectedSeatIds]);

  const subtotal = React.useMemo(
    () => selectedBreakdown.reduce((total, item) => total + item.lineTotal, 0),
    [selectedBreakdown],
  );

  const pendingSeatLabel = pendingSeatId
    ? (seatNumbersById[pendingSeatId] ?? pendingSeatId)
    : "";

  const previewSelectedSeatIds = React.useMemo(() => {
    if (!pendingSeatId) {
      return selectedSeatIds;
    }

    return selectedSeatIds.includes(pendingSeatId)
      ? selectedSeatIds
      : [...selectedSeatIds, pendingSeatId];
  }, [pendingSeatId, selectedSeatIds]);

  const handleAddPendingSeat = React.useCallback(() => {
    if (!pendingSeatId) return;

    if (selectedSeatIds.includes(pendingSeatId)) {
      setPendingSeatId(null);
      return;
    }

    if (selectedSeatIds.length >= MAX_SELECTED_SEATS) {
      setSelectionMessage(`You can select up to ${MAX_SELECTED_SEATS} seats only.`);
      return;
    }

    setSelectedSeatIds([...selectedSeatIds, pendingSeatId]);
    setPendingSeatId(null);
    setSelectionMessage(null);
  }, [pendingSeatId, selectedSeatIds]);

  const handleSeatSelectionChange = React.useCallback(
    (ids: string[]) => {
      const clickedSeatId = ids[ids.length - 1];
      if (!clickedSeatId) return;

      const seatStatus = seatStatusById[clickedSeatId];
      if (seatStatus && seatStatus !== "OPEN") {
        setSelectionMessage(`${seatNumbersById[clickedSeatId] ?? clickedSeatId} is already taken.`);
        setPendingSeatId(null);
        return;
      }

      if (selectedSeatIds.includes(clickedSeatId)) {
        setPendingSeatId(null);
        setSelectionMessage("Seat already in your cart.");
        return;
      }

      if (selectedSeatIds.length >= MAX_SELECTED_SEATS) {
        setSelectionMessage(`You can select up to ${MAX_SELECTED_SEATS} seats only.`);
        setPendingSeatId(null);
        return;
      }

      setPendingSeatId(clickedSeatId);
      setSelectionMessage(null);
    },
    [seatNumbersById, seatStatusById, selectedSeatIds],
  );

  const handleRemoveSeat = React.useCallback((seatId: string) => {
    setSelectedSeatIds((prev) => prev.filter((id) => id !== seatId));
    setSelectionMessage(null);
    setPendingSeatId((prev) => (prev === seatId ? null : prev));
  }, []);

  const handleClearSelection = React.useCallback(() => {
    setSelectedSeatIds([]);
    setSelectionMessage(null);
    setPendingSeatId(null);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6 lg:p-8">
      <Card className="border-0 bg-transparent py-0 shadow-none rounded-none gap-4 sm:border-sidebar-border/70 sm:bg-card sm:py-6 sm:shadow-sm sm:rounded-xl sm:gap-6">
        <CardHeader className="px-0 sm:px-6">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {showName || "Validating your queue access token..."}
                </CardTitle>
              </div>
              {!isSuccess && !isLoading && !error && expiresAt && (
                <div className="flex items-center gap-2">
                  {step === "contact" && (
                    <Badge variant="secondary" className="w-fit gap-1 text-sm">
                      Contact Details
                    </Badge>
                  )}
                  {step === "payment" && (
                    <Badge variant="secondary" className="w-fit gap-1 text-sm">
                      <CreditCard className="h-3.5 w-3.5" />
                      Payment
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={
                      remaining <= 20_000
                        ? "w-fit border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300 text-sm"
                        : "w-fit border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300 text-sm"
                    }
                  >
                    <Clock3 className="mr-1 h-3.5 w-3.5" />
                    {formatDuration(remaining)} left
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-0 sm:px-6">
          {isSuccess && (
            <ReservationSuccessPanel
              showName={showName}
              selectedSeatIds={selectedSeatIds}
              seatNumbersById={seatNumbersById}
              showId={showId}
            />
          )}

          {!isSuccess && isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying active session...
            </div>
          )}

          {!isSuccess && !isLoading && error && (
            <div className={isExpiredWindowError ? "rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20" : ""}>
              <div className={isExpiredWindowError ? "flex min-h-[50vh] items-center justify-center px-4 py-8" : ""}>
                <div className={isExpiredWindowError ? "mx-auto flex max-w-lg flex-col items-center gap-4 text-center" : "space-y-3"}>
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertTriangle className={isExpiredWindowError ? "h-6 w-6" : "h-4 w-4"} />
                    <span className={isExpiredWindowError ? "text-base font-medium sm:text-lg" : ""}>
                      {isExpiredWindowError ? "Uh oh! Your time ran out. Rejoin the queue?" : error}
                    </span>
                  </div>
                  {isExpiredWindowError ? (
                    <div className="flex w-full max-w-xs items-center justify-center gap-3">
                      <Button onClick={handleRejoinQueue} disabled={isRejoining} className="flex-1">
                        {isRejoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Yes
                      </Button>
                      <Button variant="outline" onClick={handleDeclineRejoin} disabled={isRejoining} className="flex-1">
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={goToQueue}>
                      Back to queue
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isSuccess && !isLoading && !error && expiresAt && step === "seats" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3 px-2 sm:px-3 md:px-4">
                <SeatmapPreview
                  seatmapId={seatmapId ?? undefined}
                  heightClassName="h-[52vh] min-h-[340px] max-h-[560px] md:h-[560px]"
                  allowMarqueeSelection={false}
                  selectedSeatIds={previewSelectedSeatIds}
                  cartSeatIds={selectedSeatIds}
                  onSelectionChange={handleSeatSelectionChange}
                  categories={seatmapCategories}
                  seatCategories={seatCategoryAssignments}
                  seatStatusById={seatStatusById}
                  showReservationOverlay
                />

                {selectionMessage && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                    {selectionMessage}
                  </p>
                )}

                {!seatmapId && (
                  <p className="text-xs text-muted-foreground">
                    This schedule does not have an associated seatmap.
                  </p>
                )}
              </div>

              <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                <Card className="border-sidebar-border/70">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Booking Summary</CardTitle>
                      <Badge variant="outline" className="w-fit">{selectedSeatIds.length}/{MAX_SELECTED_SEATS}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {pendingSeatId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={handleAddPendingSeat}
                        disabled={selectedSeatIds.length >= MAX_SELECTED_SEATS}
                        className="w-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        {`Seat ${pendingSeatLabel}`}
                      </Button>
                    )}
                    <Separator />
                    {selectedBreakdown.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No seats selected yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedBreakdown.map((item) => (
                          <div
                            key={item.category?.category_id}
                            className="flex items-center justify-between gap-2 rounded-md border border-sidebar-border/60 px-2.5 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs sm:text-sm">{item.category?.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {item.count} x {formatCurrency(item.unitPrice)}
                              </p>
                            </div>
                            <Badge variant="secondary">{formatCurrency(item.lineTotal)}</Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedSeatIds.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Selected seats</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={handleClearSelection}
                            >
                              Clear all
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedSeatIds.map((seatId) => (
                              <div
                                key={seatId}
                                className="inline-flex items-center gap-1 rounded-md border border-sidebar-border/70 bg-muted/30 px-2 py-1 text-[11px]"
                              >
                                <span className="max-w-[120px] truncate">{seatNumbersById[seatId] ?? seatId}</span>
                                <button
                                  type="button"
                                  className="rounded-sm p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                  onClick={() => handleRemoveSeat(seatId)}
                                  aria-label={`Remove seat ${seatNumbersById[seatId] ?? seatId}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <Separator />
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <Button
                    variant="outline"
                    onClick={handleLeaveReservationRoom}
                    disabled={isLeaving || isCompleting}
                    className="w-full gap-2"
                  >
                    {isLeaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Leaving...
                      </>
                    ) : (
                      "Leave Reservation Room"
                    )}
                  </Button>
                  <Button
                    onClick={handleProceedToContact}
                    disabled={selectedSeatIds.length === 0 || isLeaving}
                    className="w-full gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    Proceed to Contact Details
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Payment Step ── */}
          {!isSuccess && !isLoading && !error && expiresAt && step === "contact" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="border-sidebar-border/70">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleBackToContact} className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-base">Contact Details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="h-10 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                      placeholder="First name"
                      value={contactDetails.firstName}
                      onChange={(e) =>
                        setContactDetails((prev) => ({ ...prev, firstName: e.target.value }))
                      }
                    />
                    <input
                      className="h-10 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                      placeholder="Last name"
                      value={contactDetails.lastName}
                      onChange={(e) =>
                        setContactDetails((prev) => ({ ...prev, lastName: e.target.value }))
                      }
                    />
                  </div>
                  <input
                    className="h-10 w-full rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                    placeholder="Address"
                    value={contactDetails.address}
                    onChange={(e) =>
                      setContactDetails((prev) => ({ ...prev, address: e.target.value }))
                    }
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      className="h-10 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                      placeholder="Email"
                      type="email"
                      value={contactDetails.email}
                      onChange={(e) =>
                        setContactDetails((prev) => ({ ...prev, email: e.target.value }))
                      }
                    />
                    <input
                      className="h-10 rounded-md border border-sidebar-border/70 bg-background px-3 text-sm"
                      placeholder="Phone number"
                      value={contactDetails.phoneNumber}
                      onChange={(e) =>
                        setContactDetails((prev) => ({ ...prev, phoneNumber: e.target.value }))
                      }
                    />
                  </div>
                  <Button onClick={handleProceedToPayment} className="w-full gap-2">
                    <CreditCard className="h-4 w-4" />
                    Continue to Payment
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-sidebar-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Selected Seats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSeatIds.map((seatId) => (
                      <div
                        key={seatId}
                        className="inline-flex items-center rounded-md border border-sidebar-border/70 bg-muted/30 px-2 py-1 text-[11px] font-medium"
                      >
                        {seatNumbersById[seatId] ?? seatId}
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {!isSuccess && !isLoading && !error && expiresAt && step === "payment" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* Left: GCash Upload */}
              <Card className="border-sidebar-border/70">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleBackToSeats} className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-base">Upload GCash Payment</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <GcashUploadPanel
                    onUploadComplete={handleScreenshotUploaded}
                    disabled={isCompleting}
                  />
                </CardContent>
              </Card>

              {/* Right: Order Summary + Confirm */}
              <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                <Card className="border-sidebar-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {selectedBreakdown.map((item) => (
                      <div
                        key={item.category?.category_id}
                        className="flex items-center justify-between gap-2 rounded-md border border-sidebar-border/60 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs sm:text-sm">{item.category?.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.count} x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <Badge variant="secondary">{formatCurrency(item.lineTotal)}</Badge>
                      </div>
                    ))}

                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Seats</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSeatIds.map((seatId) => (
                          <div
                            key={seatId}
                            className="inline-flex items-center rounded-md border border-sidebar-border/70 bg-muted/30 px-2 py-1 text-[11px] font-medium"
                          >
                            {seatNumbersById[seatId] ?? seatId}
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>Total</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  onClick={handleConfirmReservation}
                  disabled={isCompleting || !screenshotUrl || isLeaving}
                  className="w-full gap-2"
                >
                  {isCompleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm Reservation
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

