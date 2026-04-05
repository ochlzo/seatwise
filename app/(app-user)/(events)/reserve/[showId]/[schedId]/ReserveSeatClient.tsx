"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { SeatStatus, ShowStatus, SchedStatus } from "@prisma/client";
import {
  AlertTriangle,
  Clock3,
  Loader2,
  Mail,
  Plus,
  X,
  CheckCircle2,
  CreditCard,
  ChevronLeft,
  BadgeCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { QueueStatePanel } from "@/components/queue/QueueStatePanel";
import { GcashUploadPanel } from "@/components/queue/GcashUploadPanel";
import { getOrCreateGuestId } from "@/lib/guest";
import {
  clearJoinTransitionState,
  setJoinTransitionState,
} from "@/lib/queue/joinTransition";
import {
  QUEUE_SESSION_RECOVERY_MESSAGE,
  isQueueCompletionSessionRecovery,
} from "@/lib/reservations/queueCompletionRecovery";
import { getReservationEmailOtpInlineError } from "@/lib/reservations/reservationEmailOtpFeedback";
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
const WALK_IN_ADMIN_NICKNAME_STORAGE_KEY = "seatwise:walk-in-admin-nickname";

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
  | "email_otp"
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

type EmailOtpResponse = {
  success?: boolean;
  error?: string;
  verified?: boolean;
  cooldownUntil?: number;
};

type ResendTicketResponse = {
  success?: boolean;
  error?: string;
  cooldownUntil?: number;
};

type QueueJoinResponse = {
  success: boolean;
  error?: string;
  ticket?: { ticketId?: string };
  rank?: number;
  estimatedWaitMinutes?: number;
  status?: "waiting" | "active";
  activeToken?: string;
  expiresAt?: number;
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

const formatScheduleDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const formatScheduleTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
};

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

const setStoredSession = (showScopeId: string, session: StoredActiveSession) => {
  if (typeof window === "undefined") return;

  const storageKey = `seatwise:active:${showScopeId}:${session.ticketId}`;
  window.sessionStorage.setItem(storageKey, JSON.stringify(session));
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

const getVerifiedEmailKey = (showScopeId: string, ticketId: string) =>
  `seatwise:reservation-email-verified:${showScopeId}:${ticketId}`;

const getStoredVerifiedEmail = (
  showScopeId: string,
  ticketId: string,
): string | null => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(
    getVerifiedEmailKey(showScopeId, ticketId),
  );
};

const setStoredVerifiedEmail = (
  showScopeId: string,
  ticketId: string,
  email: string,
) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    getVerifiedEmailKey(showScopeId, ticketId),
    email,
  );
};

const clearStoredVerifiedEmail = (showScopeId: string, ticketId: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getVerifiedEmailKey(showScopeId, ticketId));
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
  const [emailOtpCode, setEmailOtpCode] = React.useState("");
  const [verifiedEmail, setVerifiedEmail] = React.useState<string | null>(null);
  const [otpRecipientEmail, setOtpRecipientEmail] = React.useState<string>("");
  const [resendCooldownUntil, setResendCooldownUntil] = React.useState(0);
  const [emailOtpFieldError, setEmailOtpFieldError] = React.useState<
    string | null
  >(null);
  const [isEmailOtpSubmitting, setIsEmailOtpSubmitting] = React.useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = React.useState(false);
  const [isContactConfirmDialogOpen, setIsContactConfirmDialogOpen] =
    React.useState(false);
  const [emailOtpMessage, setEmailOtpMessage] = React.useState<string | null>(
    null,
  );
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = React.useState(false);
  const [isFinalizeWalkInDialogOpen, setIsFinalizeWalkInDialogOpen] =
    React.useState(false);
  const [walkInConfirmationComplete, setWalkInConfirmationComplete] =
    React.useState(false);
  const [adminNickname, setAdminNickname] = React.useState("");
  const [rememberAdminNickname, setRememberAdminNickname] =
    React.useState(false);
  const [adminNicknameError, setAdminNicknameError] = React.useState<
    string | null
  >(null);
  const [isWalkInResending, setIsWalkInResending] = React.useState(false);
  const [walkInResendCooldownUntil, setWalkInResendCooldownUntil] =
    React.useState(0);
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
  const [displaySeatStatusById, setDisplaySeatStatusById] = React.useState(
    seatStatusById,
  );
  const reservationStepForPresence = step;

  React.useEffect(() => {
    setDisplaySeatStatusById(seatStatusById);
  }, [seatStatusById]);

  const resetWalkInSaleDraft = React.useCallback(() => {
    router.refresh();
    setSelectedSeatIds([]);
    setPendingSeatId(null);
    setSelectionMessage(null);
    setStep("seats");
    setScreenshotUrl("");
    setReservationNumber(null);
    setWalkInConfirmationComplete(false);
    setAdminNickname((prev) => (rememberAdminNickname ? prev : ""));
    setAdminNicknameError(null);
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
  }, [initialTicketDesigns, rememberAdminNickname, router]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !isWalkInMode) return;

    const storedNickname = window.localStorage.getItem(
      WALK_IN_ADMIN_NICKNAME_STORAGE_KEY,
    );

    if (storedNickname?.trim()) {
      setAdminNickname(storedNickname);
      setRememberAdminNickname(true);
    }
  }, [isWalkInMode]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !isWalkInMode) return;

    if (rememberAdminNickname && adminNickname.trim()) {
      window.localStorage.setItem(
        WALK_IN_ADMIN_NICKNAME_STORAGE_KEY,
        adminNickname.trim(),
      );
      return;
    }

    window.localStorage.removeItem(WALK_IN_ADMIN_NICKNAME_STORAGE_KEY);
  }, [adminNickname, isWalkInMode, rememberAdminNickname]);

  React.useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = getStoredSession(showScopeId);
    if (!stored) return;

    const storedVerifiedEmail = getStoredVerifiedEmail(
      showScopeId,
      stored.ticketId,
    );
    if (!storedVerifiedEmail) return;

    setVerifiedEmail(storedVerifiedEmail);
    setContactDetails((prev) =>
      prev.email.trim() ? prev : { ...prev, email: storedVerifiedEmail },
    );
  }, [showScopeId]);

  const otpResendWaitSeconds = React.useMemo(() => {
    if (resendCooldownUntil <= now) return 0;
    return Math.max(1, Math.ceil((resendCooldownUntil - now) / 1000));
  }, [now, resendCooldownUntil]);

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
            reservationStep: reservationStepForPresence,
            scheduleSnapshot: initialScheduleSnapshot,
          }),
        });
      } catch {
        // Best effort cleanup request; UI fallback still handles local session reset.
      }
    },
    [initialScheduleSnapshot, participantId, reservationStepForPresence, schedId, showId],
  );

  React.useEffect(() => {
    const verify = async () => {
      setIsLoading(true);
      setError(null);

      const stored = getStoredSession(showScopeId);
      if (!stored) {
        setError(
          "We couldn’t find your active turn. Rejoin the queue to continue.",
        );
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
  }, [
    initialScheduleSnapshot,
    participantId,
    reservationStepForPresence,
    schedId,
    showId,
    showScopeId,
  ]);

  React.useEffect(() => {
    if (step === "success" || !!error || (!isWalkInMode && !expiresAt)) {
      return;
    }

    const heartbeat = async () => {
      const stored = getStoredSession(showScopeId);
      if (!stored) {
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
            reservationStep: reservationStepForPresence,
            scheduleSnapshot: initialScheduleSnapshot,
          }),
        });

        const data = (await response.json()) as {
          success: boolean;
          valid?: boolean;
          error?: string;
        };

        if (!response.ok || !data.success || data.valid === false) {
          if (data.valid === false) {
            clearStoredSession(showScopeId);
            setError(EXPIRED_WINDOW_MESSAGE);
            return;
          }

          if (data.error) {
            setError(data.error);
          }
          return;
        }
      } catch {
        // Best effort heartbeat; the next poll or interaction can retry.
      }
    };

    void heartbeat();
    const timer = window.setInterval(() => {
      void heartbeat();
    }, 15_000);

    return () => window.clearInterval(timer);
  }, [
    expiresAt,
    initialScheduleSnapshot,
    isWalkInMode,
    participantId,
    reservationStepForPresence,
    schedId,
    showId,
    showScopeId,
    step,
    error,
  ]);

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
    setEmailOtpCode("");
    setEmailOtpMessage(null);
    setVerifiedEmail(null);
    setOtpRecipientEmail("");
    setResendCooldownUntil(0);
    setEmailOtpFieldError(null);
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
    const reservePath = isWalkInMode
      ? `/admin/walk-in/${showId}/${schedId}/room`
      : `/reserve/${showId}/${schedId}`;
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

    const handlePageHide = () => {
      if (!shouldGuard()) return;
      void terminateQueueSession(true);
    };

    const handleOffline = () => {
      if (!shouldGuard()) return;
      const message = "Connection lost. Your active reservation room will stay open.";
      setError(message);
      toast.error(message);
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

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [
    isWalkInMode,
    router,
    schedId,
    showId,
    showScopeId,
    step,
    terminateQueueSession,
  ]);

  React.useEffect(() => {
    if (step === "success") return;

    const shouldGuard = () => {
      if (allowNavigationRef.current) return false;
      return (
        !!getStoredSession(showScopeId) || !!getPendingTermination(showScopeId)
      );
    };

    const backGuardMessage =
      "Leaving this page will remove you from the queue.";
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

  const handleRejoinQueue = async () => {
    setIsRejoining(true);
    try {
      await terminateQueueSession(false);

      if (isWalkInMode) {
        const response = await fetch("/api/admin/walk-in/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId,
            schedId,
          }),
        });

        const data = (await response.json()) as
          | {
              success: true;
              state: "queued" | "active_and_paused";
              showScopeId: string;
              ticketId?: string;
              activeToken?: string;
              expiresAt?: number | null;
            }
          | { success?: false; error?: string };

        if (!response.ok || !("success" in data) || data.success !== true) {
          throw new Error(("error" in data ? data.error : undefined) || "Failed to rejoin queue");
        }

        if (
          data.state === "active_and_paused" &&
          data.ticketId &&
          data.activeToken &&
          typeof data.expiresAt === "number"
        ) {
          setStoredSession(showScopeId, {
            ticketId: data.ticketId,
            activeToken: data.activeToken,
            expiresAt: data.expiresAt,
            showScopeId,
          });
          allowNavigationRef.current = true;
          router.push(`/admin/walk-in/${showId}/${schedId}/room`);
          return;
        }

        allowNavigationRef.current = true;
        router.push(`/admin/walk-in/${showId}/${schedId}`);
        return;
      }

      const response = await fetch("/api/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          schedId,
          guestId: participantId,
        }),
      });

      const data = (await response.json()) as QueueJoinResponse;
      if (!response.ok || !data.success) {
        const normalizedError = data.error?.toLowerCase() ?? "";
        if (normalizedError.includes("already in the queue")) {
          router.push(`/queue/${showId}/${schedId}`);
          return;
        }
        throw new Error(data.error || "Failed to rejoin queue");
      }

      if (data.ticket?.ticketId) {
        const ticketId = data.ticket.ticketId;
        const storageKey = `seatwise:active:${showScopeId}:${ticketId}`;
        if (data.status === "active" && data.activeToken && data.expiresAt) {
          sessionStorage.setItem(
            storageKey,
            JSON.stringify({
              ticketId,
              activeToken: data.activeToken,
              expiresAt: data.expiresAt,
              showScopeId,
            }),
          );
          setJoinTransitionState(showScopeId);
          allowNavigationRef.current = true;
          router.push(`/reserve/${showId}/${schedId}`);
          return;
        }
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

  // Step transition: contact -> email verification
  const handleProceedToPayment = () => {
    const firstName = contactDetails.firstName.trim();
    const lastName = contactDetails.lastName.trim();
    const address = contactDetails.address.trim();
    const email = contactDetails.email.trim();
    const phoneNumber = contactDetails.phoneNumber.trim();
    const nextErrors: ContactFieldErrors = { ...EMPTY_CONTACT_ERRORS };
    let hasErrors = false;

    if (!isWalkInMode && !firstName) {
      nextErrors.firstName = "First name is required.";
      hasErrors = true;
    }

    if (!isWalkInMode && !lastName) {
      nextErrors.lastName = "Last name is required.";
      hasErrors = true;
    }

    if (!isWalkInMode && !address) {
      nextErrors.address = "Address is required.";
      hasErrors = true;
    }

    if (!isWalkInMode && !email) {
      nextErrors.email = "Email is required.";
      hasErrors = true;
    } else if (email && !EMAIL_REGEX.test(email)) {
      nextErrors.email = "Please provide a valid email address.";
      hasErrors = true;
    }

    if (!isWalkInMode && !phoneNumber) {
      nextErrors.phoneNumber = "Phone number is required.";
      hasErrors = true;
    } else if (phoneNumber && !PH_PHONE_REGEX.test(phoneNumber)) {
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

  const sendReservationEmailOtp = React.useCallback(
    async (nextEmail?: string) => {
      const stored = getStoredSession(showScopeId);
      if (!stored) {
        setError(
          "We couldnâ€™t find your active turn. Rejoin the queue to continue.",
        );
        return false;
      }

      const email = (nextEmail ?? contactDetails.email).trim();
      if (!email) {
        setError("Email is required.");
        return false;
      }

      setIsEmailOtpSubmitting(true);
      setError(null);
      setEmailOtpMessage(null);
      setEmailOtpFieldError(null);
      try {
        const response = await fetch("/api/queue/reservation-email-otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId,
            schedId,
            guestId: participantId,
            ticketId: stored.ticketId,
            activeToken: stored.activeToken,
            email,
          }),
        });
        const data = (await response.json()) as EmailOtpResponse;
        if (!response.ok || !data.success) {
          if (typeof data.cooldownUntil === "number") {
            setResendCooldownUntil(data.cooldownUntil);
          }
          throw new Error(data.error || "Failed to send verification code.");
        }

        if (data.verified) {
          setVerifiedEmail(email);
          setOtpRecipientEmail(email);
          setStoredVerifiedEmail(showScopeId, stored.ticketId, email);
          setEmailOtpMessage("Your email is already verified.");
          setEmailOtpCode("");
          setResendCooldownUntil(data.cooldownUntil ?? 0);
          setStep("ticket_design");
          return true;
        }

        setVerifiedEmail(null);
        setOtpRecipientEmail(email);
        clearStoredVerifiedEmail(showScopeId, stored.ticketId);
        setEmailOtpMessage(`Verification code sent to ${email}.`);
        setEmailOtpCode("");
        setResendCooldownUntil(data.cooldownUntil ?? Date.now() + 30_000);
        setStep("email_otp");
        return true;
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? sendError.message
            : "Failed to send verification code.",
        );
        return false;
      } finally {
        setIsEmailOtpSubmitting(false);
      }
    },
    [contactDetails.email, participantId, schedId, showId, showScopeId],
  );

  const handleConfirmContactDetails = async () => {
    setIsContactConfirmDialogOpen(false);
    if (isWalkInMode) {
      setStep("ticket_design");
      return;
    }

    const email = contactDetails.email.trim();
    if (verifiedEmail && verifiedEmail === email) {
      setEmailOtpMessage("Your email is already verified.");
      setStep("ticket_design");
      return;
    }

    await sendReservationEmailOtp(email);
  };

  const handleBackToSeats = () => {
    setStep("seats");
  };

  const handleBackToContact = () => {
    setEmailOtpCode("");
    setEmailOtpMessage(null);
    setEmailOtpFieldError(null);
    setStep("contact");
    setWalkInConfirmationComplete(false);
  };

  const handleBackToTicketDesign = () => {
    setStep("email_otp");
    setWalkInConfirmationComplete(false);
  };

  const handleVerifyEmailOtp = async () => {
    const stored = getStoredSession(showScopeId);
    if (!stored) {
      setError(
        "We couldnâ€™t find your active turn. Rejoin the queue to continue.",
      );
      return;
    }

    const email = contactDetails.email.trim();
    if (!email) {
      setError("Email is required.");
      return;
    }

    if (emailOtpCode.trim().length < 6) {
      setEmailOtpFieldError("Enter the 6-digit verification code.");
      toast.error("Enter the 6-digit verification code.");
      return;
    }

    setIsEmailOtpSubmitting(true);
    setError(null);
    setEmailOtpMessage(null);
    setEmailOtpFieldError(null);
    try {
      const response = await fetch("/api/queue/reservation-email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          schedId,
          guestId: participantId,
          ticketId: stored.ticketId,
          activeToken: stored.activeToken,
          email,
          otp: emailOtpCode.trim(),
        }),
      });
      const data = (await response.json()) as EmailOtpResponse;
      if (!response.ok || !data.success) {
        const inlineError = getReservationEmailOtpInlineError(
          response.status,
          data.error ?? null,
        );

        if (inlineError) {
          setEmailOtpFieldError(inlineError);
          toast.error(inlineError);
          return;
        }

        throw new Error(data.error || "Failed to verify your email.");
      }

      setVerifiedEmail(email);
      setOtpRecipientEmail(email);
      setStoredVerifiedEmail(showScopeId, stored.ticketId, email);
      setEmailOtpCode("");
      setEmailOtpFieldError(null);
      setEmailOtpMessage("Email verified. Continue to ticket design.");
      setResendCooldownUntil(0);
      setStep("ticket_design");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Failed to verify your email.",
      );
    } finally {
      setIsEmailOtpSubmitting(false);
    }
  };

  const handleResendEmailOtp = async () => {
    await sendReservationEmailOtp();
  };

  const handleEmailOtpCodeChange = React.useCallback((value: string) => {
    setEmailOtpCode(value.replace(/\D/g, "").slice(0, 6));
    setEmailOtpFieldError(null);
  }, []);

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
    if (isWalkInMode && !adminNickname.trim()) {
      setAdminNicknameError("Admin nickname is required.");
      toast.error("Enter the admin nickname before finalizing.");
      return;
    }
    setAdminNicknameError(null);
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
      if (field === "email") {
        const nextEmail = value.trim();
        if (otpRecipientEmail && otpRecipientEmail !== nextEmail) {
          const stored = getStoredSession(showScopeId);
          setVerifiedEmail(null);
          if (stored?.ticketId) {
            clearStoredVerifiedEmail(showScopeId, stored.ticketId);
          }
        }
        setEmailOtpCode("");
        setEmailOtpMessage(null);
        setEmailOtpFieldError(null);
        if (!otpRecipientEmail || otpRecipientEmail !== nextEmail) {
          setResendCooldownUntil(0);
        }
      }
    },
    [otpRecipientEmail, showScopeId],
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
    if (!isWalkInMode) {
      const email = contactDetails.email.trim();
      if (!verifiedEmail || verifiedEmail !== email) {
        setError("Verify your email before submitting the reservation.");
        setStep("email_otp");
        return;
      }
    }
    if (!selectedTicketTemplateVersionId) {
      toast.error("Please select a ticket design before submitting.");
      return;
    }

    const stored = getStoredSession(showScopeId);
    if (!stored) {
      setError(
        "We couldn’t find your active turn. Rejoin the queue to continue.",
      );
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
          adminNickname,
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
        reason?: string;
        reservationNumber?: string;
        warning?: string | null;
      };
      if (!response.ok || !data.success) {
        if (
          isQueueCompletionSessionRecovery({
            status: response.status,
            reason: data.reason,
            error: data.error,
          })
        ) {
          setError(QUEUE_SESSION_RECOVERY_MESSAGE);
          return;
        }

        throw new Error(data.error || "Failed to complete reservation session");
      }

      setReservationNumber(data.reservationNumber ?? null);
      if (data.warning) {
        toast.warning(data.warning);
      }
      if (isWalkInMode) {
        setDisplaySeatStatusById((current) => {
          const nextStatusById = { ...current };
          for (const seatId of selectedSeatIds) {
            nextStatusById[seatId] = "CONSUMED";
          }
          return nextStatusById;
        });
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
  const isExpiredWindowError =
    error === EXPIRED_WINDOW_MESSAGE ||
    error === QUEUE_SESSION_RECOVERY_MESSAGE;
  const isQueueRecoveryError = error === QUEUE_SESSION_RECOVERY_MESSAGE;
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
  const customerDisplayName =
    `${contactDetails.firstName.trim()} ${contactDetails.lastName.trim()}`.trim();
  const customerEmailDisplay = contactDetails.email.trim() || "-";
  const customerPhoneDisplay = contactDetails.phoneNumber.trim() || "-";
  const customerAddressDisplay = contactDetails.address.trim() || "-";
  const walkInResendWaitSeconds = Math.max(
    0,
    Math.ceil((walkInResendCooldownUntil - now) / 1000),
  );
  const scheduleSummary = React.useMemo(() => {
    if (!initialScheduleSnapshot) {
      return "";
    }

    const dateLabel = formatScheduleDate(initialScheduleSnapshot.schedDate);
    const startLabel = formatScheduleTime(initialScheduleSnapshot.schedStartTime);
    const endLabel = formatScheduleTime(initialScheduleSnapshot.schedEndTime);

    return `Schedule: ${dateLabel}, ${startLabel} - ${endLabel}`;
  }, [initialScheduleSnapshot]);
  const canResendWalkInTicket =
    isWalkInMode &&
    step === "post_finalize" &&
    !!contactDetails.email.trim() &&
    !!reservationNumber;
  const isCurrentEmailVerified =
    !!verifiedEmail && verifiedEmail === contactDetails.email.trim();
  const contactActionButtonLabel = isCurrentEmailVerified
    ? modeConfig.contactActionLabel
    : isWalkInMode
      ? modeConfig.contactActionLabel
      : "Verify email";

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

  const handleResendWalkInTicket = async () => {
    if (
      !canResendWalkInTicket ||
      isWalkInResending ||
      walkInResendWaitSeconds > 0
    ) {
      return;
    }

    setIsWalkInResending(true);
    try {
      const response = await fetch("/api/reservations/resend-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          reservationNumber,
          email: contactDetails.email.trim(),
        }),
      });

      const data = (await response.json()) as ResendTicketResponse;
      if (!response.ok || !data.success) {
        if (typeof data.cooldownUntil === "number") {
          setWalkInResendCooldownUntil(data.cooldownUntil);
        }

        throw new Error(data.error || "Failed to resend e-ticket.");
      }

      setWalkInResendCooldownUntil(data.cooldownUntil ?? Date.now() + 30_000);
      toast.success("E-ticket resent.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to resend e-ticket.",
      );
    } finally {
      setIsWalkInResending(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6 lg:p-8">
      <Card className="border-0 bg-transparent py-0 shadow-none rounded-none gap-4 sm:border-sidebar-border/70 sm:bg-card sm:py-6 sm:shadow-sm sm:rounded-xl sm:gap-6">
        {!isSuccess && (
          <CardHeader className="px-0 sm:px-6">
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {showName || "Getting your reservation room ready..."}
                  </CardTitle>
                  {scheduleSummary ? (
                    <p className="mt-1 block text-sm font-medium leading-tight text-foreground/70 sm:text-base">
                      {scheduleSummary}
                    </p>
                  ) : null}
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
                    {step === "email_otp" && (
                      <Badge
                        variant="secondary"
                        className="w-fit gap-1 text-sm"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Verify Email
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
                {contactDetails.email.trim() ? (
                  <div className="rounded-xl border border-sidebar-border/70 bg-background p-5 text-left shadow-sm">
                    <p className="text-sm font-semibold text-foreground">
                      Didn&apos;t get the email? Send again
                    </p>
                    <Separator className="my-4" />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="truncate text-sm text-muted-foreground">
                        {contactDetails.email.trim()}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleResendWalkInTicket()}
                        disabled={
                          isWalkInResending || walkInResendWaitSeconds > 0
                        }
                        className="sm:min-w-[180px]"
                      >
                        {isWalkInResending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : walkInResendWaitSeconds > 0 ? (
                          `Resend in ${walkInResendWaitSeconds}s`
                        ) : (
                          "Resend"
                        )}
                      </Button>
                    </div>
                    <Separator className="mt-4" />
                  </div>
                ) : null}
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
            <QueueStatePanel
              tone="neutral"
              icon={<Loader2 className="h-5 w-5 animate-spin" />}
              title="Checking your place"
              description="Please keep this tab open while we confirm your turn."
              badgeLabel="Loading"
            >
              <div className="text-sm text-muted-foreground">
                This usually takes just a moment.
              </div>
            </QueueStatePanel>
          )}

          {!isSuccess && !isWalkInPostFinalize && !isLoading && error && (
            <QueueStatePanel
              tone={isExpiredWindowError ? "warning" : "danger"}
              icon={<AlertTriangle className="h-5 w-5" />}
              title={
                isExpiredWindowError
                  ? "Your turn ended"
                  : "We couldn’t open the reservation room"
              }
              description={
                isExpiredWindowError
                  ? isQueueRecoveryError
                    ? "Your reservation window ended before checkout was finished."
                    : "Your turn expired before you could continue."
                  : error
              }
              badgeLabel={isExpiredWindowError ? "Rejoin queue" : "Try again"}
              footer={
                <div className="flex flex-col gap-3 sm:flex-row">
                  {isExpiredWindowError ? (
                    <>
                      <Button
                        onClick={handleRejoinQueue}
                        disabled={isRejoining}
                        className="sm:min-w-40"
                      >
                        {isRejoining ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Rejoining...
                          </>
                        ) : (
                          "Rejoin queue"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleDeclineRejoin}
                        disabled={isRejoining}
                        className="sm:min-w-40"
                      >
                        Exit
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleRejoinQueue}
                        className="sm:min-w-40"
                      >
                        Back to queue
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleDeclineRejoin}
                        className="sm:min-w-40"
                      >
                        Exit
                      </Button>
                    </>
                  )}
                </div>
              }
            />
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
                    seatStatusById={displaySeatStatusById}
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
                <DialogDescription className="text-justify text-xs sm:text-sm">
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
                    {isWalkInMode ? (
                      <p className="text-sm text-muted-foreground">
                        Customer details are optional. Enter an email if the
                        customer wants an e-ticket copy sent.
                      </p>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field data-invalid={!!contactFieldErrors.firstName}>
                        <FieldLabel>
                          {isWalkInMode ? "First name (optional)" : "First name"}
                        </FieldLabel>
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
                        <FieldLabel>
                          {isWalkInMode ? "Last name (optional)" : "Last name"}
                        </FieldLabel>
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
                      <FieldLabel>
                        {isWalkInMode ? "Address (optional)" : "Address"}
                      </FieldLabel>
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
                        <FieldLabel>
                          {isWalkInMode ? "Email (optional)" : "Email"}
                        </FieldLabel>
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
                        <FieldLabel>
                          {isWalkInMode
                            ? "Phone number (optional)"
                            : "Phone number"}
                        </FieldLabel>
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
                      {contactActionButtonLabel}
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
            !isWalkInMode &&
            step === "email_otp" && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Card className="border-sidebar-border/70">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBackToContact}
                        className="h-8 w-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <CardTitle className="text-base">Verify Email</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field>
                      <FieldLabel>Email address</FieldLabel>
                      <Input
                        type="email"
                        inputMode="email"
                        value={contactDetails.email}
                        onChange={(event) =>
                          updateContactField("email", event.target.value)
                        }
                        placeholder="name@example.com"
                      />
                      <FieldDescription>
                        You can correct the email here if needed. A new code can
                        be requested after 30 seconds.
                      </FieldDescription>
                    </Field>

                    <Field data-invalid={!!emailOtpFieldError}>
                      <FieldLabel>Verification code</FieldLabel>
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6-digit code"
                        value={emailOtpCode}
                        onChange={(event) =>
                          handleEmailOtpCodeChange(event.target.value)
                        }
                        aria-invalid={!!emailOtpFieldError}
                      />
                      <FieldDescription>
                        Enter the 6-digit code from the email we just sent.
                      </FieldDescription>
                      <FieldError>{emailOtpFieldError}</FieldError>
                    </Field>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        onClick={() => void handleVerifyEmailOtp()}
                        disabled={
                          isEmailOtpSubmitting || emailOtpCode.length < 6
                        }
                        className="gap-2"
                      >
                        {isEmailOtpSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <BadgeCheck className="h-4 w-4" />
                            Verify Code
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleResendEmailOtp()}
                        disabled={
                          isEmailOtpSubmitting || otpResendWaitSeconds > 0
                        }
                        className="gap-2"
                      >
                        {otpResendWaitSeconds > 0
                          ? `Resend in ${otpResendWaitSeconds}s`
                          : "Resend Code"}
                      </Button>
                    </div>
                    {emailOtpMessage ? (
                      <p className="text-sm text-green-600">
                        {emailOtpMessage}
                      </p>
                    ) : null}
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
                              {customerDisplayName || "-"}
                            </p>
                            <p className="text-muted-foreground">
                              {customerEmailDisplay}
                            </p>
                            <p className="text-muted-foreground">
                              {customerPhoneDisplay}
                            </p>
                            <p className="text-muted-foreground">
                              {customerAddressDisplay}
                            </p>
                          </div>
                        </div>
                        <Field data-invalid={!!adminNicknameError}>
                          <FieldLabel
                            className={cn(
                              "w-full items-center justify-between",
                              adminNicknameError ? "text-destructive" : undefined,
                            )}
                          >
                            <span>Admin Name (Nickname)</span>
                            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <span
                                className={cn(
                                  adminNicknameError
                                    ? "text-destructive"
                                    : "text-muted-foreground",
                                )}
                              >
                                Remember me
                              </span>
                              <Switch
                                checked={rememberAdminNickname}
                                onCheckedChange={setRememberAdminNickname}
                                aria-label="Remember admin nickname"
                              />
                            </span>
                          </FieldLabel>
                          <Input
                            value={adminNickname}
                            onChange={(event) => {
                              setAdminNickname(event.target.value);
                              setAdminNicknameError(null);
                            }}
                            placeholder="Who accommodated this customer?"
                            aria-invalid={!!adminNicknameError}
                            className={cn(
                              "h-10 bg-background",
                              adminNicknameError
                                ? "border-destructive focus-visible:border-destructive"
                                : "border-sidebar-border/70",
                            )}
                          />
                          <FieldDescription
                            className={cn(
                              adminNicknameError ? "text-destructive" : undefined,
                            )}
                          >
                            Required. This will be shown on the reservation
                            record for this walk-in sale.
                          </FieldDescription>
                        </Field>
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
