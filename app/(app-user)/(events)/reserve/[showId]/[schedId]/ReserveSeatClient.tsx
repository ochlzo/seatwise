"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock3, Loader2, Plus, ShieldCheck, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { COLOR_CODE_TO_HEX, type SeatmapPreviewCategory } from "@/components/seatmap/CategoryAssignPanel";

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
}: ReserveSeatClientProps) {
  const router = useRouter();
  const showScopeId = `${showId}:${schedId}`;
  const hasHandledExpiryRef = React.useRef(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showName, setShowName] = React.useState<string>("");
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null);
  const [now, setNow] = React.useState<number>(0);
  const [selectedSeatIds, setSelectedSeatIds] = React.useState<string[]>([]);
  const [isAddSeatMode, setIsAddSeatMode] = React.useState(false);
  const [selectionMessage, setSelectionMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    hasHandledExpiryRef.current = false;
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
    if (!expiresAt) return;
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
    setSelectedSeatIds([]);
    setIsAddSeatMode(false);
    setSelectionMessage(null);
  }, [showId, schedId]);

  const goToQueue = () => {
    router.push(`/queue/${showId}/${schedId}`);
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
        }),
      });

      const data = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to complete reservation session");
      }

      clearStoredSession(showScopeId);
      router.push(`/queue/${showId}/${schedId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete reservation session");
    } finally {
      setIsCompleting(false);
    }
  };

  const remaining = expiresAt ? expiresAt - now : 0;
  const isExpiredWindowError = error === EXPIRED_WINDOW_MESSAGE;
  const totalScheduleSeats = React.useMemo(
    () => Object.keys(seatCategoryAssignments).length,
    [seatCategoryAssignments],
  );

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

    setSelectionMessage("Add mode enabled. Tap one more seat on the map.");
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
      <Card className="border-sidebar-border/70">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Reserve Seats
              </CardTitle>
              <CardDescription>
                {showName || "Validating your queue access token..."}
              </CardDescription>
            </div>
            {!isLoading && !error && expiresAt && (
              <Badge variant="outline" className="w-fit text-sm">
                <Clock3 className="mr-1 h-3.5 w-3.5" />
                {formatDuration(remaining)} left
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying active session...
            </div>
          )}

          {!isLoading && error && (
            <div className={isExpiredWindowError ? "rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20" : ""}>
              <div className={isExpiredWindowError ? "flex min-h-[50vh] items-center justify-center px-4 py-8" : ""}>
                <div className={isExpiredWindowError ? "mx-auto flex max-w-lg flex-col items-center gap-4 text-center" : "space-y-3"}>
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertTriangle className={isExpiredWindowError ? "h-6 w-6" : "h-4 w-4"} />
                    <span className={isExpiredWindowError ? "text-base font-medium sm:text-lg" : ""}>
                      {error}
                    </span>
                  </div>
                  <Button variant="outline" onClick={goToQueue}>
                    {isExpiredWindowError ? "Rejoin queue" : "Back to queue"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && expiresAt && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="border-sidebar-border/70">
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base sm:text-lg">Select your seats</CardTitle>
                      <CardDescription>
                        Pick your first seat, then use <strong>+ Add Seat</strong> for additional seats.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{selectedSeatIds.length}/{MAX_SELECTED_SEATS}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant={isAddSeatMode ? "default" : "outline"}
                        onClick={handleArmAddSeat}
                        disabled={selectedSeatIds.length >= MAX_SELECTED_SEATS}
                        className="w-fit"
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        Add Seat
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
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
                          className="inline-flex items-center gap-2 rounded-md border border-sidebar-border/70 bg-background px-2.5 py-1 text-xs"
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
                    <CardTitle className="text-base">Booking Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Selected seats</span>
                      <span className="font-semibold">{selectedSeatIds.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total seats in schedule</span>
                      <span className="font-semibold">{totalScheduleSeats}</span>
                    </div>
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
                            <span className="text-muted-foreground">Selected seat IDs</span>
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
                                <span className="max-w-[120px] truncate">{seatId}</span>
                                <button
                                  type="button"
                                  className="rounded-sm p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                  onClick={() => handleRemoveSeat(seatId)}
                                  aria-label={`Remove seat ${seatId}`}
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

                <Card className="border-sidebar-border/70">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Session Controls</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300">
                      Active window: {formatDuration(remaining)}
                    </div>

                    <Button variant="outline" onClick={goToQueue} className="w-full">
                      Back to queue
                    </Button>
                    <Button onClick={handleDoneReserving} disabled={isCompleting} className="w-full">
                      {isCompleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isCompleting ? "Completing..." : "Done reserving (simulate)"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
