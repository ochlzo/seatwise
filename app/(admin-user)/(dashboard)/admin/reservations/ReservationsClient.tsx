"use client";

import * as React from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, Clock, CreditCard, GripVertical, Loader2, Search, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

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

type KanbanStatus = "PENDING" | "CONFIRMED" | "OTHER";

type KanbanCard = {
  id: string;
  status: KanbanStatus;
  showName: string;
  row: UserReservationRow;
};

const COLUMNS: Array<{ key: KanbanStatus; title: string; icon: React.ReactNode }> = [
  { key: "PENDING", title: "Pending", icon: <Clock className="h-4 w-4" /> },
  { key: "CONFIRMED", title: "Confirmed", icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: "OTHER", title: "Other", icon: <XCircle className="h-4 w-4" /> },
];

const columnId = (status: KanbanStatus) => `column:${status}`;

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
  return "OTHER";
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: isVerifying,
    data: { type: "card", column: card.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`border-sidebar-border/70 ${isDragging ? "opacity-60" : ""} ${isVerifying ? "opacity-70" : ""}`}
    >
      <CardContent className="relative space-y-2 p-4 pr-10">
        <button
          type="button"
          aria-label="Drag reservation card"
          className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
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

type KanbanColumnProps = {
  status: KanbanStatus;
  title: string;
  icon: React.ReactNode;
  cards: KanbanCard[];
  isActiveDrop: boolean;
  verifyingId: string | null;
};

function KanbanColumn({ status, title, icon, cards, isActiveDrop, verifyingId }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: columnId(status),
    data: { type: "column", column: status },
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-sidebar-border/70 bg-muted/20 p-3 transition-colors ${isActiveDrop ? "bg-muted/50" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <span className="rounded-md bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {cards.length}
        </span>
      </div>

      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} isVerifying={verifyingId === `kanban:${card.id}`} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function ReservationsClient() {
  const [shows, setShows] = React.useState<ShowGroup[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [verifyingId, setVerifyingId] = React.useState<string | null>(null);
  const [activeDropColumn, setActiveDropColumn] = React.useState<KanbanStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

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
    if (reservationIds.length === 0) return;

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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
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
            reservation.seatAssignment.sched.show.show_name.toLowerCase().includes(q),
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
      OTHER: kanbanCards.filter((card) => card.status === "OTHER"),
    } satisfies Record<KanbanStatus, KanbanCard[]>;
  }, [kanbanCards]);

  const cardById = React.useMemo(() => {
    return new Map(kanbanCards.map((card) => [card.id, card]));
  }, [kanbanCards]);

  const totalReservations = kanbanCards.length;
  const pendingCount = cardsByColumn.PENDING.length;
  const confirmedCount = cardsByColumn.CONFIRMED.length;

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

  const onDragEnd = React.useCallback(
    async (event: DragEndEvent) => {
      setActiveDropColumn(null);

      const activeId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : null;
      if (!overId) return;

      const activeCard = cardById.get(activeId);
      if (!activeCard) return;

      const targetStatus = resolveDropTarget(overId);
      if (!targetStatus || targetStatus === activeCard.status) return;

      if (activeCard.status === "PENDING" && targetStatus === "CONFIRMED") {
        await handleVerifyMany(activeCard.row.pendingReservationIds, `kanban:${activeCard.id}`);
        return;
      }

      toast.info("Only moving Pending cards to Confirmed is currently supported.");
    },
    [cardById, resolveDropTarget],
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
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-sidebar-border/70 bg-background py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>

      {kanbanCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <CreditCard className="h-10 w-10" />
          <p className="text-sm">{searchQuery ? "No reservations match your search." : "No reservations found."}</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragOver={(event) => {
            const overId = event.over ? String(event.over.id) : null;
            if (!overId) {
              setActiveDropColumn(null);
              return;
            }
            setActiveDropColumn(resolveDropTarget(overId));
          }}
          onDragEnd={(event) => {
            void onDragEnd(event);
          }}
        >
          <div className="grid gap-4 xl:grid-cols-3">
            {COLUMNS.map((column) => (
              <KanbanColumn
                key={column.key}
                status={column.key}
                title={column.title}
                icon={column.icon}
                cards={cardsByColumn[column.key]}
                isActiveDrop={activeDropColumn === column.key}
                verifyingId={verifyingId}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}
