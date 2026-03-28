"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  Armchair,
  ArrowDownToLine,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  GripVertical,
  Loader2,
  Mail,
  Search,
  Ticket,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { toast } from "@/components/ui/sonner";
import { useAppSelector } from "@/lib/hooks";
import { getAdminPaymentDisplay } from "@/lib/reservations/adminPaymentDisplay";
import type { RootState } from "@/lib/store";

type PaymentData = {
  payment_id: string;
  amount: string;
  method: string;
  status: string;
  reference_no: string | null;
  screenshot_url: string | null;
  paid_at: string | null;
  createdAt: string;
};

type ReservationData = {
  reservation_id: string;
  reservation_number: string;
  guest_id: string;
  first_name: string;
  last_name: string;
  address: string;
  email: string;
  phone_number: string;
  status: string;
  createdAt: string;
  payment: PaymentData | null;
  seatAssignments: Array<{
    seat_assignment_id: string;
    seat: { seat_number: string };
    sched: {
      sched_id: string;
      sched_date: string;
      sched_start_time: string;
      sched_end_time: string;
      show: {
        show_id: string;
        show_name: string;
        venue: string;
        show_image_key: string | null;
      };
    };
    set: {
      seatCategory: {
        category_name: string;
        price: string;
        color_code: string;
      };
    };
  }>;
};

type ShowGroup = {
  showId: string;
  showName: string;
  venue: string;
  showImageKey: string | null;
  teamId: string | null;
  reservations: ReservationData[];
};

type TeamOption = {
  team_id: string;
  name: string;
};

type UserReservationRow = {
  userId: string;
  reservationNumber: string;
  user: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    address: string;
  };
  reservations: ReservationData[];
  seatNumbers: string[];
  pendingReservationIds: string[];
  latestCreatedAt: string;
  totalAmount: number;
};

type KanbanStatus = "PENDING" | "CONFIRMED" | "REJECTED";

type KanbanCard = {
  id: string;
  status: KanbanStatus;
  showId: string;
  showName: string;
  showVenue: string;
  row: UserReservationRow;
};

type DisplayCard = KanbanCard & {
  isPreview?: boolean;
};

type PendingMove = {
  cardId: string;
  targetStatus: "CONFIRMED" | "REJECTED";
  source: "drag" | "portal";
};

type StageUpdateResponse = {
  success: boolean;
  error?: string;
  message?: string;
  details?: string;
  email?: {
    attemptedCount: number;
    sentCount: number;
    failedCount: number;
    sent: boolean;
  };
};

type RollbackRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type RollbackPreview = {
  cardId: string;
  sourceStatus: KanbanStatus;
  fromRect: RollbackRect | null;
};

type RollbackGhost = {
  card: KanbanCard;
  fromRect: RollbackRect;
  toRect: RollbackRect;
  isAnimating: boolean;
};

const APPROVAL_PROGRESS_STEPS = [
  { delayMs: 0, label: "Moving to approved..." },
  { delayMs: 1200, label: "Building ticket..." },
  { delayMs: 2600, label: "Sending email..." },
] as const;

const COLUMNS: Array<{
  key: KanbanStatus;
  title: string;
  icon: React.ReactNode;
  stageClassName: string;
  stageCountClassName: string;
  stageSurfaceClassName: string;
}> = [
  {
    key: "PENDING",
    title: "Pending",
    icon: <Clock className="h-4 w-4" />,
    stageClassName: "bg-amber-400 text-white",
    stageCountClassName: "bg-white/20 text-white",
    stageSurfaceClassName: "bg-amber-50/80 dark:bg-amber-500/10",
  },
  {
    key: "CONFIRMED",
    title: "Confirmed",
    icon: <CheckCircle2 className="h-4 w-4" />,
    stageClassName: "bg-emerald-500 text-white",
    stageCountClassName: "bg-white/20 text-white",
    stageSurfaceClassName: "bg-emerald-50/80 dark:bg-emerald-500/10",
  },
  {
    key: "REJECTED",
    title: "Rejected",
    icon: <XCircle className="h-4 w-4" />,
    stageClassName: "bg-red-500 text-white",
    stageCountClassName: "bg-white/20 text-white",
    stageSurfaceClassName: "bg-red-50/80 dark:bg-red-500/10",
  },
];

const columnId = (status: KanbanStatus) => `column:${status}`;
const ROLLBACK_PREVIEW_MS = 360;
const PORTAL_TRANSITION_MS = 240;
const PORTAL_SCROLL_DELAY_MS = 220;

const formatCurrency = (value: string | number) => {
  const parsed = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(parsed);
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const parseTimeValue = (value: string) => {
  const directDate = new Date(value);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  const match = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;

  const [, hourText, minuteText, secondText] = match;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? "0");

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  const date = new Date("2026-01-01T00:00:00");
  date.setHours(hour, minute, second, 0);
  return date;
};

const formatTimeRange = (start: string, end: string) => {
  const startDate = parseTimeValue(start);
  const endDate = parseTimeValue(end);

  if (!startDate || !endDate) {
    return [start, end].filter(Boolean).join(" - ") || "Time unavailable";
  }

  const formatter = new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
};

const getApiErrorMessage = (
  payload: unknown,
  fallback: string,
): string => {
  if (!payload || typeof payload !== "object") return fallback;

  const messageCandidate =
    "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "details" in payload && typeof payload.details === "string"
          ? payload.details
          : null;

  return messageCandidate?.trim() ? messageCandidate : fallback;
};

const getRowStatus = (row: UserReservationRow): KanbanStatus => {
  if (row.pendingReservationIds.length > 0) return "PENDING";
  if (
    row.reservations.every((reservation) => reservation.status === "CONFIRMED")
  )
    return "CONFIRMED";
  return "REJECTED";
};

const buildUserRows = (
  reservations: ReservationData[],
): UserReservationRow[] => {
  return reservations
    .map((reservation) => ({
      userId: reservation.payment?.payment_id ?? reservation.reservation_id,
      reservationNumber: reservation.reservation_number,
      user: {
        first_name: reservation.first_name,
        last_name: reservation.last_name,
        email: reservation.email,
        phone_number: reservation.phone_number,
        address: reservation.address,
      },
      reservations: [reservation],
      seatNumbers: Array.from(
        new Set(
          reservation.seatAssignments.map(
            (seatAssignment) => seatAssignment.seat.seat_number,
          ),
        ),
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      pendingReservationIds:
        reservation.status === "PENDING" ? [reservation.reservation_id] : [],
      latestCreatedAt: reservation.createdAt,
      totalAmount: reservation.payment?.amount
        ? parseFloat(reservation.payment.amount)
        : 0,
    }))
    .sort(
      (a, b) =>
        new Date(b.latestCreatedAt).getTime() -
        new Date(a.latestCreatedAt).getTime(),
    );
};

type SortableCardProps = {
  card: KanbanCard;
  isVerifying: boolean;
  progressLabel?: string | null;
  onOpenDetails: (card: KanbanCard) => void;
};

function SortableCard({
  card,
  isVerifying,
  progressLabel = null,
  onOpenDetails,
}: SortableCardProps) {
  const primaryPayment =
    card.row.reservations.find((reservation) => reservation.payment?.screenshot_url)?.payment ??
    card.row.reservations.find((reservation) => reservation.payment)?.payment ??
    null;
  const paymentDisplay = getAdminPaymentDisplay(primaryPayment?.method);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({
      id: card.id,
      disabled: isVerifying,
      data: { type: "card", column: card.status },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging
      ? "transform 0ms linear"
      : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "transform",
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`border-sidebar-border/70 dark:border-white/20 ${isDragging ? "border-dashed bg-muted/60" : ""} ${isVerifying ? "opacity-70" : ""}`}
    >
      <CardContent
        className={`relative space-y-2 p-4 pr-10 ${isDragging ? "opacity-0" : ""}`}
      >
        <button
          type="button"
          aria-label={isVerifying ? "Reservation update in progress" : "Drag reservation card"}
          className={`absolute right-3 top-3 inline-flex h-6 w-6 touch-none items-center justify-center rounded-md text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${isVerifying ? "cursor-wait" : "hover:cursor-grab hover:bg-muted hover:text-foreground active:cursor-grabbing"}`}
          disabled={isVerifying}
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          {isVerifying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GripVertical className="h-4 w-4" />
          )}
        </button>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onOpenDetails(card)}
            className="block w-full cursor-pointer space-y-2 text-left lg:hidden"
          >
            <p className="text-base font-bold leading-tight text-foreground">
              {card.showName}
            </p>
            <p className="text-sm font-medium text-foreground">
              {card.row.user.first_name} {card.row.user.last_name}
            </p>
          </button>
          <div className="group hidden w-fit cursor-pointer space-y-1 lg:block">
            <button
              type="button"
              onClick={() => onOpenDetails(card)}
              className="block cursor-pointer text-left text-base font-bold leading-tight text-foreground transition-colors group-hover:text-blue-600 group-hover:underline group-hover:underline-offset-4 hover:text-blue-600 hover:underline hover:underline-offset-4"
            >
              {card.showName}
            </button>
            <button
              type="button"
              onClick={() => onOpenDetails(card)}
              className="block cursor-pointer text-left text-sm font-medium text-foreground transition-colors group-hover:text-blue-600 group-hover:underline group-hover:underline-offset-4 hover:text-blue-600 hover:underline hover:underline-offset-4"
            >
              {card.row.user.first_name} {card.row.user.last_name}
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{card.row.user.email}</p>
          {paymentDisplay.cardTagLabel ? (
            <span className="inline-flex w-fit items-center rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700">
              {paymentDisplay.cardTagLabel}
            </span>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Reservation No: {card.row.reservationNumber}
          </p>
          <p className="text-sm text-muted-foreground">
            {card.row.seatNumbers.length} seat
            {card.row.seatNumbers.length !== 1 ? "s" : ""} -{" "}
            {formatCurrency(card.row.totalAmount)}
          </p>
          {isVerifying && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {progressLabel ?? "Updating reservation..."}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewPlaceholderCard({
  card,
  previewId,
  rollbackAnchorId,
}: {
  card: KanbanCard;
  previewId?: string;
  rollbackAnchorId?: string;
}) {
  const isRollbackAnchor = Boolean(rollbackAnchorId);

  return (
    <Card
      data-preview-id={previewId}
      data-rollback-anchor={rollbackAnchorId}
      className={isRollbackAnchor
        ? "pointer-events-none border-transparent bg-transparent shadow-none"
        : "border-sidebar-border/70 bg-muted/60 dark:border-white/20 dark:bg-muted/40"}
    >
      <CardContent className="space-y-2 p-4 pr-10 opacity-0">
        <p className="text-base font-bold leading-tight">{card.showName}</p>
        <p className="text-sm font-medium">
          {card.row.user.first_name} {card.row.user.last_name}
        </p>
        <p className="text-sm">{card.row.user.email}</p>
        <p className="text-xs">Reservation No: {card.row.reservationNumber}</p>
        <p className="text-sm">
          {card.row.seatNumbers.length} seat
          {card.row.seatNumbers.length !== 1 ? "s" : ""} -{" "}
          {formatCurrency(card.row.totalAmount)}
        </p>
      </CardContent>
    </Card>
  );
}

type KanbanColumnProps = {
  status: KanbanStatus;
  title: string;
  icon: React.ReactNode;
  cards: DisplayCard[];
  isActiveDrop: boolean;
  updatingCardIds: Set<string>;
  stageClassName: string;
  stageCountClassName: string;
  stageSurfaceClassName: string;
  progressLabelsByCardId: Partial<Record<string, string>>;
  onOpenDetails: (card: KanbanCard) => void;
};

function KanbanColumn({
  status,
  title,
  icon,
  cards,
  isActiveDrop,
  updatingCardIds,
  stageClassName,
  stageCountClassName,
  stageSurfaceClassName,
  progressLabelsByCardId,
  onOpenDetails,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: columnId(status),
    data: { type: "column", column: status },
  });

  return (
    <div
      ref={setNodeRef}
      className={`overflow-hidden rounded-xl border border-sidebar-border/70 dark:border-white/20 ${stageSurfaceClassName} transition-colors ${isActiveDrop ? "bg-muted/50" : ""}`}
    >
      <div
        className={`flex items-center justify-between px-3 py-2 ${stageClassName}`}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${stageCountClassName}`}
        >
          {cards.length}
        </span>
      </div>

      <SortableContext
        items={cards.filter((card) => !card.isPreview).map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="min-h-[220px] space-y-3 p-3">
          {cards.map((card) =>
            card.isPreview ? (
              <PreviewPlaceholderCard
                key={card.id}
                card={card}
                previewId={card.id.startsWith("preview:") ? card.id : undefined}
                rollbackAnchorId={
                  card.id.startsWith("rollback:")
                    ? card.id.replace("rollback:", "")
                    : undefined
                }
              />
            ) : (
              <SortableCard
                key={card.id}
                card={card}
                isVerifying={updatingCardIds.has(card.id)}
                progressLabel={progressLabelsByCardId[card.id] ?? null}
                onOpenDetails={onOpenDetails}
              />
            ),
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function ReservationsClient() {
  const user = useAppSelector((state: RootState) => state.auth.user);
  const [shows, setShows] = React.useState<ShowGroup[]>([]);
  const [teams, setTeams] = React.useState<TeamOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedShowId, setSelectedShowId] = React.useState("all");
  const [showFilterQuery, setShowFilterQuery] = React.useState("All Shows");
  const [isShowComboboxOpen, setIsShowComboboxOpen] = React.useState(false);
  const [selectedTeamId, setSelectedTeamId] = React.useState("all");
  const [teamFilterQuery, setTeamFilterQuery] = React.useState("All Teams");
  const [isTeamComboboxOpen, setIsTeamComboboxOpen] = React.useState(false);
  const [updatingCardIds, setUpdatingCardIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [approvalProgressLabels, setApprovalProgressLabels] = React.useState<
    Partial<Record<string, string>>
  >({});
  const [pendingMove, setPendingMove] = React.useState<PendingMove | null>(
    null,
  );
  const [isPendingMoveSubmitting, setIsPendingMoveSubmitting] =
    React.useState(false);
  const [pendingMoveProgressLabel, setPendingMoveProgressLabel] =
    React.useState<string | null>(null);
  const [activeDropColumn, setActiveDropColumn] =
    React.useState<KanbanStatus | null>(null);
  const [activeDragCardId, setActiveDragCardId] = React.useState<string | null>(
    null,
  );
  const [previewColumn, setPreviewColumn] = React.useState<KanbanStatus | null>(
    null,
  );
  const [rollbackPreview, setRollbackPreview] =
    React.useState<RollbackPreview | null>(null);
  const [rollbackGhost, setRollbackGhost] =
    React.useState<RollbackGhost | null>(null);
  const [selectedCardId, setSelectedCardId] = React.useState<string | null>(
    null,
  );
  const [portalCardId, setPortalCardId] = React.useState<string | null>(null);
  const [isPortalVisible, setIsPortalVisible] = React.useState(false);
  const [isPortalScrollReady, setIsPortalScrollReady] = React.useState(false);
  const [isImageExpanded, setIsImageExpanded] = React.useState(false);
  const [optimisticCardStatuses, setOptimisticCardStatuses] = React.useState<
    Partial<Record<string, KanbanStatus>>
  >({});
  const [columnOrders, setColumnOrders] = React.useState<
    Record<KanbanStatus, string[]>
  >({
    PENDING: [],
    CONFIRMED: [],
    REJECTED: [],
  });

  const rollbackTimeoutRef = React.useRef<number | null>(null);
  const portalTimeoutRef = React.useRef<number | null>(null);
  const portalScrollTimeoutRef = React.useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );
  const isSuperadmin = Boolean(user?.isSuperadmin);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  React.useEffect(() => {
    return () => {
      if (rollbackTimeoutRef.current !== null) {
        window.clearTimeout(rollbackTimeoutRef.current);
      }
      if (portalTimeoutRef.current !== null) {
        window.clearTimeout(portalTimeoutRef.current);
      }
      if (portalScrollTimeoutRef.current !== null) {
        window.clearTimeout(portalScrollTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (selectedCardId) {
      if (portalTimeoutRef.current !== null) {
        window.clearTimeout(portalTimeoutRef.current);
        portalTimeoutRef.current = null;
      }

      setPortalCardId(selectedCardId);
      setIsPortalScrollReady(false);
      const frameId = window.requestAnimationFrame(() => {
        setIsPortalVisible(true);
      });
      portalScrollTimeoutRef.current = window.setTimeout(() => {
        setIsPortalScrollReady(true);
        portalScrollTimeoutRef.current = null;
      }, PORTAL_SCROLL_DELAY_MS);

      return () => {
        window.cancelAnimationFrame(frameId);
        if (portalScrollTimeoutRef.current !== null) {
          window.clearTimeout(portalScrollTimeoutRef.current);
          portalScrollTimeoutRef.current = null;
        }
      };
    }

    setIsPortalVisible(false);
    setIsPortalScrollReady(false);

    if (portalCardId) {
      portalTimeoutRef.current = window.setTimeout(() => {
        setPortalCardId(null);
        portalTimeoutRef.current = null;
      }, PORTAL_TRANSITION_MS);
    }
  }, [portalCardId, selectedCardId]);

  React.useEffect(() => {
    if (!portalCardId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [portalCardId]);

  React.useEffect(() => {
    if (!selectedCardId) {
      setIsImageExpanded(false);
    }
  }, [selectedCardId]);

  React.useEffect(() => {
    if (!isPendingMoveSubmitting || !pendingMove) {
      setPendingMoveProgressLabel(null);
      return;
    }

    if (pendingMove.targetStatus === "CONFIRMED") {
      setPendingMoveProgressLabel(
        approvalProgressLabels[pendingMove.cardId] ??
          APPROVAL_PROGRESS_STEPS[0].label,
      );
      return;
    }

    setPendingMoveProgressLabel("Moving to rejected...");
  }, [
    approvalProgressLabels,
    isPendingMoveSubmitting,
    pendingMove,
  ]);

  React.useEffect(() => {
    const fetchReservations = async () => {
      try {
        const res = await fetch("/api/reservations");
        if (!res.ok) throw new Error("Failed to fetch reservations");

        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Unknown error");

        setShows(data.shows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchReservations();
  }, []);

  React.useEffect(() => {
    if (!isSuperadmin) {
      setSelectedTeamId("all");
      setTeamFilterQuery("All Teams");
      return;
    }

    let isMounted = true;

    const fetchTeams = async () => {
      try {
        const response = await fetch("/api/admin/access/teams");
        const data = (await response.json()) as {
          success?: boolean;
          error?: string;
          teams?: TeamOption[];
        };

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to load teams.");
        }

        if (!isMounted) return;
        setTeams(
          (data.teams ?? []).map((team) => ({
            team_id: team.team_id,
            name: team.name,
          })),
        );
      } catch (err) {
        if (!isMounted) return;
        toast.error(err instanceof Error ? err.message : "Failed to load teams.");
      }
    };

    void fetchTeams();

    return () => {
      isMounted = false;
    };
  }, [isSuperadmin]);

  const handleStageUpdate = React.useCallback(
    async (
      card: KanbanCard,
      reservationIds: string[],
      targetStatus: "CONFIRMED" | "CANCELLED",
    ) => {
      if (reservationIds.length === 0) return false;

      setUpdatingCardIds((prev) => {
        const next = new Set(prev);
        next.add(card.id);
        return next;
      });
      const clearProgressTimers: number[] = [];

      const clearApprovalProgress = () => {
        clearProgressTimers.forEach((timerId) => window.clearTimeout(timerId));
        setApprovalProgressLabels((prev) => {
          if (!(card.id in prev)) return prev;
          const next = { ...prev };
          delete next[card.id];
          return next;
        });
      };

      if (targetStatus === "CONFIRMED") {
        APPROVAL_PROGRESS_STEPS.forEach(({ delayMs, label }) => {
          const timerId = window.setTimeout(() => {
            setApprovalProgressLabels((prev) => ({
              ...prev,
              [card.id]: label,
            }));
          }, delayMs);
          clearProgressTimers.push(timerId);
        });
      }

      try {
        const endpoint =
          targetStatus === "CONFIRMED"
            ? "/api/reservations/verify"
            : "/api/reservations/reject";

        const results = await Promise.all(
          reservationIds.map(async (reservationId) => {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reservationId }),
            });

            let data: StageUpdateResponse | null = null;
            try {
              data = (await response.json()) as StageUpdateResponse;
            } catch {
              data = null;
            }

            const fallbackError =
              targetStatus === "CONFIRMED"
                ? "Failed to verify reservations"
                : "Failed to reject reservations";

            if (!response.ok || !data?.success) {
              throw new Error(getApiErrorMessage(data, fallbackError));
            }

            return data;
          }),
        );

        const paidAt = new Date().toISOString();
        setShows((prev) =>
          prev.map((show) => ({
            ...show,
            reservations: show.reservations.map((reservation) =>
              reservationIds.includes(reservation.reservation_id)
                ? {
                    ...reservation,
                    status: targetStatus,
                    payment: reservation.payment
                      ? {
                          ...reservation.payment,
                          status:
                            targetStatus === "CONFIRMED"
                              ? "PAID"
                              : reservation.payment.status === "PAID"
                                ? "REFUNDED"
                                : "FAILED",
                          paid_at:
                            targetStatus === "CONFIRMED"
                              ? paidAt
                              : reservation.payment.status === "PAID"
                                ? reservation.payment.paid_at
                                : null,
                        }
                      : reservation.payment,
                  }
                : reservation,
            ),
          })),
        );

        const actionLabel =
          targetStatus === "CONFIRMED" ? "approved" : "rejected";
        void results;
        toast.success(
          reservationIds.length === 1
            ? `Reservation ${actionLabel} successfully.`
            : `${reservationIds.length} reservations ${actionLabel} successfully.`,
        );

        return true;
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : targetStatus === "CONFIRMED"
              ? "Verification failed"
              : "Rejection failed",
        );
        return false;
      } finally {
        clearApprovalProgress();
        setUpdatingCardIds((prev) => {
          const next = new Set(prev);
          next.delete(card.id);
          return next;
        });
      }
    },
    [],
  );

  const showFilterOptions = React.useMemo(
    () =>
      [...shows]
        .sort((a, b) => a.showName.localeCompare(b.showName))
        .map((show) => ({ id: show.showId, label: show.showName })),
    [shows],
  );

  const filteredShowFilterOptions = React.useMemo(() => {
    const query = showFilterQuery.trim().toLowerCase();
    if (!query || query === "all shows") return showFilterOptions;
    return showFilterOptions.filter((show) =>
      show.label.toLowerCase().includes(query),
    );
  }, [showFilterOptions, showFilterQuery]);

  const teamFilterOptions = React.useMemo(
    () =>
      [...teams]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((team) => ({ id: team.team_id, label: team.name })),
    [teams],
  );

  const filteredTeamFilterOptions = React.useMemo(() => {
    const query = teamFilterQuery.trim().toLowerCase();
    if (!query || query === "all teams") return teamFilterOptions;
    return teamFilterOptions.filter((team) =>
      team.label.toLowerCase().includes(query),
    );
  }, [teamFilterOptions, teamFilterQuery]);

  React.useEffect(() => {
    if (
      selectedShowId !== "all" &&
      !showFilterOptions.some((show) => show.id === selectedShowId)
    ) {
      setSelectedShowId("all");
      setShowFilterQuery("All Shows");
    }
  }, [selectedShowId, showFilterOptions]);

  React.useEffect(() => {
    if (!isSuperadmin) return;

    if (
      selectedTeamId !== "all" &&
      !teamFilterOptions.some((team) => team.id === selectedTeamId)
    ) {
      setSelectedTeamId("all");
      setTeamFilterQuery("All Teams");
    }
  }, [isSuperadmin, selectedTeamId, teamFilterOptions]);

  const filteredShows = React.useMemo(() => {
    const teamScopedShows =
      selectedTeamId === "all"
        ? shows
        : shows.filter((show) => show.teamId === selectedTeamId);

    const showScopedShows =
      selectedShowId === "all"
        ? teamScopedShows
        : teamScopedShows.filter((show) => show.showId === selectedShowId);

    if (!searchQuery.trim()) return showScopedShows;

    const q = searchQuery.toLowerCase();

    return showScopedShows
      .map((show) => ({
        ...show,
        reservations: show.reservations.filter(
          (reservation) =>
            reservation.first_name.toLowerCase().includes(q) ||
            reservation.last_name.toLowerCase().includes(q) ||
            reservation.email.toLowerCase().includes(q) ||
            reservation.phone_number.toLowerCase().includes(q) ||
            reservation.seatAssignments.some((seatAssignment) =>
              seatAssignment.seat.seat_number.toLowerCase().includes(q),
            ) ||
            reservation.reservation_id.toLowerCase().includes(q) ||
            reservation.reservation_number.toLowerCase().includes(q) ||
            show.showName.toLowerCase().includes(q) ||
            show.venue.toLowerCase().includes(q),
        ),
      }))
      .filter((show) => show.reservations.length > 0);
  }, [searchQuery, selectedShowId, selectedTeamId, shows]);

  const kanbanCards = React.useMemo(() => {
    const cards: KanbanCard[] = [];

    for (const show of filteredShows) {
      const rows = buildUserRows(show.reservations);

      for (const row of rows) {
        cards.push({
          id: `${show.showId}::${row.userId}`,
          status: getRowStatus(row),
          showId: show.showId,
          showName: show.showName,
          showVenue: show.venue,
          row,
        });
      }
    }

    return cards;
  }, [filteredShows]);

  const effectiveKanbanCards = React.useMemo(
    () =>
      kanbanCards.map((card) => ({
        ...card,
        status: optimisticCardStatuses[card.id] ?? card.status,
      })),
    [kanbanCards, optimisticCardStatuses],
  );

  const cardsByColumn = React.useMemo(() => {
    return {
      PENDING: effectiveKanbanCards.filter((card) => card.status === "PENDING"),
      CONFIRMED: effectiveKanbanCards.filter(
        (card) => card.status === "CONFIRMED",
      ),
      REJECTED: effectiveKanbanCards.filter((card) => card.status === "REJECTED"),
    } satisfies Record<KanbanStatus, KanbanCard[]>;
  }, [effectiveKanbanCards]);

  const cardById = React.useMemo(() => {
    return new Map(effectiveKanbanCards.map((card) => [card.id, card]));
  }, [effectiveKanbanCards]);

  React.useEffect(() => {
    setColumnOrders((prev) => {
      const next = { ...prev };
      (Object.keys(cardsByColumn) as KanbanStatus[]).forEach((status) => {
        const currentIds = cardsByColumn[status].map((card) => card.id);
        const previousIds = prev[status].filter((id) =>
          currentIds.includes(id),
        );
        const appendedIds = currentIds.filter(
          (id) => !previousIds.includes(id),
        );
        next[status] = [...previousIds, ...appendedIds];
      });
      return next;
    });
  }, [cardsByColumn]);

  const orderedCardsByColumn = React.useMemo(() => {
    const ordered = {} as Record<KanbanStatus, KanbanCard[]>;

    (Object.keys(cardsByColumn) as KanbanStatus[]).forEach((status) => {
      const lookup = new Map(
        cardsByColumn[status].map((card) => [card.id, card]),
      );
      ordered[status] = columnOrders[status]
        .map((id) => lookup.get(id))
        .filter((card): card is KanbanCard => !!card);
    });

    return ordered;
  }, [cardsByColumn, columnOrders]);

  const activeDragCard = activeDragCardId
    ? (cardById.get(activeDragCardId) ?? null)
    : null;
  const pendingMoveCard = pendingMove
    ? (cardById.get(pendingMove.cardId) ?? null)
    : null;
  const selectedCard = portalCardId
    ? (cardById.get(portalCardId) ?? null)
    : null;
  const rollbackPreviewCard = rollbackPreview
    ? (cardById.get(rollbackPreview.cardId) ?? null)
    : null;
  const previewCardSource = activeDragCard ?? pendingMoveCard;

  React.useLayoutEffect(() => {
    if (!rollbackPreview || !rollbackPreviewCard || !rollbackPreview.fromRect) {
      return;
    }

    const fromRect = rollbackPreview.fromRect;
    const frameId = window.requestAnimationFrame(() => {
      const anchor = document.querySelector(
        `[data-rollback-anchor="${rollbackPreview.cardId}"]`,
      );
      if (!(anchor instanceof HTMLElement)) {
        setRollbackPreview(null);
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const toRect: RollbackRect = {
        top: anchorRect.top,
        left: anchorRect.left,
        width: anchorRect.width,
        height: anchorRect.height,
      };

      setRollbackGhost({
        card: rollbackPreviewCard,
        fromRect,
        toRect,
        isAnimating: false,
      });

      window.requestAnimationFrame(() => {
        setRollbackGhost((prev) =>
          prev ? { ...prev, isAnimating: true } : prev,
        );
      });

      rollbackTimeoutRef.current = window.setTimeout(() => {
        setRollbackGhost(null);
        setRollbackPreview(null);
        rollbackTimeoutRef.current = null;
      }, ROLLBACK_PREVIEW_MS);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [rollbackPreview, rollbackPreviewCard]);

  const displayCardsByColumn = React.useMemo(() => {
    const display = {
      PENDING: [...orderedCardsByColumn.PENDING],
      CONFIRMED: [...orderedCardsByColumn.CONFIRMED],
      REJECTED: [...orderedCardsByColumn.REJECTED],
    } satisfies Record<KanbanStatus, DisplayCard[]>;

    if (
      previewCardSource &&
      previewColumn &&
      previewColumn !== previewCardSource.status
    ) {
      display[previewCardSource.status] = display[
        previewCardSource.status
      ].filter((card) => card.id !== previewCardSource.id);

      const previewCard: DisplayCard = {
        ...previewCardSource,
        id: `preview:${previewCardSource.id}`,
        status: previewColumn,
        isPreview: true,
      };

      display[previewColumn] = [previewCard, ...display[previewColumn]];
      return display;
    }

    if (rollbackPreview && rollbackPreviewCard) {
      const sourceCards = [...display[rollbackPreview.sourceStatus]];
      const sourceIndex = sourceCards.findIndex(
        (card) => card.id === rollbackPreview.cardId,
      );

      if (sourceIndex !== -1) {
        sourceCards.splice(sourceIndex, 1);

        const rollbackCard: DisplayCard = {
          ...rollbackPreviewCard,
          id: `rollback:${rollbackPreviewCard.id}`,
          status: rollbackPreview.sourceStatus,
          isPreview: true,
        };

        sourceCards.splice(sourceIndex, 0, rollbackCard);
        display[rollbackPreview.sourceStatus] = sourceCards;
      }
    }

    return display;
  }, [
    orderedCardsByColumn,
    previewCardSource,
    previewColumn,
    rollbackPreview,
    rollbackPreviewCard,
  ]);

  const totalReservations = effectiveKanbanCards.length;
  const pendingCount = orderedCardsByColumn.PENDING.length;
  const confirmedCount = orderedCardsByColumn.CONFIRMED.length;
  const pendingTotalAmount = orderedCardsByColumn.PENDING.reduce(
    (sum, card) => sum + card.row.totalAmount,
    0,
  );
  const confirmedTotalAmount = orderedCardsByColumn.CONFIRMED.reduce(
    (sum, card) => sum + card.row.totalAmount,
    0,
  );
  const overallTotalAmount = effectiveKanbanCards.reduce(
    (sum, card) => sum + card.row.totalAmount,
    0,
  );
  const primaryPayment =
    selectedCard?.row.reservations.find(
      (reservation) => reservation.payment?.screenshot_url,
    )?.payment ??
    selectedCard?.row.reservations.find((reservation) => reservation.payment)
      ?.payment ??
    null;
  const selectedPaymentDisplay = getAdminPaymentDisplay(primaryPayment?.method);

  const resolveDropTarget = React.useCallback(
    (overId: string): KanbanStatus | null => {
      if (overId.startsWith("column:")) {
        const key = overId.replace("column:", "") as KanbanStatus;
        return key;
      }

      const overCard = cardById.get(overId);
      return overCard?.status ?? null;
    },
    [cardById],
  );

  const pendingMoveLabel =
    pendingMove?.targetStatus === "CONFIRMED" ? "Confirmed" : "Rejected";
  const pendingMoveButtonClassName =
    pendingMove?.targetStatus === "CONFIRMED"
      ? "bg-amber-400 text-white hover:bg-amber-500"
      : undefined;
  const canConfirmSelectedCard = selectedCard?.status === "PENDING";
  const selectedCardIsUpdating = selectedCard
    ? updatingCardIds.has(selectedCard.id)
    : false;
  const selectedCardProgressLabel = selectedCard
    ? approvalProgressLabels[selectedCard.id] ?? null
    : null;
  const selectedCardStatusBadgeClassName =
    selectedCard?.status === "CONFIRMED"
      ? "bg-emerald-100 text-emerald-700"
      : selectedCard?.status === "REJECTED"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";

  const clearRollbackPreview = React.useCallback(() => {
    if (rollbackTimeoutRef.current !== null) {
      window.clearTimeout(rollbackTimeoutRef.current);
      rollbackTimeoutRef.current = null;
    }
    setRollbackGhost(null);
    setRollbackPreview(null);
  }, []);

  const startRollbackPreview = React.useCallback(
    (card: KanbanCard, fromRect: RollbackRect | null) => {
      if (rollbackTimeoutRef.current !== null) {
        window.clearTimeout(rollbackTimeoutRef.current);
        rollbackTimeoutRef.current = null;
      }

      setRollbackGhost(null);
      setRollbackPreview({
        cardId: card.id,
        sourceStatus: card.status,
        fromRect,
      });
    },
    [],
  );

  const handleCancelPendingMove = React.useCallback(() => {
    if (isPendingMoveSubmitting) {
      return;
    }

    if (pendingMove?.source === "drag" && pendingMoveCard) {
      const previewElement = document.querySelector(
        `[data-preview-id="preview:${pendingMoveCard.id}"]`,
      );
      const fromRect =
        previewElement instanceof HTMLElement
          ? {
              top: previewElement.getBoundingClientRect().top,
              left: previewElement.getBoundingClientRect().left,
              width: previewElement.getBoundingClientRect().width,
              height: previewElement.getBoundingClientRect().height,
            }
          : null;

      startRollbackPreview(pendingMoveCard, fromRect);
    } else {
      clearRollbackPreview();
    }

    setPendingMove(null);
    setPreviewColumn(null);
  }, [
    clearRollbackPreview,
    isPendingMoveSubmitting,
    pendingMove?.source,
    pendingMoveCard,
    startRollbackPreview,
  ]);

  const handleConfirmStageMove = React.useCallback(async () => {
    if (!pendingMove) return;

    const move = pendingMove;
    const targetCard = cardById.get(move.cardId);
    if (!targetCard) {
      setIsPendingMoveSubmitting(false);
      setPendingMoveProgressLabel(null);
      setPendingMove(null);
      setPreviewColumn(null);
      clearRollbackPreview();
      return;
    }

    setIsPendingMoveSubmitting(true);
    setPreviewColumn(null);
    clearRollbackPreview();
    setOptimisticCardStatuses((prev) => ({
      ...prev,
      [targetCard.id]: move.targetStatus,
    }));
    setColumnOrders((prev) => {
      const next = {
        PENDING: prev.PENDING.filter((id) => id !== targetCard.id),
        CONFIRMED: prev.CONFIRMED.filter((id) => id !== targetCard.id),
        REJECTED: prev.REJECTED.filter((id) => id !== targetCard.id),
      };

      const targetIds = [...next[move.targetStatus]];
      targetIds.unshift(targetCard.id);
      next[move.targetStatus] = targetIds;

      return next;
    });

    const didSucceed =
      move.targetStatus === "CONFIRMED"
        ? await handleStageUpdate(
            targetCard,
            targetCard.row.pendingReservationIds,
            "CONFIRMED",
          )
        : await handleStageUpdate(
            targetCard,
            targetCard.row.reservations.map(
              (reservation) => reservation.reservation_id,
            ),
            "CANCELLED",
          );

    if (didSucceed) {
      setOptimisticCardStatuses((prev) => {
        const next = { ...prev };
        delete next[targetCard.id];
        return next;
      });
      setPendingMove(null);
      setPendingMoveProgressLabel(null);
      setIsPendingMoveSubmitting(false);
      return;
    }

    setOptimisticCardStatuses((prev) => {
      const next = { ...prev };
      delete next[targetCard.id];
      return next;
    });
    setColumnOrders((prev) => {
      const next = {
        PENDING: prev.PENDING.filter((id) => id !== targetCard.id),
        CONFIRMED: prev.CONFIRMED.filter((id) => id !== targetCard.id),
        REJECTED: prev.REJECTED.filter((id) => id !== targetCard.id),
      };

      const sourceIds = [...next[targetCard.status]];
      sourceIds.unshift(targetCard.id);
      next[targetCard.status] = sourceIds;

      return next;
    });
    setPendingMoveProgressLabel(null);
    setIsPendingMoveSubmitting(false);
  }, [
    cardById,
    clearRollbackPreview,
    handleStageUpdate,
    pendingMove,
  ]);

  const onDragEnd = React.useCallback(
    async (event: DragEndEvent) => {
      setActiveDropColumn(null);

      const activeId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : null;
      if (!overId) return;

      const activeCard = cardById.get(activeId);
      if (!activeCard) return;

      const targetStatus = resolveDropTarget(overId);
      if (!targetStatus) return;

      if (targetStatus === activeCard.status) {
        const fromIds = columnOrders[targetStatus];
        const oldIndex = fromIds.indexOf(activeId);
        const newIndex = fromIds.indexOf(overId);

        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          setColumnOrders((prev) => ({
            ...prev,
            [targetStatus]: arrayMove(prev[targetStatus], oldIndex, newIndex),
          }));
        }
        setPreviewColumn(null);
        clearRollbackPreview();
        return;
      }

      if (activeCard.status === "PENDING" && targetStatus === "CONFIRMED") {
        setPendingMove({
          cardId: activeCard.id,
          targetStatus: "CONFIRMED",
          source: "drag",
        });
        return;
      }

      if (activeCard.status === "PENDING" && targetStatus === "REJECTED") {
        setPendingMove({
          cardId: activeCard.id,
          targetStatus: "REJECTED",
          source: "drag",
        });
        return;
      }

      if (activeCard.status === "CONFIRMED" && targetStatus === "REJECTED") {
        toast.warning("Confirmed payments cannot be moved to Rejected.");
        return;
      }

      if (activeCard.status === "REJECTED" && targetStatus === "CONFIRMED") {
        toast.warning("Rejected payments cannot be moved to Confirmed.");
        return;
      }

      toast.warning(
        "Allowed moves: Pending to Confirmed, or Pending to Rejected.",
      );
    },
    [cardById, clearRollbackPreview, columnOrders, resolveDropTarget],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <XCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <>
      <Dialog open={!!pendingMove} onOpenChange={() => undefined}>
        <DialogContent
          showCloseButton={false}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle>Warning: stage change</DialogTitle>
            <DialogDescription>
              {pendingMoveCard ? (
                pendingMove?.targetStatus === "CONFIRMED" ? (
                  "We're accepting this payment. Be sure you have confirmed that the payment was received before continuing."
                ) : (
                  <>
                    Move {pendingMoveCard.row.user.first_name}{" "}
                    {pendingMoveCard.row.user.last_name} for{" "}
                    {pendingMoveCard.showName} to {pendingMoveLabel}? This action
                    cannot be undone or changed.
                  </>
                )
              ) : (
                "Confirm this reservation stage change. This action cannot be undone or changed."
              )}
            </DialogDescription>
            {isPendingMoveSubmitting ? (
              <div className="flex items-center gap-2 rounded-md border border-sidebar-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{pendingMoveProgressLabel ?? "Updating reservation..."}</span>
              </div>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelPendingMove}
              disabled={isPendingMoveSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={
                pendingMove?.targetStatus === "CONFIRMED"
                  ? "default"
                  : "destructive"
              }
              className={pendingMoveButtonClassName}
              onClick={() => {
                void handleConfirmStageMove();
              }}
              disabled={isPendingMoveSubmitting}
            >
              {isPendingMoveSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {pendingMoveProgressLabel ?? "Updating reservation..."}
                </>
              ) : (
                `Move to ${pendingMoveLabel}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCard ? (
        <div
          className={`fixed inset-0 z-[80] bg-background transition-opacity duration-200 ${isPortalVisible ? "opacity-100" : "opacity-0"}`}
        >
          <div
            className={`flex h-full min-h-0 flex-col transition-[transform,opacity] duration-300 ease-out ${isPortalVisible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-sidebar-border/70 px-6 py-4 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                {canConfirmSelectedCard ? (
                  <>
                    <Button
                      type="button"
                      className="h-9 bg-emerald-600 px-4 text-xs text-white hover:bg-emerald-700 sm:h-10 sm:text-sm"
                      disabled={selectedCardIsUpdating}
                      onClick={() => {
                        setPendingMove({
                          cardId: selectedCard.id,
                          targetStatus: "CONFIRMED",
                          source: "portal",
                        });
                      }}
                    >
                      {selectedCardIsUpdating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {selectedCardProgressLabel ?? "Approving payment..."}
                        </>
                      ) : (
                        "Accept"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-9 px-4 text-xs sm:h-10 sm:text-sm"
                      disabled={selectedCardIsUpdating}
                      onClick={() => {
                        setPendingMove({
                          cardId: selectedCard.id,
                          targetStatus: "REJECTED",
                          source: "portal",
                        });
                      }}
                    >
                      {selectedCardIsUpdating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating reservation...
                        </>
                      ) : (
                        "Reject"
                      )}
                    </Button>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelectedCardId(null)}
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-black px-3 text-xs font-medium text-white shadow-sm sm:h-10 sm:text-sm"
              >
                Close
              </button>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)]">
              <div
                className={`min-h-0 border-b border-sidebar-border/70 px-6 py-5 dark:border-white/10 lg:border-b-0 lg:border-r ${isPortalScrollReady ? "overflow-y-auto" : "overflow-hidden"}`}
              >
                <div className="mx-auto max-w-2xl space-y-8">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      Payment Record
                    </p>
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight sm:text-2xl">
                        {selectedCard.row.user.first_name}{" "}
                        {selectedCard.row.user.last_name}
                      </h2>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {selectedCard.showName}
                      </p>
                    </div>
                  </div>

                  <section className="space-y-3 border-t border-sidebar-border/70 pt-6 dark:border-white/10">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
                    <Mail className="h-3.5 w-3.5" />
                    Customer Details
                  </div>
                  <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                        Email
                      </p>
                      <p className="break-all text-xs font-medium sm:text-sm">
                        {selectedCard.row.user.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                        Phone
                      </p>
                      <p className="text-xs font-medium sm:text-sm">
                        {selectedCard.row.user.phone_number}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                        Address
                      </p>
                      <p className="text-xs font-medium sm:text-sm">
                        {selectedCard.row.user.address}
                      </p>
                    </div>
                  </div>
                  </section>

                  <section className="space-y-4 border-t border-sidebar-border/70 pt-6 dark:border-white/10">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
                    <Ticket className="h-3.5 w-3.5" />
                    Reservation Details
                  </div>

                  <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                        Show
                      </p>
                      <p className="text-xs font-medium sm:text-sm">{selectedCard.showName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                        Venue
                      </p>
                      <p className="text-xs font-medium sm:text-sm">{selectedCard.showVenue}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                        Reservation No.
                      </p>
                      <p className="text-xs font-medium sm:text-sm">
                        {selectedCard.row.reservationNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                        Total Amount
                      </p>
                      <p className="text-lg font-semibold sm:text-xl">
                        {formatCurrency(selectedCard.row.totalAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                        Seats
                      </p>
                      <p className="text-xs font-medium sm:text-sm">
                        {selectedCard.row.seatNumbers.join(", ")}
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-sidebar-border/70 border-t border-sidebar-border/70 dark:divide-white/10 dark:border-white/10">
                    {selectedCard.row.reservations.map((reservation) => (
                      <div
                        key={reservation.reservation_id}
                        className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
                            <span className="inline-flex items-center gap-1.5">
                              <Ticket className="h-3.5 w-3.5" />
                              Reservation No. {reservation.reservation_number}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Armchair className="h-3.5 w-3.5" />
                              {reservation.seatAssignments[0]?.set.seatCategory.category_name ??
                                "N/A"}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarCheck className="h-3.5 w-3.5" />
                              {formatDate(
                                reservation.seatAssignments[0]?.sched.sched_date ?? "",
                              )}
                              ,{" "}
                              {formatTimeRange(
                                reservation.seatAssignments[0]?.sched.sched_start_time ?? "",
                                reservation.seatAssignments[0]?.sched.sched_end_time ?? "",
                              )}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {reservation.seatAssignments.map((seatAssignment) => (
                              <span
                                key={seatAssignment.seat_assignment_id}
                                className="inline-flex items-center gap-1 rounded-md border border-sidebar-border/70 bg-muted/30 px-2 py-1 text-[11px] text-foreground"
                              >
                                <Ticket className="h-3 w-3" />
                                Seat {seatAssignment.seat.seat_number}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                            Amount
                          </p>
                          <p className="text-xs font-semibold sm:text-sm">
                            {formatCurrency(
                              reservation.payment?.amount ??
                                reservation.seatAssignments[0]?.set.seatCategory
                                  .price,
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  </section>
                </div>
              </div>

              <div className="min-h-0 bg-muted/20">
                <div className="flex h-full min-h-0 flex-col">
                  <div
                    className={`flex-1 ${isPortalScrollReady ? "overflow-y-auto" : "overflow-hidden"}`}
                  >
                    <div className="flex min-h-full items-center justify-center p-6 lg:p-10 lg:pb-32">
                      <div className="w-full max-w-4xl space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                              {selectedPaymentDisplay.panelTitle}
                            </p>
                            {selectedPaymentDisplay.cardTagLabel ? (
                              <span className="inline-flex w-fit items-center rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700 sm:text-xs">
                                {selectedPaymentDisplay.cardTagLabel}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {selectedCard.status !== "PENDING" ? (
                              <span
                                className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] sm:text-xs ${selectedCardStatusBadgeClassName}`}
                              >
                                {selectedCard.status === "CONFIRMED"
                                  ? "Confirmed"
                                  : "Rejected"}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden bg-background">
                          {primaryPayment?.screenshot_url ? (
                            <>
                              <img
                                src={primaryPayment.screenshot_url}
                                alt={selectedPaymentDisplay.imageAlt(
                                  `${selectedCard.row.user.first_name} ${selectedCard.row.user.last_name}`,
                                )}
                                className="max-h-[85vh] w-full cursor-zoom-in object-contain"
                                onClick={() => setIsImageExpanded(true)}
                              />
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-muted-foreground">
                              <CreditCard className="h-8 w-8" />
                              <p className="text-sm">{selectedPaymentDisplay.emptyStateLabel}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedCard && primaryPayment?.screenshot_url && isImageExpanded ? (
        <div
          className="fixed inset-0 z-[95] bg-black/90"
          onClick={() => setIsImageExpanded(false)}
        >
          <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between lg:justify-end lg:gap-2">
            <a
              href={primaryPayment.screenshot_url}
              download
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-10 w-10 items-center justify-center text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label={selectedPaymentDisplay.downloadLabel}
            >
              <ArrowDownToLine className="h-4.5 w-4.5" />
            </a>
            <button
              type="button"
              onClick={() => setIsImageExpanded(false)}
              className="inline-flex h-10 items-center justify-center rounded-md border border-white/25 bg-black/45 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:border-white/40 hover:bg-black/65 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
            <img
              src={primaryPayment.screenshot_url}
              alt={selectedPaymentDisplay.expandedImageAlt(
                `${selectedCard.row.user.first_name} ${selectedCard.row.user.last_name}`,
              )}
              className="max-h-full max-w-full object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/30">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">
                    Pending Reservations
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Total Amount
                </p>
                <p className="text-sm font-semibold sm:text-base">
                  {formatCurrency(pendingTotalAmount)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-900/30">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{confirmedCount}</p>
                  <p className="text-xs text-muted-foreground">
                    Confirmed Reservations
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Total Amount
                </p>
                <p className="text-sm font-semibold sm:text-base">
                  {formatCurrency(confirmedTotalAmount)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
                  <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalReservations}</p>
                  <p className="text-xs text-muted-foreground">
                    Total Customers Reserved
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Overall Amount
                </p>
                <p className="text-sm font-semibold sm:text-base">
                  {formatCurrency(overallTotalAmount)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div
          className={`grid gap-3 ${
            isSuperadmin
              ? "md:grid-cols-[minmax(0,1fr)_220px_220px]"
              : "md:grid-cols-[minmax(0,1fr)_240px]"
          }`}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, seat number, reservation ID, or show..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-sidebar-border/70 dark:border-white/20 bg-background py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {isSuperadmin ? (
            <Combobox
              open={isTeamComboboxOpen}
              onOpenChange={setIsTeamComboboxOpen}
              openOnInputClick
              autoHighlight
              value={selectedTeamId}
              onValueChange={(value) => {
                const nextValue = value ?? "all";
                setSelectedTeamId(nextValue);
                const selectedTeam = teamFilterOptions.find(
                  (team) => team.id === nextValue,
                );
                setTeamFilterQuery(selectedTeam?.label ?? "All Teams");
                setIsTeamComboboxOpen(false);
              }}
            >
              <ComboboxInput
                aria-label="Filter teams"
                placeholder="All Teams"
                value={teamFilterQuery}
                onFocus={() => setIsTeamComboboxOpen(true)}
                onChange={(event) => {
                  setTeamFilterQuery(event.target.value);
                  setSelectedTeamId("all");
                  setIsTeamComboboxOpen(true);
                }}
                className="w-full border-sidebar-border/70 dark:border-white/20 bg-background"
              />
              <ComboboxContent>
                <ComboboxList className="max-h-72">
                  <ComboboxItem value="all">All Teams</ComboboxItem>
                  {filteredTeamFilterOptions.length > 0 ? (
                    filteredTeamFilterOptions.map((team) => (
                      <ComboboxItem key={team.id} value={team.id}>
                        {team.label}
                      </ComboboxItem>
                    ))
                  ) : (
                    <ComboboxEmpty>No teams found.</ComboboxEmpty>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          ) : null}

          <Combobox
            open={isShowComboboxOpen}
            onOpenChange={setIsShowComboboxOpen}
            openOnInputClick
            autoHighlight
            value={selectedShowId}
            onValueChange={(value) => {
              const nextValue = value ?? "all";
              setSelectedShowId(nextValue);
              const selectedShow = showFilterOptions.find(
                (show) => show.id === nextValue,
              );
              setShowFilterQuery(selectedShow?.label ?? "All Shows");
              setIsShowComboboxOpen(false);
            }}
          >
            <ComboboxInput
              aria-label="Filter shows"
              placeholder="All Shows"
              value={showFilterQuery}
              onFocus={() => setIsShowComboboxOpen(true)}
              onChange={(event) => {
                setShowFilterQuery(event.target.value);
                setSelectedShowId("all");
                setIsShowComboboxOpen(true);
              }}
              className="w-full border-sidebar-border/70 dark:border-white/20 bg-background"
            />
            <ComboboxContent>
              <ComboboxList className="max-h-72">
                <ComboboxItem value="all">All Shows</ComboboxItem>
                {filteredShowFilterOptions.length > 0 ? (
                  filteredShowFilterOptions.map((show) => (
                    <ComboboxItem key={show.id} value={show.id}>
                      {show.label}
                    </ComboboxItem>
                  ))
                ) : (
                  <ComboboxEmpty>No shows found.</ComboboxEmpty>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        {kanbanCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <CreditCard className="h-10 w-10" />
            <p className="text-sm">
              {searchInput.trim()
                ? "No reservations match your search."
                : "No reservations found."}
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragOver={(event) => {
              const overId = event.over ? String(event.over.id) : null;
              if (!overId) {
                setActiveDropColumn((prev) => (prev === null ? prev : null));
                setPreviewColumn(null);
                return;
              }

              const nextColumn = resolveDropTarget(overId);
              setActiveDropColumn((prev) =>
                prev === nextColumn ? prev : nextColumn,
              );

              const activeId = String(event.active.id);
              const activeCard = cardById.get(activeId);
              const shouldPreview =
                !!activeCard &&
                !!nextColumn &&
                activeCard.status === "PENDING" &&
                nextColumn !== activeCard.status &&
                (nextColumn === "CONFIRMED" || nextColumn === "REJECTED");

              setPreviewColumn(shouldPreview ? nextColumn : null);
            }}
            onDragStart={(event: DragStartEvent) => {
              clearRollbackPreview();
              setActiveDragCardId(String(event.active.id));
              setPreviewColumn(null);
            }}
            onDragEnd={(event) => {
              void onDragEnd(event);
              setActiveDragCardId(null);
            }}
            onDragCancel={() => {
              setActiveDropColumn(null);
              setActiveDragCardId(null);
              setPreviewColumn(null);
              clearRollbackPreview();
            }}
          >
            <div className="grid gap-4 xl:grid-cols-3">
              {COLUMNS.map((column) => (
                <KanbanColumn
                  key={column.key}
                  status={column.key}
                  title={column.title}
                  icon={column.icon}
                  stageClassName={column.stageClassName}
                  stageCountClassName={column.stageCountClassName}
                  stageSurfaceClassName={column.stageSurfaceClassName}
                  cards={displayCardsByColumn[column.key]}
                  isActiveDrop={activeDropColumn === column.key}
                  updatingCardIds={updatingCardIds}
                  progressLabelsByCardId={approvalProgressLabels}
                  onOpenDetails={(card) => setSelectedCardId(card.id)}
                />
              ))}
            </div>
            <DragOverlay>
              {activeDragCard ? (
                <Card className="border-sidebar-border/70 dark:border-white/20 shadow-lg">
                  <CardContent className="space-y-2 p-4 pr-10">
                    <p className="text-base font-bold leading-tight">
                      {activeDragCard.showName}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {activeDragCard.row.user.first_name}{" "}
                      {activeDragCard.row.user.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activeDragCard.row.user.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activeDragCard.row.seatNumbers.length} seat
                      {activeDragCard.row.seatNumbers.length !== 1
                        ? "s"
                        : ""} - {formatCurrency(activeDragCard.row.totalAmount)}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
            {rollbackGhost ? (
              <div
                className="pointer-events-none fixed z-[60]"
                style={{
                  top: rollbackGhost.fromRect.top,
                  left: rollbackGhost.fromRect.left,
                  width: rollbackGhost.fromRect.width,
                  transform: rollbackGhost.isAnimating
                    ? `translate(${rollbackGhost.toRect.left - rollbackGhost.fromRect.left}px, ${rollbackGhost.toRect.top - rollbackGhost.fromRect.top}px)`
                    : "translate(0px, 0px)",
                  transition: `transform ${ROLLBACK_PREVIEW_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                }}
              >
                <Card className="border-sidebar-border/70 dark:border-white/20 shadow-lg">
                  <CardContent className="space-y-2 p-4 pr-10">
                    <p className="text-base font-bold leading-tight">
                      {rollbackGhost.card.showName}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {rollbackGhost.card.row.user.first_name}{" "}
                      {rollbackGhost.card.row.user.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {rollbackGhost.card.row.user.email}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {rollbackGhost.card.row.seatNumbers.length} seat
                      {rollbackGhost.card.row.seatNumbers.length !== 1
                        ? "s"
                        : ""}{" "}
                      - {formatCurrency(rollbackGhost.card.row.totalAmount)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </DndContext>
        )}
      </div>
    </>
  );
}




