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
import { AlertTriangle, CheckCircle2, Clock, CreditCard, GripVertical, Loader2, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";

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
  guest_id: string;
  first_name: string;
  last_name: string;
  address: string;
  email: string;
  phone_number: string;
  status: string;
  createdAt: string;
  payment: PaymentData | null;
  seatAssignment: {
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
  };
};

type ShowGroup = {
  showId: string;
  showName: string;
  venue: string;
  showImageKey: string | null;
  reservations: ReservationData[];
};

type UserReservationRow = {
  userId: string;
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
  showName: string;
  row: UserReservationRow;
};

type DisplayCard = KanbanCard & {
  isPreview?: boolean;
};

type PendingMove = {
  cardId: string;
  targetStatus: "CONFIRMED" | "REJECTED";
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

const formatCurrency = (value: string | number) => {
  const parsed = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(parsed);
};

const getRowStatus = (row: UserReservationRow): KanbanStatus => {
  if (row.pendingReservationIds.length > 0) return "PENDING";
  if (row.reservations.every((reservation) => reservation.status === "CONFIRMED")) return "CONFIRMED";
  return "REJECTED";
};

const buildUserRows = (reservations: ReservationData[]): UserReservationRow[] => {
  const map = new Map<string, UserReservationRow>();

  for (const reservation of reservations) {
    const key = `${reservation.email.toLowerCase()}::${reservation.phone_number}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        userId: key,
        user: {
          first_name: reservation.first_name,
          last_name: reservation.last_name,
          email: reservation.email,
          phone_number: reservation.phone_number,
          address: reservation.address,
        },
        reservations: [reservation],
        seatNumbers: [reservation.seatAssignment.seat.seat_number],
        pendingReservationIds: reservation.status === "PENDING" ? [reservation.reservation_id] : [],
        latestCreatedAt: reservation.createdAt,
        totalAmount: reservation.payment?.amount ? parseFloat(reservation.payment.amount) : 0,
      });
      continue;
    }

    existing.reservations.push(reservation);
    existing.seatNumbers.push(reservation.seatAssignment.seat.seat_number);

    if (reservation.status === "PENDING") {
      existing.pendingReservationIds.push(reservation.reservation_id);
    }

    if (new Date(reservation.createdAt).getTime() > new Date(existing.latestCreatedAt).getTime()) {
      existing.latestCreatedAt = reservation.createdAt;
    }

    if (reservation.payment?.amount) {
      existing.totalAmount += parseFloat(reservation.payment.amount);
    }
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      seatNumbers: Array.from(new Set(row.seatNumbers)).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    }))
    .sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime());
};

type SortableCardProps = {
  card: KanbanCard;
  isVerifying: boolean;
};

function SortableCard({ card, isVerifying }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
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
      <CardContent className={`relative space-y-2 p-4 pr-10 ${isDragging ? "opacity-0" : ""}`}>
        <button
          type="button"
          aria-label="Drag reservation card"
          className="absolute right-3 top-3 inline-flex h-6 w-6 touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          disabled={isVerifying}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <p className="text-base font-bold leading-tight">{card.showName}</p>
        <p className="text-sm font-medium text-foreground">
          {card.row.user.first_name} {card.row.user.last_name}
        </p>
        <p className="text-sm text-muted-foreground">{card.row.user.email}</p>
        <p className="text-sm text-muted-foreground">
          {card.row.seatNumbers.length} seat{card.row.seatNumbers.length !== 1 ? "s" : ""} - {formatCurrency(card.row.totalAmount)}
        </p>
        {isVerifying && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Updating status...
          </div>
        )}
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
  return (
    <Card
      data-preview-id={previewId}
      data-rollback-anchor={rollbackAnchorId}
      className="border-sidebar-border/70 bg-muted/60 dark:border-white/20 dark:bg-muted/40"
    >
      <CardContent className="space-y-2 p-4 pr-10 opacity-0">
        <p className="text-base font-bold leading-tight">{card.showName}</p>
        <p className="text-sm font-medium">
          {card.row.user.first_name} {card.row.user.last_name}
        </p>
        <p className="text-sm">{card.row.user.email}</p>
        <p className="text-sm">
          {card.row.seatNumbers.length} seat{card.row.seatNumbers.length !== 1 ? "s" : ""} - {formatCurrency(card.row.totalAmount)}
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
  verifyingId: string | null;
  stageClassName: string;
  stageCountClassName: string;
  stageSurfaceClassName: string;
};

function KanbanColumn({
  status,
  title,
  icon,
  cards,
  isActiveDrop,
  verifyingId,
  stageClassName,
  stageCountClassName,
  stageSurfaceClassName,
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
      <div className={`flex items-center justify-between px-3 py-2 ${stageClassName}`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${stageCountClassName}`}>
          {cards.length}
        </span>
      </div>

      <SortableContext items={cards.filter((card) => !card.isPreview).map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[220px] space-y-3 p-3">
          {cards.map((card) =>
            card.isPreview ? (
              <PreviewPlaceholderCard
                key={card.id}
                card={card}
                previewId={card.id.startsWith("preview:") ? card.id : undefined}
                rollbackAnchorId={card.id.startsWith("rollback:") ? card.id.replace("rollback:", "") : undefined}
              />
            ) : (
              <SortableCard key={card.id} card={card} isVerifying={verifyingId === `kanban:${card.id}`} />
            ),
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function ReservationsClient() {
  const [shows, setShows] = React.useState<ShowGroup[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);
  const [pendingMove, setPendingMove] = React.useState<PendingMove | null>(null);
  const [activeDropColumn, setActiveDropColumn] = React.useState<KanbanStatus | null>(null);
  const [activeDragCardId, setActiveDragCardId] = React.useState<string | null>(null);
  const [previewColumn, setPreviewColumn] = React.useState<KanbanStatus | null>(null);
  const [rollbackPreview, setRollbackPreview] = React.useState<RollbackPreview | null>(null);
  const [rollbackGhost, setRollbackGhost] = React.useState<RollbackGhost | null>(null);
  const [columnOrders, setColumnOrders] = React.useState<Record<KanbanStatus, string[]>>({
    PENDING: [],
    CONFIRMED: [],
    REJECTED: [],
  });

  const rollbackTimeoutRef = React.useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

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
    };
  }, []);

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

  const handleVerifyMany = async (reservationIds: string[], verifyKey: string) => {
    if (reservationIds.length === 0) return false;

    setVerifyingId(verifyKey);

    try {
      for (const reservationId of reservationIds) {
        const res = await fetch("/api/reservations/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to verify");
        }
      }

      setShows((prev) =>
        prev.map((show) => ({
          ...show,
          reservations: show.reservations.map((reservation) =>
            reservationIds.includes(reservation.reservation_id)
              ? {
                  ...reservation,
                  status: "CONFIRMED",
                  payment: reservation.payment
                    ? { ...reservation.payment, status: "PAID", paid_at: new Date().toISOString() }
                    : reservation.payment,
                }
              : reservation,
          ),
        })),
      );

      toast.success(
        reservationIds.length === 1
          ? "Reservation verified successfully!"
          : `${reservationIds.length} reservations verified successfully!`,
      );
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
      return false;
    } finally {
      setVerifyingId(null);
    }
  };

  const handleRejectMany = async (reservationIds: string[], rejectKey: string) => {
    if (reservationIds.length === 0) return false;

    setVerifyingId(rejectKey);

    try {
      for (const reservationId of reservationIds) {
        const res = await fetch("/api/reservations/reject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to reject");
        }
      }

      setShows((prev) =>
        prev.map((show) => ({
          ...show,
          reservations: show.reservations.map((reservation) =>
            reservationIds.includes(reservation.reservation_id)
              ? {
                  ...reservation,
                  status: "CANCELLED",
                  payment: reservation.payment
                    ? {
                        ...reservation.payment,
                        status: reservation.payment.status === "PAID" ? "REFUNDED" : "FAILED",
                        paid_at: reservation.payment.status === "PAID" ? reservation.payment.paid_at : null,
                      }
                    : reservation.payment,
                }
              : reservation,
          ),
        })),
      );

      toast.success(
        reservationIds.length === 1
          ? "Reservation rejected successfully!"
          : `${reservationIds.length} reservations rejected successfully!`,
      );
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejection failed");
      return false;
    } finally {
      setVerifyingId(null);
    }
  };

  const filteredShows = React.useMemo(() => {
    if (!searchQuery.trim()) return shows;

    const q = searchQuery.toLowerCase();

    return shows
      .map((show) => ({
        ...show,
        reservations: show.reservations.filter(
          (reservation) =>
            reservation.first_name.toLowerCase().includes(q) ||
            reservation.last_name.toLowerCase().includes(q) ||
            reservation.email.toLowerCase().includes(q) ||
            reservation.phone_number.toLowerCase().includes(q) ||
            reservation.seatAssignment.seat.seat_number.toLowerCase().includes(q) ||
            reservation.reservation_id.toLowerCase().includes(q) ||
            show.showName.toLowerCase().includes(q) ||
            show.venue.toLowerCase().includes(q),
        ),
      }))
      .filter((show) => show.reservations.length > 0);
  }, [shows, searchQuery]);

  const kanbanCards = React.useMemo(() => {
    const cards: KanbanCard[] = [];

    for (const show of filteredShows) {
      const rows = buildUserRows(show.reservations);

      for (const row of rows) {
        cards.push({
          id: `${show.showId}::${row.userId}`,
          status: getRowStatus(row),
          showName: show.showName,
          row,
        });
      }
    }

    return cards;
  }, [filteredShows]);

  const cardsByColumn = React.useMemo(() => {
    return {
      PENDING: kanbanCards.filter((card) => card.status === "PENDING"),
      CONFIRMED: kanbanCards.filter((card) => card.status === "CONFIRMED"),
      REJECTED: kanbanCards.filter((card) => card.status === "REJECTED"),
    } satisfies Record<KanbanStatus, KanbanCard[]>;
  }, [kanbanCards]);

  const cardById = React.useMemo(() => {
    return new Map(kanbanCards.map((card) => [card.id, card]));
  }, [kanbanCards]);

  React.useEffect(() => {
    setColumnOrders((prev) => {
      const next = { ...prev };
      (Object.keys(cardsByColumn) as KanbanStatus[]).forEach((status) => {
        const currentIds = cardsByColumn[status].map((card) => card.id);
        const previousIds = prev[status].filter((id) => currentIds.includes(id));
        const appendedIds = currentIds.filter((id) => !previousIds.includes(id));
        next[status] = [...previousIds, ...appendedIds];
      });
      return next;
    });
  }, [cardsByColumn]);

  const orderedCardsByColumn = React.useMemo(() => {
    const ordered = {} as Record<KanbanStatus, KanbanCard[]>;

    (Object.keys(cardsByColumn) as KanbanStatus[]).forEach((status) => {
      const lookup = new Map(cardsByColumn[status].map((card) => [card.id, card]));
      ordered[status] = columnOrders[status]
        .map((id) => lookup.get(id))
        .filter((card): card is KanbanCard => !!card);
    });

    return ordered;
  }, [cardsByColumn, columnOrders]);

  const activeDragCard = activeDragCardId ? cardById.get(activeDragCardId) ?? null : null;
  const pendingMoveCard = pendingMove ? cardById.get(pendingMove.cardId) ?? null : null;
  const rollbackPreviewCard = rollbackPreview ? cardById.get(rollbackPreview.cardId) ?? null : null;
  const previewCardSource = activeDragCard ?? pendingMoveCard;

  React.useEffect(() => {
    if (!rollbackPreview || !rollbackPreviewCard || !rollbackPreview.fromRect) {
      return;
    }

    const fromRect = rollbackPreview.fromRect;
    const frameId = window.requestAnimationFrame(() => {
      const anchor = document.querySelector(`[data-rollback-anchor="${rollbackPreview.cardId}"]`);
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
        setRollbackGhost((prev) => (prev ? { ...prev, isAnimating: true } : prev));
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

    if (previewCardSource && previewColumn && previewColumn !== previewCardSource.status) {
      display[previewCardSource.status] = display[previewCardSource.status].filter(
        (card) => card.id !== previewCardSource.id,
      );

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
      const sourceIndex = sourceCards.findIndex((card) => card.id === rollbackPreview.cardId);

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
  }, [orderedCardsByColumn, previewCardSource, previewColumn, rollbackPreview, rollbackPreviewCard]);

  const totalReservations = kanbanCards.length;
  const pendingCount = orderedCardsByColumn.PENDING.length;
  const confirmedCount = orderedCardsByColumn.CONFIRMED.length;

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

  const pendingMoveLabel = pendingMove?.targetStatus === "CONFIRMED" ? "Confirmed" : "Rejected";

  const clearRollbackPreview = React.useCallback(() => {
    if (rollbackTimeoutRef.current !== null) {
      window.clearTimeout(rollbackTimeoutRef.current);
      rollbackTimeoutRef.current = null;
    }
    setRollbackGhost(null);
    setRollbackPreview(null);
  }, []);

  const startRollbackPreview = React.useCallback((card: KanbanCard, fromRect: RollbackRect | null) => {
    if (rollbackTimeoutRef.current !== null) {
      window.clearTimeout(rollbackTimeoutRef.current);
      rollbackTimeoutRef.current = null;
    }

    setRollbackGhost(null);
    setRollbackPreview({ cardId: card.id, sourceStatus: card.status, fromRect });
  }, []);

  const handleCancelPendingMove = React.useCallback(() => {
    if (pendingMoveCard) {
      const previewElement = document.querySelector(`[data-preview-id="preview:${pendingMoveCard.id}"]`);
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
  }, [clearRollbackPreview, pendingMoveCard, startRollbackPreview]);

  const handleConfirmStageMove = React.useCallback(async () => {
    if (!pendingMove) return;

    const targetCard = cardById.get(pendingMove.cardId);
    if (!targetCard) {
      setPendingMove(null);
      setPreviewColumn(null);
      clearRollbackPreview();
      return;
    }

    const didSucceed =
      pendingMove.targetStatus === "CONFIRMED"
        ? await handleVerifyMany(targetCard.row.pendingReservationIds, `kanban:${targetCard.id}`)
        : await handleRejectMany(
            targetCard.row.reservations.map((reservation) => reservation.reservation_id),
            `kanban:${targetCard.id}`,
          );

    if (didSucceed) {
      setColumnOrders((prev) => {
        const next = {
          PENDING: prev.PENDING.filter((id) => id !== targetCard.id),
          CONFIRMED: prev.CONFIRMED.filter((id) => id !== targetCard.id),
          REJECTED: prev.REJECTED.filter((id) => id !== targetCard.id),
        };

        const targetIds = [...next[pendingMove.targetStatus]];
        targetIds.unshift(targetCard.id);
        next[pendingMove.targetStatus] = targetIds;

        return next;
      });
      setPendingMove(null);
      setPreviewColumn(null);
      clearRollbackPreview();
      return;
    }

    setPendingMove(null);
    setPreviewColumn(null);
    clearRollbackPreview();
  }, [cardById, clearRollbackPreview, handleRejectMany, handleVerifyMany, pendingMove]);

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
        setPendingMove({ cardId: activeCard.id, targetStatus: "CONFIRMED" });
        return;
      }

      if (activeCard.status === "PENDING" && targetStatus === "REJECTED") {
        setPendingMove({ cardId: activeCard.id, targetStatus: "REJECTED" });
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

      toast.warning("Allowed moves: Pending to Confirmed, or Pending to Rejected.");
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
              {pendingMoveCard
                ? `Move ${pendingMoveCard.row.user.first_name} ${pendingMoveCard.row.user.last_name} for ${pendingMoveCard.showName} to ${pendingMoveLabel}? This action cannot be undone or changed.`
                : "Confirm this reservation stage change. This action cannot be undone or changed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelPendingMove}
              disabled={!!verifyingId}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleConfirmStageMove();
              }}
              disabled={!!verifyingId}
            >
              {verifyingId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                `Move to ${pendingMoveLabel}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
                <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalReservations}</p>
                <p className="text-xs text-muted-foreground">Total Users Reserved</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending Users</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{confirmedCount}</p>
                <p className="text-xs text-muted-foreground">Confirmed Users</p>
              </div>
            </CardContent>
          </Card>
        </div>

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

        {kanbanCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <CreditCard className="h-10 w-10" />
            <p className="text-sm">{searchInput.trim() ? "No reservations match your search." : "No reservations found."}</p>
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
              setActiveDropColumn((prev) => (prev === nextColumn ? prev : nextColumn));

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
                  verifyingId={verifyingId}
                />
              ))}
            </div>
            <DragOverlay>
              {activeDragCard ? (
                <Card className="border-sidebar-border/70 dark:border-white/20 shadow-lg">
                  <CardContent className="space-y-2 p-4 pr-10">
                    <p className="text-base font-bold leading-tight">{activeDragCard.showName}</p>
                    <p className="text-sm font-medium text-foreground">
                      {activeDragCard.row.user.first_name} {activeDragCard.row.user.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{activeDragCard.row.user.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {activeDragCard.row.seatNumbers.length} seat
                      {activeDragCard.row.seatNumbers.length !== 1 ? "s" : ""} -{" "}
                      {formatCurrency(activeDragCard.row.totalAmount)}
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
                    <p className="text-base font-bold leading-tight">{rollbackGhost.card.showName}</p>
                    <p className="text-sm font-medium text-foreground">
                      {rollbackGhost.card.row.user.first_name} {rollbackGhost.card.row.user.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{rollbackGhost.card.row.user.email}</p>
                    <p className="text-sm text-muted-foreground">
                      {rollbackGhost.card.row.seatNumbers.length} seat
                      {rollbackGhost.card.row.seatNumbers.length !== 1 ? "s" : ""} -{" "}
                      {formatCurrency(rollbackGhost.card.row.totalAmount)}
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
