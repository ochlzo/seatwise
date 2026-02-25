"use client";

import * as React from "react";
import {
    CheckCircle2,
    Clock,
    XCircle,
    Eye,
    Loader2,
    ImageIcon,
    Calendar,
    MapPin,
    User,
    CreditCard,
    Search,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────────

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
    user_id: string;
    status: string;
    createdAt: string;
    user: {
        user_id: string;
        first_name: string;
        last_name: string;
        email: string;
        avatar_key: string | null;
    };
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

// ─── Helpers ────────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
};

const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(date);
};

const formatCurrency = (value: string | number) => {
    const parsed = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 2,
    }).format(parsed);
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const statusConfig: Record<string, { label: string; variant: BadgeVariant; icon: React.ElementType }> = {
    PENDING: { label: "Pending", variant: "outline", icon: Clock },
    CONFIRMED: { label: "Confirmed", variant: "default", icon: CheckCircle2 },
    CANCELLED: { label: "Cancelled", variant: "destructive", icon: XCircle },
    EXPIRED: { label: "Expired", variant: "secondary", icon: XCircle },
};

const paymentStatusConfig: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
    PAID: { label: "Paid", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
    FAILED: { label: "Failed", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
    REFUNDED: { label: "Refunded", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
};

// ─── Component ──────────────────────────────────────────────────────────────────

export function ReservationsClient() {
    const [shows, setShows] = React.useState<ShowGroup[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [verifyingId, setVerifyingId] = React.useState<string | null>(null);
    const [screenshotModal, setScreenshotModal] = React.useState<string | null>(null);
    const [expandedShows, setExpandedShows] = React.useState<Set<string>>(new Set());

    // Fetch all reservations on mount
    React.useEffect(() => {
        const fetchReservations = async () => {
            try {
                const res = await fetch("/api/reservations");
                if (!res.ok) throw new Error("Failed to fetch reservations");
                const data = await res.json();
                if (!data.success) throw new Error(data.error || "Unknown error");
                setShows(data.shows);

                // Expand first show by default
                if (data.shows.length > 0) {
                    setExpandedShows(new Set([data.shows[0].showId]));
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load");
            } finally {
                setIsLoading(false);
            }
        };

        void fetchReservations();
    }, []);

    // Verify handler
    const handleVerify = async (reservationId: string) => {
        setVerifyingId(reservationId);
        try {
            const res = await fetch("/api/reservations/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reservationId }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to verify");
            }

            // Update local state
            setShows((prev) =>
                prev.map((show) => ({
                    ...show,
                    reservations: show.reservations.map((r) =>
                        r.reservation_id === reservationId
                            ? {
                                ...r,
                                status: "CONFIRMED",
                                payment: r.payment
                                    ? { ...r.payment, status: "PAID", paid_at: new Date().toISOString() }
                                    : r.payment,
                            }
                            : r,
                    ),
                })),
            );

            toast.success("Reservation verified successfully!");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Verification failed");
        } finally {
            setVerifyingId(null);
        }
    };

    const toggleShowExpand = (showId: string) => {
        setExpandedShows((prev) => {
            const next = new Set(prev);
            if (next.has(showId)) {
                next.delete(showId);
            } else {
                next.add(showId);
            }
            return next;
        });
    };

    // Filter reservations by search query
    const filteredShows = React.useMemo(() => {
        if (!searchQuery.trim()) return shows;
        const q = searchQuery.toLowerCase();
        return shows
            .map((show) => ({
                ...show,
                reservations: show.reservations.filter(
                    (r) =>
                        r.user.first_name.toLowerCase().includes(q) ||
                        r.user.last_name.toLowerCase().includes(q) ||
                        r.user.email.toLowerCase().includes(q) ||
                        r.seatAssignment.seat.seat_number.toLowerCase().includes(q) ||
                        r.reservation_id.toLowerCase().includes(q),
                ),
            }))
            .filter((show) => show.reservations.length > 0);
    }, [shows, searchQuery]);

    // Stats
    const totalReservations = shows.reduce((sum, s) => sum + s.reservations.length, 0);
    const pendingCount = shows.reduce(
        (sum, s) => sum + s.reservations.filter((r) => r.status === "PENDING").length,
        0,
    );
    const confirmedCount = shows.reduce(
        (sum, s) => sum + s.reservations.filter((r) => r.status === "CONFIRMED").length,
        0,
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
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 py-4">
                        <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
                            <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{totalReservations}</p>
                            <p className="text-xs text-muted-foreground">Total Reservations</p>
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
                            <p className="text-xs text-muted-foreground">Pending Verification</p>
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
                            <p className="text-xs text-muted-foreground">Confirmed</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search by name, email, seat number, or reservation ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-sidebar-border/70 bg-background py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
            </div>

            {/* Grouped by Show */}
            {filteredShows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                    <CreditCard className="h-10 w-10" />
                    <p className="text-sm">
                        {searchQuery ? "No reservations match your search." : "No reservations found."}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredShows.map((show) => {
                        const isExpanded = expandedShows.has(show.showId);
                        const showPending = show.reservations.filter((r) => r.status === "PENDING").length;

                        return (
                            <Card key={show.showId} className="border-sidebar-border/70 overflow-hidden">
                                {/* Show Header — clickable */}
                                <button
                                    type="button"
                                    onClick={() => toggleShowExpand(show.showId)}
                                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 sm:px-6"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted/50">
                                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="truncate text-sm font-semibold sm:text-base">{show.showName}</h3>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3" />
                                                <span className="truncate">{show.venue}</span>
                                                <span className="text-muted-foreground/50">·</span>
                                                <span>{show.reservations.length} reservation{show.reservations.length !== 1 ? "s" : ""}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {showPending > 0 && (
                                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                                                {showPending} pending
                                            </Badge>
                                        )}
                                        {isExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </div>
                                </button>

                                {/* Reservations List */}
                                {isExpanded && (
                                    <div className="border-t border-sidebar-border/50">
                                        {show.reservations.map((reservation, idx) => {
                                            const config = statusConfig[reservation.status] ?? statusConfig.PENDING;
                                            const paymentConfig = reservation.payment
                                                ? paymentStatusConfig[reservation.payment.status] ?? paymentStatusConfig.PENDING
                                                : null;

                                            return (
                                                <div key={reservation.reservation_id}>
                                                    {idx > 0 && <Separator />}
                                                    <div className="px-4 py-4 sm:px-6">
                                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                            {/* Left: User + Seat info */}
                                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted/60">
                                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                                </div>
                                                                <div className="min-w-0 space-y-1">
                                                                    <p className="text-sm font-medium">
                                                                        {reservation.user.first_name} {reservation.user.last_name}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground truncate">{reservation.user.email}</p>
                                                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                                                        <span className="inline-flex items-center gap-1 rounded-md border border-sidebar-border/60 bg-muted/30 px-2 py-0.5 font-mono text-[11px]">
                                                                            Seat {reservation.seatAssignment.seat.seat_number}
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-1 rounded-md border border-sidebar-border/60 bg-muted/30 px-2 py-0.5 text-[11px]">
                                                                            {reservation.seatAssignment.set.seatCategory.category_name}
                                                                        </span>
                                                                        <span className="flex items-center gap-1 text-muted-foreground">
                                                                            <Calendar className="h-3 w-3" />
                                                                            {formatDate(reservation.seatAssignment.sched.sched_date)}{" "}
                                                                            {formatTime(reservation.seatAssignment.sched.sched_start_time)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Right: Status + Payment + Actions */}
                                                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant={config.variant as "default" | "secondary" | "destructive" | "outline"} className="gap-1">
                                                                        {reservation.status === "CONFIRMED" && <CheckCircle2 className="h-3 w-3" />}
                                                                        {reservation.status === "PENDING" && <Clock className="h-3 w-3" />}
                                                                        {(reservation.status === "CANCELLED" || reservation.status === "EXPIRED") && <XCircle className="h-3 w-3" />}
                                                                        {config.label}
                                                                    </Badge>
                                                                    {paymentConfig && (
                                                                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${paymentConfig.className}`}>
                                                                            {paymentConfig.label}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {reservation.payment && (
                                                                    <p className="text-sm font-semibold">
                                                                        {formatCurrency(reservation.payment.amount)}
                                                                    </p>
                                                                )}

                                                                <div className="flex items-center gap-2">
                                                                    {/* View Screenshot */}
                                                                    {reservation.payment?.screenshot_url && (
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 gap-1.5 text-xs"
                                                                            onClick={() => setScreenshotModal(reservation.payment!.screenshot_url)}
                                                                        >
                                                                            <Eye className="h-3 w-3" />
                                                                            View Receipt
                                                                        </Button>
                                                                    )}

                                                                    {/* Verify Button */}
                                                                    {reservation.status === "PENDING" && (
                                                                        <Button
                                                                            size="sm"
                                                                            className="h-7 gap-1.5 text-xs"
                                                                            onClick={() => handleVerify(reservation.reservation_id)}
                                                                            disabled={verifyingId === reservation.reservation_id}
                                                                        >
                                                                            {verifyingId === reservation.reservation_id ? (
                                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                            ) : (
                                                                                <CheckCircle2 className="h-3 w-3" />
                                                                            )}
                                                                            Verify
                                                                        </Button>
                                                                    )}
                                                                </div>

                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {formatDate(reservation.createdAt)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Screenshot Modal */}
            <Dialog open={!!screenshotModal} onOpenChange={() => setScreenshotModal(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>GCash Payment Receipt</DialogTitle>
                    </DialogHeader>
                    {screenshotModal && (
                        <div className="flex items-center justify-center p-2">
                            <img
                                src={screenshotModal}
                                alt="GCash payment receipt"
                                className="max-h-[70vh] rounded-lg object-contain"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
