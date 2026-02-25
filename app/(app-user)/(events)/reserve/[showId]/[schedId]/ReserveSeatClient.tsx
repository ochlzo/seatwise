"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock3, Loader2, Plus, X, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { COLOR_CODE_TO_HEX, type SeatmapPreviewCategory } from "@/components/seatmap/CategoryAssignPanel";
import { toast } from "@/components/ui/sonner";
import { ReservationSuccessPanel } from "@/components/queue/ReservationSuccessPanel";

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
};

const EXPIRED_WINDOW_MESSAGE = "Your active reservation window has expired. Rejoin the queue.";
const MAX_SELECTED_SEATS = 10;

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
}: ReserveSeatClientProps) {
  const router = useRouter();
  const showScopeId = `${showId}:${schedId}`;
  const hasHandledExpiryRef = React.useRef(false);
  const hasShownOneMinuteToastRef = React.useRef(false);
  const hasShownTwentySecondToastRef = React.useRef(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showName, setShowName] = React.useState<string>("");
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null);
  const [now, setNow] = React.useState<number>(0);
  const [selectedSeatIds, setSelectedSeatIds] = React.useState<string[]>([]);
  const [isAddSeatMode, setIsAddSeatMode] = React.useState(false);
  const [selectionMessage, setSelectionMessage] = React.useState<string | null>(null);
  const [isRejoining, setIsRejoining] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

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
            ticketId: stored.ticketId,
            activeToken: stored.activeToken,
          }),
        });
      } catch {
        // Best effort cleanup request; UI fallback still handles local session reset.
      }
    },
    [schedId, showId],
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
  }, [schedId, showId, showScopeId]);

  React.useEffect(() => {
    if (isSuccess || !expiresAt) return;
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
    if (isSuccess || !expiresAt || isLoading || !!error) return;

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
    setIsAddSeatMode(false);
    setSelectionMessage(null);
  }, [showId, schedId]);

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

  const handleDoneReserving = async () => {
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
          ticketId: stored.ticketId,
          activeToken: stored.activeToken,
          seatIds: selectedSeatIds,
        }),
      });

      const data = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to complete reservation session");
      }

      clearStoredSession(showScopeId);
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete reservation session");
    } finally {
      setIsCompleting(false);
    }
  };

  const remaining = expiresAt ? expiresAt - now : 0;
  const isExpiredWindowError = error === EXPIRED_WINDOW_MESSAGE;

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

  const handleArmAddSeat = React.useCallback(() => {
    if (selectedSeatIds.length >= MAX_SELECTED_SEATS) {
      setSelectionMessage(`You can select up to ${MAX_SELECTED_SEATS} seats only.`);
      setIsAddSeatMode(false);
      return;
    }

    setSelectionMessage(null);
    setIsAddSeatMode(true);
  }, [selectedSeatIds.length]);

  const handleSeatSelectionChange = React.useCallback(
    (ids: string[]) => {
      const clickedSeatId = ids[ids.length - 1];
      if (!clickedSeatId) return;

      setSelectionMessage(null);

      if (selectedSeatIds.length === 0) {
        setSelectedSeatIds([clickedSeatId]);
        setIsAddSeatMode(false);
        return;
      }

      if (isAddSeatMode) {
        if (selectedSeatIds.includes(clickedSeatId)) {
          setSelectionMessage("Seat already selected.");
          setIsAddSeatMode(false);
          return;
        }

        if (selectedSeatIds.length >= MAX_SELECTED_SEATS) {
          setSelectionMessage(`You can select up to ${MAX_SELECTED_SEATS} seats only.`);
          setIsAddSeatMode(false);
          return;
        }

        setSelectedSeatIds([...selectedSeatIds, clickedSeatId]);
        setIsAddSeatMode(false);
        return;
      }

      if (selectedSeatIds.includes(clickedSeatId)) {
        setSelectedSeatIds(selectedSeatIds.filter((seatId) => seatId !== clickedSeatId));
        return;
      }

      setSelectionMessage(`Tap "+ Add Seat" to add another seat (max ${MAX_SELECTED_SEATS}).`);
    },
    [isAddSeatMode, selectedSeatIds],
  );

  const handleRemoveSeat = React.useCallback((seatId: string) => {
    setSelectedSeatIds((prev) => prev.filter((id) => id !== seatId));
    setSelectionMessage(null);
    setIsAddSeatMode(false);
  }, []);

  const handleClearSelection = React.useCallback(() => {
    setSelectedSeatIds([]);
    setSelectionMessage(null);
    setIsAddSeatMode(false);
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

          {!isSuccess && !isLoading && !error && expiresAt && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="border-sidebar-border/70">
                <CardContent className="space-y-3 pt-0 px-2 sm:px-3 md:px-4">
                  <SeatmapPreview
                    seatmapId={seatmapId ?? undefined}
                    heightClassName="h-[52vh] min-h-[340px] max-h-[560px] md:h-[560px]"
                    allowMarqueeSelection={false}
                    selectedSeatIds={selectedSeatIds}
                    onSelectionChange={handleSeatSelectionChange}
                    categories={seatmapCategories}
                    seatCategories={seatCategoryAssignments}
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

                  {seatmapCategories.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {seatmapCategories.map((category) => (
                        <div
                          key={category.category_id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-sidebar-border/70 bg-background px-2 py-0.5 text-[11px]"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-zinc-300"
                            style={{
                              backgroundColor: COLOR_CODE_TO_HEX[category.color_code],
                              backgroundImage:
                                category.color_code === "NO_COLOR"
                                  ? "linear-gradient(45deg, #d4d4d8 25%, transparent 25%, transparent 50%, #d4d4d8 50%, #d4d4d8 75%, transparent 75%, transparent)"
                                  : undefined,
                              backgroundSize: category.color_code === "NO_COLOR" ? "6px 6px" : undefined,
                            }}
                          />
                          <span className="font-medium">{category.name}</span>
                          <span className="text-muted-foreground">{formatCurrency(parseCurrency(category.price))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                <Card className="border-sidebar-border/70">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Booking Summary</CardTitle>
                      <Badge variant="outline" className="w-fit">{selectedSeatIds.length}/{MAX_SELECTED_SEATS}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleArmAddSeat}
                      disabled={isAddSeatMode || selectedSeatIds.length >= MAX_SELECTED_SEATS}
                      className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      {isAddSeatMode ? "Select a seat" : "Add Seat"}
                    </Button>
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
                  <Button variant="outline" onClick={goToQueue} className="w-full">
                    Back to queue
                  </Button>
                  <Button onClick={handleDoneReserving} disabled={isCompleting} className="w-full">
                    {isCompleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isCompleting ? "Completing..." : "Done reserving (simulate)"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
