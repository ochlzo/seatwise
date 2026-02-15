"use client";

import * as React from "react";
import {
    MapPin,
    Ticket,
    Clock,
    CalendarDays,
    Armchair,
    CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { groupSchedulesByCommonalities } from "@/lib/db/showScheduleGrouping";

const STATUS_COLORS: Record<string, string> = {
    UPCOMING: "#3B82F6",
    DRAFT: "#64748B",
    OPEN: "#22C55E",
    CLOSED: "#6B7280",
    ON_GOING: "#F59E0B",
    CANCELLED: "#EF4444",
    POSTPONED: "#A855F7",
};

const COLOR_OPTIONS: Array<{
    value: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
    label: string;
    swatch: string | null;
}> = [
        { value: "NO_COLOR", label: "No Color", swatch: null },
        { value: "GOLD", label: "Gold", swatch: "#ffd700" },
        { value: "PINK", label: "Pink", swatch: "#e005b9" },
        { value: "BLUE", label: "Blue", swatch: "#111184" },
        { value: "BURGUNDY", label: "Burgundy", swatch: "#800020" },
        { value: "GREEN", label: "Green", swatch: "#046307" },
    ];

const MANILA_TZ = "Asia/Manila";

const formatManilaDate = (value: Date) => {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: MANILA_TZ,
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(value);
};

const toDateValue = (value: string | Date) => {
    if (value instanceof Date) return value;
    if (value.includes("T")) return new Date(value);
    return new Date(`${value}T00:00:00+08:00`);
};

const toTimeValue = (value: string | Date) => {
    if (value instanceof Date) return value;
    if (value.includes("T")) return new Date(value);
    return new Date(`1970-01-01T${value}:00+08:00`);
};

const toManilaTimeKey = (value: Date) =>
    new Intl.DateTimeFormat("en-GB", {
        timeZone: MANILA_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(value);

type CategoryDraft = {
    id: string;
    category_name: string;
    price: string;
    color_code: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
};

type CategorySetDraft = {
    id: string;
    set_name: string;
    apply_to_all: boolean;
    sched_ids: string[];
    filter_date: string;
    categories: CategoryDraft[];
    seatAssignments: Record<string, string>;
};

type ShowDetail = {
    show_id: string;
    show_name: string;
    show_description: string;
    venue: string;
    address: string;
    show_status: string;
    show_start_date: string | Date;
    show_end_date: string | Date;
    show_image_key?: string | null;
    seatmap_id?: string | null;
    scheds: Array<{
        sched_id?: string;
        sched_date: string | Date;
        sched_start_time: string | Date;
        sched_end_time: string | Date;
        category_set_id?: string | null;
        seatAssignments?: Array<{
            seat_assignment_id: string;
            seat_id: string;
            sched_id: string;
            set_id: string;
            seat_status: "OPEN" | "RESERVED";
            set: {
                set_id: string;
                sched_id: string;
                seat_category_id: string;
                seatCategory: {
                    seat_category_id: string;
                    category_name: string;
                    price: string;
                    color_code:
                    | "NO_COLOR"
                    | "GOLD"
                    | "PINK"
                    | "BLUE"
                    | "BURGUNDY"
                    | "GREEN";
                };
            };
        }>;
    }>;
    categorySets?: Array<{
        category_set_id: string;
        set_name: string;
        items: Array<{
            seatCategory: {
                seat_category_id: string;
                category_name: string;
                price: string;
                color_code:
                | "NO_COLOR"
                | "GOLD"
                | "PINK"
                | "BLUE"
                | "BURGUNDY"
                | "GREEN";
            };
        }>;
    }>;
};

interface ShowDetailPublicProps {
    show: ShowDetail;
    reserveButton?: React.ReactNode;
}

export function ShowDetailPublic({ show, reserveButton }: ShowDetailPublicProps) {
    const [seatmapId] = React.useState(show.seatmap_id || "");
    const [activeSetId, setActiveSetId] = React.useState<string | null>(null);

    // Convert categorySets from DB format to draft format
    const categorySets: CategorySetDraft[] = React.useMemo(() => {
        if (!show.categorySets) return [];

        return show.categorySets.map((dbSet) => ({
            id: dbSet.category_set_id,
            set_name: dbSet.set_name,
            apply_to_all: false,
            sched_ids: [],
            filter_date: "",
            categories: dbSet.items.map((item) => ({
                id: item.seatCategory.seat_category_id,
                category_name: item.seatCategory.category_name,
                price: item.seatCategory.price,
                color_code: item.seatCategory.color_code,
            })),
            seatAssignments: {},
        }));
    }, [show.categorySets]);

    // Build seatAssignments from schedule data
    React.useEffect(() => {
        if (!show.scheds || categorySets.length === 0) return;

        show.scheds.forEach((sched) => {
            if (!sched.seatAssignments) return;

            const categorySet = categorySets.find(
                (set) => set.id === sched.category_set_id
            );

            if (categorySet) {
                const assignments: Record<string, string> = {};
                sched.seatAssignments.forEach((assignment) => {
                    assignments[assignment.seat_id] = assignment.set.seat_category_id;
                });
                categorySet.seatAssignments = assignments;
            }
        });
    }, [show.scheds, categorySets]);

    // Calculate total seats
    const totalSeatsCount = React.useMemo(() => {
        if (!show.scheds || show.scheds.length === 0) return 0;
        const firstSched = show.scheds[0];
        if (!firstSched.seatAssignments) return 0;
        return firstSched.seatAssignments.length;
    }, [show.scheds]);

    // Prepare schedules with category set info
    const schedulesWithSets = React.useMemo(() => {
        return show.scheds.map((sched) => {
            const categorySet = categorySets.find(
                (set) =>
                    set.apply_to_all ||
                    set.sched_ids.includes(sched.sched_id || "")
            );

            return {
                ...sched,
                category_set_id: categorySet?.id || sched.category_set_id || null,
                set_name: categorySet?.set_name || null,
            };
        });
    }, [show.scheds, categorySets]);

    // Group schedules
    const groupedSchedules = React.useMemo(() => {
        return groupSchedulesByCommonalities(schedulesWithSets);
    }, [schedulesWithSets]);

    return (
        <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Hero Banner */}
            <div className="relative aspect-square md:aspect-[3/1] bg-muted overflow-hidden rounded-xl border border-sidebar-border shadow-2xl">
                {show.show_image_key ? (
                    <Image
                        src={show.show_image_key}
                        alt={show.show_name}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: "50% 35%" }}
                        fill
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                        <Ticket className="w-16 h-16 text-primary/20 mb-4" />
                        <span className="text-muted-foreground font-medium italic">
                            NO PRODUCTION ASSET
                        </span>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 md:bottom-6 left-4 md:left-8 right-4 md:right-8 flex justify-between items-end">
                    <div className="space-y-0.5 md:space-y-1">
                        <h1 className="text-xl md:text-3xl lg:text-4xl font-semibold text-white drop-shadow-md">
                            {show.show_name}
                        </h1>
                        <p className="text-xs md:text-base text-white/80 font-medium flex items-center gap-1 md:gap-2 drop-shadow-sm">
                            <MapPin className="w-3 h-3 md:w-4 md:h-4" />
                            {show.venue}
                        </p>
                    </div>
                    <Badge
                        variant="outline"
                        style={{
                            backgroundColor: STATUS_COLORS[show.show_status] || "#6B7280",
                            color: "white",
                            borderColor: "transparent",
                        }}
                        className="shadow-xl font-bold italic px-2 md:px-4 py-1 md:py-1.5 text-xs md:text-sm uppercase tracking-wider"
                    >
                        {show.show_status.replace("_", " ")}
                    </Badge>
                </div>
            </div>

            {/* Reserve Button (Mobile) */}
            {reserveButton && (
                <div className="lg:hidden w-full px-4 -mt-2">
                    {reserveButton}
                </div>
            )}

            <div className="grid gap-6 md:gap-8 grid-cols-1 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* About Section */}
                    <Card className="border-sidebar-border shadow-sm">
                        <CardContent className="pt-6 space-y-4">
                            <div>
                                <h2 className="text-2xl font-bold mb-2">About This Show</h2>
                                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {show.show_description}
                                </p>
                            </div>

                            <Separator />

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <MapPin className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-muted-foreground">Venue</p>
                                        <p className="font-medium">{show.venue}</p>
                                        <p className="text-sm text-muted-foreground">{show.address}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <CalendarDays className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-muted-foreground">Run Dates</p>
                                        <p className="font-medium">
                                            {formatManilaDate(toDateValue(show.show_start_date))}
                                            {" - "}
                                            {formatManilaDate(toDateValue(show.show_end_date))}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Schedule Section */}
                    {show.scheds && show.scheds.length > 0 && (
                        <Card className="border-sidebar-border shadow-sm">
                            <CardContent className="pt-6">
                                <h2 className="text-2xl font-bold mb-4">Performance Schedule</h2>

                                {groupedSchedules.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                                        No schedules found.
                                    </div>
                                ) : groupedSchedules.length === 1 ? (
                                    // Single group - no tabs
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                                            <CalendarIcon className="w-4 h-4 text-primary" />
                                            {groupedSchedules[0].label}
                                        </h4>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {groupedSchedules[0].items.map((item, idx) => {
                                                const categorySet = categorySets.find(
                                                    (set) => set.id === item.category_set_id
                                                );

                                                const format12Hour = (time24: string) => {
                                                    const [hours, minutes] = time24.split(':').map(Number);
                                                    const period = hours >= 12 ? 'PM' : 'AM';
                                                    const hours12 = hours % 12 || 12;
                                                    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
                                                };

                                                return (
                                                    <div
                                                        key={`${idx}-${item.sched_start_time}-${item.category_set_id}`}
                                                        className="flex items-center justify-between p-3 rounded-lg border border-sidebar-border/60 bg-muted/20"
                                                    >
                                                        <div className="space-y-1.5 flex-1">
                                                            <div className="text-sm font-medium flex items-center gap-2">
                                                                {format12Hour(item.sched_start_time)}
                                                                <span className="text-muted-foreground">-</span>
                                                                {format12Hour(item.sched_end_time)}
                                                            </div>
                                                            {categorySet && (
                                                                <div className="space-y-1.5 pt-1">
                                                                    <div className="text-[11px] font-medium text-muted-foreground">
                                                                        {categorySet.set_name}
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {categorySet.categories
                                                                            .filter((category) =>
                                                                                Object.values(categorySet.seatAssignments || {}).includes(category.id)
                                                                            )
                                                                            .map((category) => (
                                                                                <div
                                                                                    key={category.id}
                                                                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-sidebar-border/60 bg-background text-[10px]"
                                                                                >
                                                                                    <span
                                                                                        className="h-2 w-2 rounded-full border border-zinc-300"
                                                                                        style={{
                                                                                            backgroundColor:
                                                                                                category.color_code === "NO_COLOR"
                                                                                                    ? "transparent"
                                                                                                    : COLOR_OPTIONS.find((c) => c.value === category.color_code)?.swatch || "#6B7280",
                                                                                        }}
                                                                                    />
                                                                                    <span className="font-medium">{category.category_name}</span>
                                                                                    <span className="text-muted-foreground">₱{category.price}</span>
                                                                                </div>
                                                                            ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    // Multiple groups - use tabs
                                    <Tabs
                                        defaultValue={groupedSchedules[0]?.label}
                                        onValueChange={(value) => {
                                            const selectedGroup = groupedSchedules.find((g) => g.label === value);
                                            if (selectedGroup && selectedGroup.items[0]) {
                                                const categorySetId = selectedGroup.items[0].category_set_id;
                                                if (categorySetId) {
                                                    setActiveSetId(categorySetId);
                                                }
                                            }
                                        }}
                                    >
                                        <TabsList variant="line" className="w-full justify-start overflow-x-auto flex-wrap h-auto">
                                            {groupedSchedules.map((group) => (
                                                <TabsTrigger key={group.label} value={group.label} className="flex items-center gap-2">
                                                    <CalendarDays className="w-3.5 h-3.5" />
                                                    {group.label}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>
                                        {groupedSchedules.map((group) => (
                                            <TabsContent key={group.label} value={group.label} className="mt-4">
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    {group.items.map((item, idx) => {
                                                        const categorySet = categorySets.find(
                                                            (set) => set.id === item.category_set_id
                                                        );

                                                        const format12Hour = (time24: string) => {
                                                            const [hours, minutes] = time24.split(':').map(Number);
                                                            const period = hours >= 12 ? 'PM' : 'AM';
                                                            const hours12 = hours % 12 || 12;
                                                            return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
                                                        };

                                                        return (
                                                            <div
                                                                key={`${idx}-${item.sched_start_time}-${item.category_set_id}`}
                                                                className="flex items-center justify-between p-3 rounded-lg border border-sidebar-border/60 bg-muted/20"
                                                            >
                                                                <div className="space-y-1.5 flex-1">
                                                                    <div className="text-sm font-medium flex items-center gap-2">
                                                                        {format12Hour(item.sched_start_time)}
                                                                        <span className="text-muted-foreground">-</span>
                                                                        {format12Hour(item.sched_end_time)}
                                                                    </div>
                                                                    {categorySet && (
                                                                        <div className="space-y-1.5 pt-1">
                                                                            <div className="text-[11px] font-medium text-muted-foreground">
                                                                                {categorySet.set_name}
                                                                            </div>
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {categorySet.categories
                                                                                    .filter((category) =>
                                                                                        Object.values(categorySet.seatAssignments || {}).includes(category.id)
                                                                                    )
                                                                                    .map((category) => (
                                                                                        <div
                                                                                            key={category.id}
                                                                                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-sidebar-border/60 bg-background text-[10px]"
                                                                                        >
                                                                                            <span
                                                                                                className="h-2 w-2 rounded-full border border-zinc-300"
                                                                                                style={{
                                                                                                    backgroundColor:
                                                                                                        category.color_code === "NO_COLOR"
                                                                                                            ? "transparent"
                                                                                                            : COLOR_OPTIONS.find((c) => c.value === category.color_code)?.swatch || "#6B7280",
                                                                                                }}
                                                                                            />
                                                                                            <span className="font-medium">{category.category_name}</span>
                                                                                            <span className="text-muted-foreground">₱{category.price}</span>
                                                                                        </div>
                                                                                    ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </TabsContent>
                                        ))}
                                    </Tabs>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Seatmap Section */}
                    {show.seatmap_id && categorySets.length > 0 && (
                        <Card className="border-sidebar-border shadow-sm">
                            <CardContent className="pt-6">
                                <h2 className="text-2xl font-bold mb-4">Seating Chart</h2>

                                {/* Tab Navigation for Category Sets */}
                                <div className="flex flex-col gap-3 w-full">
                                    <div className="flex w-fit max-w-full justify-start overflow-x-auto rounded-lg bg-muted p-1">
                                        {categorySets.map((setItem, index) => {
                                            const isActive =
                                                (activeSetId ?? categorySets[0]?.id) === setItem.id;
                                            return (
                                                <button
                                                    key={setItem.id}
                                                    type="button"
                                                    onClick={() => setActiveSetId(setItem.id)}
                                                    className={cn(
                                                        "inline-flex min-w-[100px] items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background",
                                                        isActive
                                                            ? "bg-background text-foreground shadow-sm"
                                                            : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                                                    )}
                                                >
                                                    {setItem.set_name || `Set ${index + 1}`}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Active Seatmap Content */}
                                    {(() => {
                                        const activeSet = categorySets.find(
                                            (s) => s.id === (activeSetId ?? categorySets[0]?.id)
                                        );

                                        if (!activeSet) return null;

                                        const setCategories = activeSet.categories.map(
                                            (category) => ({
                                                category_id: category.id,
                                                name: category.category_name,
                                                color_code: category.color_code,
                                            })
                                        );

                                        const currentAssignments =
                                            activeSet.seatAssignments || {};

                                        return (
                                            <div className="relative mt-1">
                                                <SeatmapPreview
                                                    seatmapId={seatmapId || undefined}
                                                    allowMarqueeSelection={false}
                                                    selectedSeatIds={[]}
                                                    onSelectionChange={() => { }}
                                                    categories={setCategories}
                                                    seatCategories={currentAssignments}
                                                />
                                            </div>
                                        );
                                    })()}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Quick Stats */}
                    <Card className="border-sidebar-border shadow-lg bg-card overflow-hidden relative">
                        <CardContent className="pt-6 space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Ticket className="w-4 h-4 text-primary" />
                                Quick Info
                            </h3>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-sidebar-border/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                            <CalendarDays className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-semibold text-muted-foreground">
                                            Total Days
                                        </span>
                                    </div>
                                    <span className="font-black text-xl tracking-tighter">
                                        {new Set(show.scheds.map((s) => toDateValue(s.sched_date).toISOString().split("T")[0])).size}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-sidebar-border/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <span className="text-sm font-semibold text-muted-foreground">
                                            Performances
                                        </span>
                                    </div>
                                    <span className="font-black text-xl tracking-tighter">
                                        {show.scheds.length}
                                    </span>
                                </div>

                                {show.seatmap_id && totalSeatsCount > 0 && (
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-sidebar-border/50">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                <Armchair className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm font-semibold text-muted-foreground">
                                                Capacity
                                            </span>
                                        </div>
                                        <span className="font-black text-xl tracking-tighter">
                                            {totalSeatsCount}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Reserve Button (Desktop) */}
                    {reserveButton && (
                        <div className="hidden lg:block w-full">
                            {reserveButton}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
