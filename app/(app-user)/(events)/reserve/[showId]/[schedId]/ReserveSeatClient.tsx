"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { SeatStatus, ShowStatus, SchedStatus } from "@prisma/client";
import {
  AlertTriangle,
  Clock3,
  Loader2,
  Plus,
  X,
  CheckCircle2,
  CreditCard,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type SeatmapPreviewCategory } from "@/components/seatmap/CategoryAssignPanel";
import { toast } from "@/components/ui/sonner";
import { ReservationSuccessPanel } from "@/components/queue/ReservationSuccessPanel";
import { GcashUploadPanel } from "@/components/queue/GcashUploadPanel";
import { getOrCreateGuestId } from "@/lib/guest";
import { clearJoinTransitionState } from "@/lib/queue/joinTransition";
import { cn } from "@/lib/utils";
import {
  getReservationRoomModeConfig,
  type ReservationRoomMode,
} from "@/lib/reservations/reservationRoomMode";

type StoredActiveSession = {
  ticketId: string;
  activeToken: string;
  expiresAt: number | null;
  showScopeId: string;
};

type PendingTerminationPayload = {
  showId: string;
  schedId: string;
  guestId: string;
  ticketId: string;
  activeToken: string;
};

type ActiveValidationResponse = {
  success: boolean;
  valid?: boolean;
  error?: string;
  showName?: string;
  session?: {
    ticketId: string;
    activeToken: string;
    expiresAt: number | null;
    startedAt: number;
    userId: string;
    mode: "online" | "walk_in";
  };
};

type ScheduleSnapshot = {
  schedId: string;
  schedDate: string;
  schedStartTime: string;
  schedEndTime: string;
  schedStatus: SchedStatus | null;
  showName: string;
  showStatus: ShowStatus;
};

type ReserveSeatCategory = SeatmapPreviewCategory & {
  price: string;
};

type ContactFieldErrors = {
  firstName: string | null;
  lastName: string | null;
  address: string | null;
  email: string | null;
  phoneNumber: string | null;
};

type ReserveSeatClientProps = {
  showId: string;
  schedId: string;
  mode?: ReservationRoomMode;
  queueParticipantId?: string;
  initialActiveSession?: StoredActiveSession | null;
  returnHref?: string;
  seatmapId?: string | null;
  gcashQrImageKey?: string | null;
  gcashNumber?: string | null;
  gcashAccountName?: string | null;
  seatmapCategories: ReserveSeatCategory[];
  seatCategoryAssignments: Record<string, string>;
  seatNumbersById: Record<string, string>;
  seatStatusById: Record<string, SeatStatus>;
  initialShowName?: string;
  initialScheduleSnapshot?: ScheduleSnapshot;
  initialTicketDesigns?: TicketDesignOption[];
};

const EXPIRED_WINDOW_MESSAGE =
  "Your active reservation window has expired. Rejoin the queue.";
const MAX_SELECTED_SEATS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PH_PHONE_REGEX = /^09\d{9}$/;

const EMPTY_CONTACT_ERRORS: ContactFieldErrors = {
  firstName: null,
  lastName: null,
  address: null,
  email: null,
  phoneNumber: null,
};

type ReservationStep =
  | "seats"
  | "contact"
  | "ticket_design"
  | "payment"
  | "post_finalize"
  | "success";

type TicketDesignOption = {
  ticketTemplateId: string;
  ticketTemplateVersionId: string;
  templateName: string;
  versionNumber: number;
  previewUrl: string | null;
};

type TicketDesignResponse = {
  success?: boolean;
  error?: string;
  designs?: TicketDesignOption[];
};

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
      if (
        parsed.showScopeId === showScopeId &&
        parsed.ticketId &&
        parsed.activeToken
      ) {
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

const getPendingTerminationKey = (showScopeId: string) =>
  `seatwise:pending-termination:${showScopeId}`;

const getPendingTermination = (
  showScopeId: string,
): PendingTerminationPayload | null => {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(
    getPendingTerminationKey(showScopeId),
  );
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingTerminationPayload;
  } catch {
    return null;
  }
};

const setPendingTermination = (
  showScopeId: string,
  payload: PendingTerminationPayload,
) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    getPendingTerminationKey(showScopeId),
    JSON.stringify(payload),
  );
};

const clearPendingTermination = (showScopeId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getPendingTerminationKey(showScopeId));
};

// ---------------------------------------------------------------------------
// Background-checkpoint helpers
// Used to measure how long the page was backgrounded in bfcache
// (pagehide:persisted:true). JS timers cannot run while the page is frozen,
// so we store a timestamp+graceMs in localStorage and evaluate it on pageshow.
// ---------------------------------------------------------------------------
const getBgCheckpointKey = (scopeId: string) =>
  `seatwise:bg_checkpoint:${scopeId}`;

const saveBgCheckpoint = (scopeId: string, graceMs: number) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    getBgCheckpointKey(scopeId),
    JSON.stringify({ backgroundedAt: Date.now(), graceMs }),
  );
};

const getBgCheckpoint = (
  scopeId: string,
): { backgroundedAt: number; graceMs: number } | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getBgCheckpointKey(scopeId));
    return raw
      ? (JSON.parse(raw) as { backgroundedAt: number; graceMs: number })
      : null;
  } catch {
    return null;
  }
};

const clearBgCheckpoint = (scopeId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getBgCheckpointKey(scopeId));
};

export function ReserveSeatClient({
  showId,
  schedId,
  mode = "online",
  queueParticipantId,
  initialActiveSession = null,
  returnHref,
  seatmapId,
  gcashQrImageKey,
  gcashNumber,
  gcashAccountName,
  seatmapCategories,
  seatCategoryAssignments,
  seatNumbersById,
  seatStatusById,
  initialShowName = "",
  initialScheduleSnapshot,
  initialTicketDesigns = [],
}: ReserveSeatClientProps) {
  const router = useRouter();
  const participantId = React.useMemo(
    () => queueParticipantId ?? getOrCreateGuestId(),
    [queueParticipantId],
  );
  const showScopeId = `${showId}:${schedId}`;
  const modeConfig = React.useMemo(
    () => getReservationRoomModeConfig(mode),
    [mode],
  );
  const isWalkInMode = mode === "walk_in";
  const hasHandledExpiryRef = React.useRef(false);
  const hasShownOneMinuteToastRef = React.useRef(false);
  const hasShownTwentySecondToastRef = React.useRef(false);
  const hasTerminatedRef = React.useRef(false);
  const allowNavigationRef = React.useRef(false);
  // Mirrors expiresAt into a ref so pagehide handlers can read it without stale-closure issues.
  const expiresAtRef = React.useRef<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [isLeaving, setIsLeaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showName, setShowName] = React.useState<string>(initialShowName);
  const [expiresAt, setExpiresAt] = React.useState<number | null>(null);
  const [now, setNow] = React.useState<number>(0);
  const [selectedSeatIds, setSelectedSeatIds] = React.useState<string[]>([]);
  const [pendingSeatId, setPendingSeatId] = React.useState<string | null>(null);
  const [selectionMessage, setSelectionMessage] = React.useState<string | null>(
    null,
  );
  const [isRejoining, setIsRejoining] = React.useState(false);
  const [step, setStep] = React.useState<ReservationStep>("seats");
  const [screenshotUrl, setScreenshotUrl] = React.useState<string>("");
  const [reservationNumber, setReservationNumber] = React.useState<
    string | null
  >(null);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = React.useState(false);
  const [isContactConfirmDialogOpen, setIsContactConfirmDialogOpen] =
    React.useState(false);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = React.useState(false);
  const [isFinalizeWalkInDialogOpen, setIsFinalizeWalkInDialogOpen] =
    React.useState(false);
  const [walkInConfirmationComplete, setWalkInConfirmationComplete] =
    React.useState(false);
  const [contactDetails, setContactDetails] = React.useState({
    firstName: "",
    lastName: "",
    address: "",
    email: "",
    phoneNumber: "",
  });
  const [contactFieldErrors, setContactFieldErrors] =
    React.useState<ContactFieldErrors>(EMPTY_CONTACT_ERRORS);
  const [ticketDesigns, setTicketDesigns] =
    React.useState<TicketDesignOption[]>(initialTicketDesigns);
  const [isLoadingTicketDesigns, setIsLoadingTicketDesigns] =
    React.useState(false);
  const [ticketDesignsError, setTicketDesignsError] = React.useState<
    string | null
  >(null);
  const [selectedTicketTemplateVersionId, setSelectedTicketTemplateVersionId] =
    React.useState<string | null>(null);

  const resetWalkInSaleDraft = React.useCallback(() => {
    setSelectedSeatIds([]);
    setPendingSeatId(null);
    setSelectionMessage(null);
    setStep("seats");
    setScreenshotUrl("");
    setReservationNumber(null);
    setWalkInConfirmationComplete(false);
    setContactDetails({
      firstName: "",
      lastName: "",
      address: "",
      email: "",
      phoneNumber: "",
    });
    setContactFieldErrors(EMPTY_CONTACT_ERRORS);
    setTicketDesigns(initialTicketDesigns);
    setTicketDesignsError(null);
    setSelectedTicketTemplateVersionId(null);
    setError(null);
    router.refresh();
  }, [initialTicketDesigns, router]);

  React.useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !initialActiveSession) return;

    const storageKey = `seatwise:active:${showScopeId}:${initialActiveSession.ticketId}`;
    const existing = window.sessionStorage.getItem(storageKey);
    if (!existing) {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify(initialActiveSession),
      );
    }
  }, [initialActiveSession, showScopeId]);

  React.useEffect(() => {
    clearJoinTransitionState(showScopeId);
  }, [showScopeId]);

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
            guestId: participantId,
            ticketId: stored.ticketId,
            activeToken: stored.activeToken,
            scheduleSnapshot: initialScheduleSnapshot,
          }),
        });
      } catch {
        // Best effort cleanup request; UI fallback still handles local session reset.
      }
    },
    [initialScheduleSnapshot, participantId, schedId, showId],
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
            guestId: participantId,
            ticketId: stored.ticketId,
            activeToken: stored.activeToken,
            scheduleSnapshot: initialScheduleSnapshot,
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
        setExpiresAt(data.session.expiresAt ?? null);
        setIsLoading(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to validate active session",
        );
        setIsLoading(false);
      }
    };

    void verify();
  }, [initialScheduleSnapshot, participantId, schedId, showId, showScopeId]);

  React.useEffect(() => {
    if (isWalkInMode || step === "success" || !expiresAt) return;
    if (expiresAt > now) return;
    if (hasHandledExpiryRef.current) return;

    hasHandledExpiryRef.current = true;
    const stored = getStoredSession(showScopeId);
    if (!isWalkInMode && stored) {
      void notifyExpiry(stored);
    }
    clearStoredSession(showScopeId);
    setError(EXPIRED_WINDOW_MESSAGE);
  }, [expiresAt, isWalkInMode, now, notifyExpiry, showScopeId, step]);

  React.useEffect(() => {
    if (
      isWalkInMode ||
      step === "success" ||
      !expiresAt ||
      isLoading ||
      !!error
    )
      return;

    const remainingMs = expiresAt - now;
    if (remainingMs <= 0) return;

    if (remainingMs <= 20_000 && !hasShownTwentySecondToastRef.current) {
      hasShownTwentySecondToastRef.current = true;
      hasShownOneMinuteToastRef.current = true;
      toast.error("Hurry! 20 seconds left!");
      return;
    }

    if (remainingMs <= 60_000 && !hasShownOneMinuteToastRef.current) {
      hasShownOneMinuteToastRef.current = true;
      toast.warning("1 minute left");
    }
  }, [error, expiresAt, isLoading, isWalkInMode, now, step]);

  React.useEffect(() => {
    setSelectedSeatIds([]);
    setPendingSeatId(null);
    setSelectionMessage(null);
    setTicketDesigns([]);
    setTicketDesignsError(null);
    setSelectedTicketTemplateVersionId(null);
  }, [showId, schedId]);

  React.useEffect(() => {
    if (step !== "ticket_design") return;
    if (ticketDesigns.length > 0) return;

    const abortController = new AbortController();
    const loadTicketDesigns = async () => {
      setIsLoadingTicketDesigns(true);
      setTicketDesignsError(null);
      try {
        const response = await fetch(`/api/shows/${showId}/ticket-designs`, {
          signal: abortController.signal,
        });
        const data = (await response.json()) as TicketDesignResponse;

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load ticket designs.");
        }

        const designs = data.designs ?? [];
        setTicketDesigns(designs);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setTicketDesignsError(
          err instanceof Error ? err.message : "Failed to load ticket designs.",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoadingTicketDesigns(false);
        }
      }
    };

    void loadTicketDesigns();

    return () => {
      abortController.abort();
    };
  }, [showId, step, ticketDesigns.length]);

  const terminateQueueSession = React.useCallback(
    async (preferBeacon: boolean) => {
      const pending = getPendingTermination(showScopeId);
      const stored = getStoredSession(showScopeId);
      const payload =
        pending ??
        (stored
          ? {
              showId,
              schedId,
              guestId: participantId,
              ticketId: stored.ticketId,
              activeToken: stored.activeToken,
            }
          : null);

      if (!payload || (hasTerminatedRef.current && !pending)) {
        return;
      }

      clearStoredSession(showScopeId);
      setPendingTermination(showScopeId, payload);
      hasTerminatedRef.current = true;
      const serializedPayload = JSON.stringify(payload);

      if (
        preferBeacon &&
        typeof navigator !== "undefined" &&
        typeof navigator.sendBeacon === "function"
      ) {
        const blob = new Blob([serializedPayload], {
          type: "application/json",
        });
        if (navigator.sendBeacon("/api/queue/terminate", blob)) {
          clearPendingTermination(showScopeId);
        }
        return;
      }

      try {
        await fetch("/api/queue/terminate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: serializedPayload,
          keepalive: true,
        });
        clearPendingTermination(showScopeId);
      } catch {
        // Best effort termination during navigation.
      }
    },
    [participantId, schedId, showId, showScopeId],
  );

  // Keep expiresAtRef in sync so frozen-closure pagehide handlers can read it.
  expiresAtRef.current = expiresAt;

  React.useEffect(() => {
    hasTerminatedRef.current = false;
    allowNavigationRef.current = false;
  }, [showScopeId]);

  React.useEffect(() => {
    if (isWalkInMode) {
      if (returnHref) {
        router.prefetch(returnHref);
      }
      return;
    }

    router.prefetch(`/queue/${showId}/${schedId}`);
    router.prefetch(`/${showId}`);
  }, [isWalkInMode, returnHref, router, schedId, showId]);

  React.useEffect(() => {
    if (step === "success") return;

    const confirmLeaveMessage =
      "Leaving this page will remove you from the queue. Continue?";
    const reservePath = isWalkInMode ? `/admin/walk-in/${showId}/${schedId}/room` : `/reserve/${showId}/${schedId}`;
    const queuePath = `/queue/${showId}/${schedId}`;

    const shouldGuard = () => {
      if (allowNavigationRef.current) return false;
      return (
        !!getStoredSession(showScopeId) || !!getPendingTermination(showScopeId)
      );
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldGuard()) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      if (!shouldGuard()) return;
      if (event.persisted) {
        // pagehide:persisted:true -- mobile app switch entering bfcache.
        // JS is frozen; record a grace checkpoint so pageshow can measure
        // how long the page was actually backgrounded.
        const ea = expiresAtRef.current;
        // Grace = 60 s, capped at remaining reservation window when active.
        const graceMs = ea ? Math.min(60_000, ea - Date.now()) : 60_000;
        saveBgCheckpoint(showScopeId, Math.max(0, graceMs));
      } else {
        // pagehide:persisted:false -- real close or navigation away.
        // Terminate immediately via beacon.
        void terminateQueueSession(true);
      }
    };

    // Called when the page is restored from bfcache (user returned from app switch).
    // Check whether the grace period has elapsed; if so, terminate the session.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return; // normal forward navigation, not bfcache restore
      const checkpoint = getBgCheckpoint(showScopeId);
      if (checkpoint) {
        clearBgCheckpoint(showScopeId);
        if (Date.now() - checkpoint.backgroundedAt >= checkpoint.graceMs) {
          // Grace period elapsed -- terminate now, then refresh to show expired UI.
          hasTerminatedRef.current = false;
          void terminateQueueSession(true);
          router.refresh();
          return;
        }
      }
      // Came back within the grace window -- re-validate.
      hasTerminatedRef.current = false;
      router.refresh();
    };

    const handleOffline = () => {
      if (!shouldGuard()) return;
      void terminateQueueSession(false);
      setError("Connection lost. Your queue session has been closed.");
    };

    const handleOnline = () => {
      if (!getPendingTermination(showScopeId)) return;
      void terminateQueueSession(false);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!shouldGuard()) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

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
      if (nextUrl.pathname === reservePath || nextUrl.pathname === queuePath)
        return;

      event.preventDefault();
      const confirmed = window.confirm(confirmLeaveMessage);
      if (!confirmed) return;

      allowNavigationRef.current = true;
      void terminateQueueSession(true);
      router.push(nextPath);
    };

    // NOTE: visibilitychange is intentionally NOT used for termination.
    // Tab switching and browser minimizing should NOT trigger termination per spec.
    // Only pagehide (real close / mobile app switch) is actionable.

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isWalkInMode, router, schedId, showId, showScopeId, step, terminateQueueSession]);

  React.useEffect(() => {
    if (step === "success") return;

    const shouldGuard = () => {
      if (allowNavigationRef.current) return false;
      return (
        !!getStoredSession(showScopeId) || !!getPendingTermination(showScopeId)
      );
    };

    const backGuardMessage = "Leaving this page will remove you from the queue.";
    const guardState = { __seatwiseQueueGuard: true, showId, schedId };

    if (shouldGuard()) {
      window.history.pushState(guardState, "", window.location.href);
    }

    const handlePopState = () => {
      if (!shouldGuard()) return;
      window.alert(backGuardMessage);
      window.history.pushState(guardState, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [schedId, showId, showScopeId, step]);

  React.useEffect(() => {
    if (!getPendingTermination(showScopeId)) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    void terminateQueueSession(false);
  }, [showScopeId, terminateQueueSession]);

  const goToQueue = () => {
    if (isWalkInMode) {
      router.push(returnHref ?? `/admin/shows/${showId}`);
      return;
    }

    router.push(`/queue/${showId}/${schedId}`);
  };

  const handleRejoinQueue = async () => {
    if (isWalkInMode) {
      setIsRejoining(true);
      router.refresh();
      return;
    }

    setIsRejoining(true);
    try {
      const response = await fetch("/api/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          schedId,
          guestId: participantId,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
      };
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
    if (isWalkInMode) {
      router.push(returnHref ?? `/admin/shows/${showId}`);
      return;
    }

    router.push(`/${showId}`);
  };

  const handleLeaveReservationRoom = async () => {
    setIsLeaving(true);
    allowNavigationRef.current = true;
    await terminateQueueSession(true);
    router.push(
      isWalkInMode ? (returnHref ?? `/admin/shows/${showId}`) : `/${showId}`,
    );
  };

  // Step transition: seats -> contact
  const handleProceedToContact = () => {
    if (selectedSeatIds.length === 0) {
      setSelectionMessage("Please select at least one seat.");
      return;
    }
    setSelectionMessage(null);
    setStep("contact");
  };

  // Step transition: contact -> ticket design
  const handleProceedToPayment = () => {
    const firstName = contactDetails.firstName.trim();
    const lastName = contactDetails.lastName.trim();
    const address = contactDetails.address.trim();
    const email = contactDetails.email.trim();
    const phoneNumber = contactDetails.phoneNumber.trim();
    const nextErrors: ContactFieldErrors = { ...EMPTY_CONTACT_ERRORS };
    let hasErrors = false;

    if (!firstName) {
      nextErrors.firstName = "First name is required.";
      hasErrors = true;
    }

    if (!lastName) {
      nextErrors.lastName = "Last name is required.";
      hasErrors = true;
    }

    if (!address) {
      nextErrors.address = "Address is required.";
      hasErrors = true;
    }

    if (!email) {
      nextErrors.email = "Email is required.";
      hasErrors = true;
    } else if (!EMAIL_REGEX.test(email)) {
      nextErrors.email = "Please provide a valid email address.";
      hasErrors = true;
    }

    if (!phoneNumber) {
      nextErrors.phoneNumber = "Phone number is required.";
      hasErrors = true;
    } else if (!PH_PHONE_REGEX.test(phoneNumber)) {
      nextErrors.phoneNumber =
        "Phone number must start with 09 and be 11 digits.";
      hasErrors = true;
    }

    setContactFieldErrors(nextErrors);
    if (hasErrors) {
      return;
    }

    setError(null);
    setIsContactConfirmDialogOpen(true);
  };

  const handleContactConfirmDialogChange = (open: boolean) => {
    setIsContactConfirmDialogOpen(open);
  };

  const handleConfirmContactDetails = () => {
    setIsContactConfirmDialogOpen(false);
    setStep("ticket_design");
  };

  const handleBackToSeats = () => {
    setStep("seats");
  };

  const handleBackToContact = () => {
    setStep("contact");
    setWalkInConfirmationComplete(false);
  };

  const handleBackToTicketDesign = () => {
    setStep("contact");
    setWalkInConfirmationComplete(false);
  };

  const handleProceedFromTicketDesign = () => {
    if (!selectedTicketTemplateVersionId) {
      toast.error("Please select a ticket design before continuing.");
      return;
    }
    setStep("payment");
  };

  const handleLeaveDialogChange = (open: boolean) => {
    if (isLeaving) return;
    setIsLeaveDialogOpen(open);
  };

  const handleOpenLeaveDialog = () => {
    if (isLeaving || isCompleting) return;
    setIsLeaveDialogOpen(true);
  };

  const handleConfirmLeaveReservationRoom = async () => {
    setIsLeaveDialogOpen(false);
    await handleLeaveReservationRoom();
  };

  const handleSubmitDialogChange = (open: boolean) => {
    setIsSubmitDialogOpen(open);
  };

  const handleOpenSubmitDialog = () => {
    if (isLeaving || isCompleting) return;
    if (modeConfig.requiresScreenshotUpload && !screenshotUrl) return;
    setIsSubmitDialogOpen(true);
  };

  const handleConfirmSubmitReservation = () => {
    setIsSubmitDialogOpen(false);
    if (isWalkInMode) {
      setIsFinalizeWalkInDialogOpen(true);
      return;
    }

    void handleConfirmReservation();
  };

  const handleFinalizeWalkInDialogChange = (open: boolean) => {
    setIsFinalizeWalkInDialogOpen(open);
  };

  const handleConfirmFinalizeWalkIn = () => {
    setIsFinalizeWalkInDialogOpen(false);
    setWalkInConfirmationComplete(true);
    void handleConfirmReservation();
  };

  const updateContactField = React.useCallback(
    (field: keyof typeof contactDetails, value: string) => {
      setContactDetails((prev) => ({ ...prev, [field]: value }));
      setContactFieldErrors((prev) => ({ ...prev, [field]: null }));
    },
    [],
  );

  // Callback from GcashUploadPanel when upload completes
  const handleScreenshotUploaded = React.useCallback((url: string) => {
    setScreenshotUrl(url);
  }, []);

  // Final confirmation: complete reservation
  const handleConfirmReservation = async () => {
    if (!isWalkInMode && !screenshotUrl) {
      toast.error("Please upload your GCash payment screenshot first.");
      return;
    }
    if (!selectedTicketTemplateVersionId) {
      toast.error("Please select a ticket design before submitting.");
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
          guestId: participantId,
          mode,
          ticketId: stored.ticketId,
          activeToken: stored.activeToken,
          seatIds: selectedSeatIds,
          ticketTemplateVersionId: selectedTicketTemplateVersionId,
          screenshotUrl,
          firstName: contactDetails.firstName,
          lastName: contactDetails.lastName,
          address: contactDetails.address,
          email: contactDetails.email,
          phoneNumber: contactDetails.phoneNumber,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        reservationNumber?: string;
        warning?: string | null;
      };
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to complete reservation session");
      }

      setReservationNumber(data.reservationNumber ?? null);
      if (data.warning) {
        toast.warning(data.warning);
      }
      if (isWalkInMode) {
        setStep("post_finalize");
      } else {
        clearStoredSession(showScopeId);
        setStep("success");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to complete reservation session",
      );
    } finally {
      setIsCompleting(false);
    }
  };

  const remaining = !isWalkInMode && expiresAt ? expiresAt - now : 0;
  const isExpiredWindowError = error === EXPIRED_WINDOW_MESSAGE;
  const isSuccess = step === "success";
  const isWalkInPostFinalize = isWalkInMode && step === "post_finalize";
  const hasActiveRoomAccess = isWalkInMode || !!expiresAt;

  const categoriesById = React.useMemo(
    () =>
      new Map(
        seatmapCategories.map((category) => [category.category_id, category]),
      ),
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
      setSelectionMessage(
        `You can select up to ${MAX_SELECTED_SEATS} seats only.`,
      );
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
        setSelectionMessage(
          `${seatNumbersById[clickedSeatId] ?? clickedSeatId} is already taken.`,
        );
        setPendingSeatId(null);
        return;
      }

      if (selectedSeatIds.includes(clickedSeatId)) {
        setPendingSeatId(null);
        setSelectionMessage("Seat already in your cart.");
        return;
      }

      if (selectedSeatIds.length >= MAX_SELECTED_SEATS) {
        setSelectionMessage(
          `You can select up to ${MAX_SELECTED_SEATS} seats only.`,
        );
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
        {!isSuccess && (
          <CardHeader className="px-0 sm:px-6">
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {showName || "Validating your queue access token..."}
                  </CardTitle>
                </div>
                {!isLoading && !error && !isWalkInMode && expiresAt && (
                  <div className="flex items-center gap-2">
                    {step === "seats" && (
                      <Badge
                        variant="secondary"
                        className="w-fit gap-1 text-sm"
                      >
                        Pick a Seat
                      </Badge>
                    )}
                    {step === "contact" && (
                      <Badge
                        variant="secondary"
                        className="w-fit gap-1 text-sm"
                      >
                        Contact Details
                      </Badge>
                    )}
                    {step === "ticket_design" && (
                      <Badge
                        variant="secondary"
                        className="w-fit gap-1 text-sm"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Select Ticket Design
                      </Badge>
                    )}
                    {step === "payment" && (
                      <Badge
                        variant="secondary"
                        className="w-fit gap-1 text-sm"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        {modeConfig.paymentBadgeLabel}
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
        )}
        <CardContent className="space-y-4 px-0 sm:px-6">
          {isSuccess && (
            <ReservationSuccessPanel
              showName={showName}
              selectedSeatIds={selectedSeatIds}
              seatNumbersById={seatNumbersById}
              showId={showId}
              contactEmail={contactDetails.email}
              reservationNumber={reservationNumber}
            />
          )}

          {isWalkInPostFinalize && (
            <div className="flex min-h-[50vh] items-center justify-center px-4 py-8">
              <div className="mx-auto flex w-full max-w-xl flex-col gap-6 text-center">
                <div className="rounded-full bg-green-100 p-4 text-green-600 dark:bg-green-900/40 dark:text-green-400 mx-auto">
                  <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Walk-in sale finalized
                  </h3>
                  {reservationNumber && (
                    <p className="text-sm font-semibold text-foreground sm:text-base">
                      Reservation Number: {reservationNumber}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground sm:text-base">
                    The sale has been saved. The room is still reserved for
                    walk-in admissions until you admit again or exit the queue.
                  </p>
                </div>
                <div className="rounded-xl border border-sidebar-border bg-sidebar p-5 text-left shadow-sm">
                  <p className="mb-3 text-sm font-semibold text-sidebar-foreground">
                    Completed Seats
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {selectedSeatIds.map((seatId) => (
                      <div
                        key={seatId}
                        className="inline-flex items-center justify-center rounded-md border border-sidebar-border/70 bg-background px-3 py-1.5 text-xs font-semibold shadow-sm"
                      >
                        <span className="truncate">
                          {seatNumbersById[seatId] ?? seatId}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button
                    onClick={resetWalkInSaleDraft}
                    className="sm:min-w-[200px]"
                    size="lg"
                  >
                    Admit again
                  </Button>
                  <Button
                    onClick={handleLeaveReservationRoom}
                    variant="outline"
                    className="sm:min-w-[200px]"
                    size="lg"
                  >
                    Exit queue
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isSuccess && !isWalkInPostFinalize && isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying active session...
            </div>
          )}

          {!isSuccess && !isWalkInPostFinalize && !isLoading && error && (
            <div
              className={
                isExpiredWindowError
                  ? "rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20"
                  : ""
              }
            >
              <div
                className={
                  isExpiredWindowError
                    ? "flex min-h-[50vh] items-center justify-center px-4 py-8"
                    : ""
                }
              >
                <div
                  className={
                    isExpiredWindowError
                      ? "mx-auto flex max-w-lg flex-col items-center gap-4 text-center"
                      : "space-y-3"
                  }
                >
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertTriangle
                      className={isExpiredWindowError ? "h-6 w-6" : "h-4 w-4"}
                    />
                    <span
                      className={
                        isExpiredWindowError
                          ? "text-base font-medium sm:text-lg"
                          : ""
                      }
                    >
                      {isExpiredWindowError
                        ? "Uh oh! Your time ran out. Rejoin the queue?"
                        : error}
                    </span>
                  </div>
                  {isExpiredWindowError ? (
                    <div className="flex w-full max-w-xs items-center justify-center gap-3">
                      <Button
                        onClick={handleRejoinQueue}
                        disabled={isRejoining}
                        className="flex-1"
                      >
                        {isRejoining && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Yes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleDeclineRejoin}
                        disabled={isRejoining}
                        className="flex-1"
                      >
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

          {!isSuccess &&
            !isWalkInPostFinalize &&
            !isLoading &&
            !error &&
            hasActiveRoomAccess &&
            step === "seats" && (
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
                        <CardTitle className="text-base">
                          Booking Summary
                        </CardTitle>
                        <Badge variant="outline" className="w-fit">
                          {selectedSeatIds.length}/{MAX_SELECTED_SEATS}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {pendingSeatId && (
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={handleAddPendingSeat}
                          disabled={
                            selectedSeatIds.length >= MAX_SELECTED_SEATS
                          }
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
                                <p className="truncate text-xs sm:text-sm">
                                  {item.category?.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {item.count} x{" "}
                                  {formatCurrency(item.unitPrice)}
                                </p>
                              </div>
                              <Badge variant="secondary">
                                {formatCurrency(item.lineTotal)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      {selectedSeatIds.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                Selected seats
                              </span>
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
                                  <span className="max-w-[120px] truncate">
                                    {seatNumbersById[seatId] ?? seatId}
                                  </span>
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
                      onClick={handleProceedToContact}
                      disabled={selectedSeatIds.length === 0 || isLeaving}
                      className="w-full gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      Proceed to Contact Details
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleOpenLeaveDialog}
                      disabled={isLeaving || isCompleting}
                      className="w-full gap-2 lg:hidden"
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
                  </div>
                </div>
                <div className="hidden lg:flex lg:col-span-2 lg:justify-end">
                  <Button
                    variant="outline"
                    onClick={handleOpenLeaveDialog}
                    disabled={isLeaving || isCompleting}
                    className="gap-2"
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
                </div>
              </div>
            )}

          {/* ── Payment Step ── */}
          <Dialog
            open={isLeaveDialogOpen}
            onOpenChange={handleLeaveDialogChange}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Leave reservation room?</DialogTitle>
                <DialogDescription>
                  Your active reservation window will be closed and you may lose
                  your selected seats.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-row justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLeaveDialogOpen(false)}
                  disabled={isLeaving}
                  className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleConfirmLeaveReservationRoom()}
                  disabled={isLeaving}
                  className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                >
                  {isLeaving ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin sm:mr-2 sm:h-4 sm:w-4" />
                      Leaving...
                    </>
                  ) : (
                    "Leave"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={isContactConfirmDialogOpen}
            onOpenChange={handleContactConfirmDialogChange}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm contact details</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Please make sure these details are correct before continuing
                  to ticket design selection. Your confirmation and updates will
                  be sent to{" "}
                  <span className="font-semibold text-foreground">
                    {contactDetails.email.trim()}
                  </span>{" "}
                  and{" "}
                  <span className="font-semibold text-foreground">
                    {contactDetails.phoneNumber.trim()}
                  </span>
                  .
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-row justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsContactConfirmDialogOpen(false)}
                  className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                >
                  Go back
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmContactDetails}
                  className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                >
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={isSubmitDialogOpen}
            onOpenChange={handleSubmitDialogChange}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{modeConfig.paymentConfirmationTitle}</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  {modeConfig.paymentConfirmationDescription}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-row justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSubmitDialogOpen(false)}
                  className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmSubmitReservation}
                  className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                >
                  {modeConfig.paymentConfirmationButtonLabel}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {isWalkInMode &&
          modeConfig.finalConfirmationTitle &&
          modeConfig.finalConfirmationDescription ? (
            <Dialog
              open={isFinalizeWalkInDialogOpen}
              onOpenChange={handleFinalizeWalkInDialogChange}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{modeConfig.finalConfirmationTitle}</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm">
                    {modeConfig.finalConfirmationDescription}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-row justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsFinalizeWalkInDialogOpen(false)}
                    className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                  >
                    Go back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmFinalizeWalkIn}
                    className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
                  >
                    {modeConfig.finalConfirmationButtonLabel}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}

          {!isSuccess &&
            !isWalkInPostFinalize &&
            !isLoading &&
            !error &&
            hasActiveRoomAccess &&
            step === "contact" && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Card className="border-sidebar-border/70">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBackToSeats}
                        className="h-8 w-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <CardTitle className="text-base">
                        Contact Details
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field data-invalid={!!contactFieldErrors.firstName}>
                        <Input
                          className="h-10 border-sidebar-border/70 bg-background"
                          placeholder="First name"
                          aria-invalid={!!contactFieldErrors.firstName}
                          value={contactDetails.firstName}
                          onChange={(e) =>
                            updateContactField("firstName", e.target.value)
                          }
                        />
                        <FieldError>{contactFieldErrors.firstName}</FieldError>
                      </Field>
                      <Field data-invalid={!!contactFieldErrors.lastName}>
                        <Input
                          className="h-10 border-sidebar-border/70 bg-background"
                          placeholder="Last name"
                          aria-invalid={!!contactFieldErrors.lastName}
                          value={contactDetails.lastName}
                          onChange={(e) =>
                            updateContactField("lastName", e.target.value)
                          }
                        />
                        <FieldError>{contactFieldErrors.lastName}</FieldError>
                      </Field>
                    </div>
                    <Field data-invalid={!!contactFieldErrors.address}>
                      <Input
                        className="h-10 w-full border-sidebar-border/70 bg-background"
                        placeholder="Address"
                        aria-invalid={!!contactFieldErrors.address}
                        value={contactDetails.address}
                        onChange={(e) =>
                          updateContactField("address", e.target.value)
                        }
                      />
                      <FieldError>{contactFieldErrors.address}</FieldError>
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field data-invalid={!!contactFieldErrors.email}>
                        <Input
                          className="h-10 border-sidebar-border/70 bg-background"
                          placeholder="Email"
                          type="email"
                          inputMode="email"
                          aria-invalid={!!contactFieldErrors.email}
                          value={contactDetails.email}
                          onChange={(e) =>
                            updateContactField("email", e.target.value)
                          }
                        />
                        <FieldError>{contactFieldErrors.email}</FieldError>
                      </Field>
                      <Field data-invalid={!!contactFieldErrors.phoneNumber}>
                        <Input
                          className="h-10 border-sidebar-border/70 bg-background"
                          placeholder="Phone number"
                          inputMode="numeric"
                          maxLength={11}
                          aria-invalid={!!contactFieldErrors.phoneNumber}
                          value={contactDetails.phoneNumber}
                          onChange={(e) =>
                            updateContactField(
                              "phoneNumber",
                              e.target.value.replace(/\D/g, "").slice(0, 11),
                            )
                          }
                        />
                        <FieldError>
                          {contactFieldErrors.phoneNumber}
                        </FieldError>
                      </Field>
                    </div>
                    <Button
                      onClick={handleProceedToPayment}
                      className="w-full gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      {modeConfig.contactActionLabel}
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

          {!isSuccess &&
            !isWalkInPostFinalize &&
            !isLoading &&
            !error &&
            hasActiveRoomAccess &&
            step === "ticket_design" && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Card className="border-sidebar-border/70">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBackToTicketDesign}
                        className="h-8 w-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <CardTitle className="text-base">
                        Select Ticket Design
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isLoadingTicketDesigns ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading ticket designs...
                      </div>
                    ) : ticketDesignsError ? (
                      <div className="space-y-3">
                        <p className="text-sm text-destructive">
                          {ticketDesignsError}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setTicketDesigns([]);
                            setTicketDesignsError(null);
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : ticketDesigns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No ticket designs are available for this show. Please
                        contact the organizer.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {ticketDesigns.map((design) => {
                          const isSelected =
                            selectedTicketTemplateVersionId ===
                            design.ticketTemplateVersionId;
                          return (
                            <button
                              key={design.ticketTemplateVersionId}
                              type="button"
                              onClick={() =>
                                setSelectedTicketTemplateVersionId(
                                  design.ticketTemplateVersionId,
                                )
                              }
                              className={cn(
                                "overflow-hidden rounded-xl border text-left transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-sidebar-border/70 hover:border-primary/40",
                              )}
                            >
                              <div className="aspect-[2550/825] w-full bg-muted/30">
                                {design.previewUrl ? (
                                  <Image
                                    src={design.previewUrl}
                                    alt={`${design.templateName} preview`}
                                    width={2550}
                                    height={825}
                                    unoptimized
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                    No preview image
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1 px-3 py-2">
                                <p className="text-sm font-medium">
                                  {design.templateName}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <Button
                      onClick={handleProceedFromTicketDesign}
                      className="w-full gap-2"
                      disabled={
                        isLoadingTicketDesigns ||
                        ticketDesigns.length === 0 ||
                        !!ticketDesignsError ||
                        !selectedTicketTemplateVersionId
                      }
                    >
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

          {!isSuccess &&
            !isWalkInPostFinalize &&
            !isLoading &&
            !error &&
            hasActiveRoomAccess &&
            step === "payment" && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Card className="gap-0 border-sidebar-border/70">
                  <CardHeader className="pb-1 sm:pb-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBackToContact}
                        className="h-8 w-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <CardTitle className="text-base">
                        {modeConfig.paymentTitle}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 pt-0 sm:px-6">
                    {isWalkInMode ? (
                      <div className="space-y-4 pb-3 text-sm">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                          Collect the in-person payment first, then confirm the
                          amount and seats before finalizing the walk-in sale.
                        </div>
                        <div className="rounded-xl border border-sidebar-border/70 bg-muted/20 p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Customer
                          </p>
                          <div className="mt-2 space-y-1">
                            <p className="font-medium">
                              {contactDetails.firstName.trim()}{" "}
                              {contactDetails.lastName.trim()}
                            </p>
                            <p className="text-muted-foreground">
                              {contactDetails.email.trim()}
                            </p>
                            <p className="text-muted-foreground">
                              {contactDetails.phoneNumber.trim()}
                            </p>
                            <p className="text-muted-foreground">
                              {contactDetails.address.trim()}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-xl border border-sidebar-border/70 bg-background p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Point-of-sale total
                          </p>
                          <p className="mt-2 text-3xl font-semibold">
                            {formatCurrency(subtotal)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedSeatIds.length} seat
                            {selectedSeatIds.length === 1 ? "" : "s"} selected
                          </p>
                        </div>
                        {walkInConfirmationComplete ? (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                            Walk-in confirmation has been captured. Finalizing
                            will save the sale and send the PDF ticket.
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <GcashUploadPanel
                        onUploadComplete={handleScreenshotUploaded}
                        disabled={isCompleting}
                        qrImageUrl={gcashQrImageKey}
                        gcashNumber={gcashNumber}
                        gcashAccountName={gcashAccountName}
                      />
                    )}
                  </CardContent>
                </Card>

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
                            <p className="truncate text-xs sm:text-sm">
                              {item.category?.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.count} x {formatCurrency(item.unitPrice)}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {formatCurrency(item.lineTotal)}
                          </Badge>
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
                    onClick={handleOpenSubmitDialog}
                    disabled={
                      isCompleting ||
                      (modeConfig.requiresScreenshotUpload && !screenshotUrl) ||
                      isLeaving
                    }
                    className="w-full gap-2"
                  >
                    {isCompleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {modeConfig.paymentActionLabel}
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
