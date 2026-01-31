"use client";

import * as React from "react";

import { CalendarIcon, MapPin, Ticket, Clock, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { updateShowAction } from "@/lib/actions/updateShow";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ShowStatus } from "@prisma/client";
import Image from "next/image";
import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";
import { CategoryAssignPanel } from "@/components/seatmap/CategoryAssignPanel";
import type { SeatmapState } from "@/lib/seatmap/types";

const STATUS_COLORS: Record<string, string> = {
    UPCOMING: "#3B82F6",
    DRAFT: "#64748B",
    OPEN: "#22C55E",
    CLOSED: "#6B7280",
    ON_GOING: "#F59E0B",
    CANCELLED: "#EF4444",
    POSTPONED: "#A855F7",
};

const COLOR_OPTIONS: Array<{ value: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN"; label: string; swatch: string | null }> = [
    { value: "NO_COLOR", label: "No Color", swatch: null },
    { value: "GOLD", label: "Gold", swatch: "#ffd700" },
    { value: "PINK", label: "Pink", swatch: "#e005b9" },
    { value: "BLUE", label: "Blue", swatch: "#111184" },
    { value: "BURGUNDY", label: "Burgundy", swatch: "#800020" },
    { value: "GREEN", label: "Green", swatch: "#046307" },
];

const MANILA_TZ = "Asia/Manila";

const toManilaDateKey = (value: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: MANILA_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(value);
    const year = parts.find((part) => part.type === "year")?.value ?? "0000";
    const month = parts.find((part) => part.type === "month")?.value ?? "00";
    const day = parts.find((part) => part.type === "day")?.value ?? "00";
    return `${year}-${month}-${day}`;
};

const formatManilaDate = (value: Date) =>
    new Intl.DateTimeFormat("en-US", {
        timeZone: MANILA_TZ,
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(value);

const formatManilaDateLong = (value: Date) =>
    new Intl.DateTimeFormat("en-US", {
        timeZone: MANILA_TZ,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(value);

const formatManilaTime = (value: Date) =>
    new Intl.DateTimeFormat("en-US", {
        timeZone: MANILA_TZ,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(value);

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
    show_status: ShowStatus;
    show_start_date: string | Date;
    show_end_date: string | Date;
    show_image_key?: string | null;
    seatmap_id?: string | null;
    scheds: Array<{
        sched_id?: string;
        sched_date: string | Date;
        sched_start_time: string | Date;
        sched_end_time: string | Date;
    }>;
    categorySets?: Array<{
        category_set_id: string;
        set_name: string;
        items: Array<{
            seatCategory: {
                seat_category_id: string;
                category_name: string;
                price: string; // Serialized from Decimal
                color_code: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
            };
        }>;
    }>;
};

interface ShowDetailFormProps {
    show: ShowDetail;
}

type SeatmapOption = {
    seatmap_id: string;
    seatmap_name: string;
    updatedAt: string;
};

type SchedDraft = ShowDetail["scheds"][number];

export function ShowDetailForm({ show }: ShowDetailFormProps) {
    const router = useRouter();
    const [isSaving, setIsSaving] = React.useState(false);
    const [isEditing, setIsEditing] = React.useState(false);

    // Schedule Editor State
    const [isScheduleOpen, setIsScheduleOpen] = React.useState(false);
    const [seatmaps, setSeatmaps] = React.useState<SeatmapOption[]>([]);
    const [seatmapQuery, setSeatmapQuery] = React.useState("");
    const [selectedDates, setSelectedDates] = React.useState<Date[]>([]);
    const [timeRanges, setTimeRanges] = React.useState([
        { id: `time-${uuidv4()}`, start: "19:00", end: "21:00" },
    ]);
    const [categorySets, setCategorySets] = React.useState<CategorySetDraft[]>([]);
    const [selectedSeatIds, setSelectedSeatIds] = React.useState<string[]>([]);
    const [seatmapData, setSeatmapData] = React.useState<SeatmapState | null>(null);
    const [activeSetId, setActiveSetId] = React.useState<string | null>(null);

    const filteredSeatmaps = React.useMemo(() => {
        const query = seatmapQuery.trim().toLowerCase();
        if (!query) return seatmaps;
        return seatmaps.filter((seatmap) =>
            seatmap.seatmap_name.toLowerCase().includes(query)
        );
    }, [seatmapQuery, seatmaps]);

    const [formData, setFormData] = React.useState({
        show_name: show.show_name,
        show_description: show.show_description,
        venue: show.venue,
        address: show.address,
        show_status: show.show_status,
        show_start_date: new Date(show.show_start_date),
        show_end_date: new Date(show.show_end_date),
        seatmap_id: show.seatmap_id || "",
        scheds: show.scheds || [],
    });

    React.useEffect(() => {
        let isMounted = true;
        const loadSeatmaps = async () => {
            try {
                const response = await fetch("/api/seatmaps");
                if (!response.ok) throw new Error("Failed to load seatmaps");
                const data = await response.json();
                if (isMounted) setSeatmaps(data.seatmaps ?? []);
            } catch (error) {
                console.error("Failed to load seatmaps", error);
            }
        };
        loadSeatmaps();
        return () => { isMounted = false; };
    }, []);

    React.useEffect(() => {
        if (!formData.seatmap_id) {
            if (seatmapQuery) {
                setSeatmapQuery("");
            }
            return;
        }
        const match = seatmaps.find((seatmap) => seatmap.seatmap_id === formData.seatmap_id);
        if (match && match.seatmap_name !== seatmapQuery) {
            setSeatmapQuery(match.seatmap_name);
        }
    }, [formData.seatmap_id, seatmapQuery, seatmaps]);

    // Fetch seatmap data when seatmap is selected
    React.useEffect(() => {
        if (!formData.seatmap_id) {
            setSeatmapData(null);
            return;
        }

        let isMounted = true;
        const loadSeatmapData = async () => {
            try {
                const response = await fetch(`/api/seatmaps/${formData.seatmap_id}`);
                if (!response.ok) throw new Error("Failed to load seatmap");
                const data = await response.json();
                if (isMounted) {
                    setSeatmapData(data.seatmap_json);
                }
            } catch (error: unknown) {
                console.error("Error loading seatmap data:", error);
                if (isMounted) {
                    setSeatmapData(null);
                }
            }
        };
        loadSeatmapData();
        return () => {
            isMounted = false;
        };
    }, [formData.seatmap_id]);

    // Initialize category sets from show data
    React.useEffect(() => {
        if (!show.categorySets || show.categorySets.length === 0) {
            setCategorySets([]);
            return;
        }

        // Convert database category sets to draft format
        const drafts: CategorySetDraft[] = show.categorySets.map((dbSet) => ({
            id: dbSet.category_set_id,
            set_name: dbSet.set_name,
            apply_to_all: false, // Will be determined by checking schedules
            sched_ids: [], // Will be populated from schedules
            filter_date: "",
            categories: dbSet.items.map((item) => ({
                id: item.seatCategory.seat_category_id,
                category_name: item.seatCategory.category_name,
                price: String(item.seatCategory.price),
                color_code: item.seatCategory.color_code,
            })),
            seatAssignments: {}, // Will be populated from seat assignments API
        }));

        setCategorySets(drafts);
        if (drafts.length > 0) {
            setActiveSetId(drafts[0].id);
        }
    }, [show.categorySets]);

    const addTimeRange = () => {
        setTimeRanges(prev => [...prev, { id: `time-${uuidv4()}`, start: "19:00", end: "21:00" }]);
    };

    const removeTimeRange = (id: string) => {
        setTimeRanges(prev => prev.filter(t => t.id !== id));
    };

    const updateTimeRange = (id: string, patch: { start?: string; end?: string }) => {
        setTimeRanges(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    };

    const addCategorySet = () => {
        const newSetId = `set-${uuidv4()}`;
        setCategorySets((prev) => [
            ...prev,
            {
                id: newSetId,
                set_name: `Set ${prev.length + 1}`,
                apply_to_all: true,
                sched_ids: [],
                filter_date: "",
                categories: [],
                seatAssignments: {},
            },
        ]);
        setActiveSetId(newSetId);
    };

    const updateCategorySet = (id: string, patch: Partial<CategorySetDraft>) => {
        setCategorySets((prev) => prev.map((setItem) => (setItem.id === id ? { ...setItem, ...patch } : setItem)));
    };

    const removeCategorySet = (id: string) => {
        setCategorySets((prev) => {
            const filtered = prev.filter((setItem) => setItem.id !== id);
            if (activeSetId === id) {
                setActiveSetId(filtered.length > 0 ? filtered[0].id : null);
            }
            return filtered;
        });
    };

    const addCategoryToSet = (setId: string) => {
        setCategorySets((prev) =>
            prev.map((setItem) => {
                if (setItem.id !== setId) return setItem;
                return {
                    ...setItem,
                    categories: [
                        ...setItem.categories,
                        {
                            id: `cat-${uuidv4()}`,
                            category_name: "",
                            price: "0.00",
                            color_code: "NO_COLOR",
                        },
                    ],
                };
            })
        );
    };

    const updateCategoryInSet = (
        setId: string,
        categoryId: string,
        patch: Partial<CategoryDraft>
    ) => {
        setCategorySets((prev) =>
            prev.map((setItem) => {
                if (setItem.id !== setId) return setItem;
                return {
                    ...setItem,
                    categories: setItem.categories.map((category) =>
                        category.id === categoryId ? { ...category, ...patch } : category
                    ),
                };
            })
        );
    };

    const removeCategoryFromSet = (setId: string, categoryId: string) => {
        setCategorySets((prev) =>
            prev.map((setItem) => {
                if (setItem.id !== setId) return setItem;
                return {
                    ...setItem,
                    categories: setItem.categories.filter((category) => category.id !== categoryId),
                };
            })
        );
    };

    const toggleSetSched = (setId: string, schedId: string) => {
        setCategorySets((prev) =>
            prev.map((setItem) => {
                if (setItem.id !== setId) return setItem;
                const exists = setItem.sched_ids.includes(schedId);
                return {
                    ...setItem,
                    sched_ids: exists
                        ? setItem.sched_ids.filter((id) => id !== schedId)
                        : [...setItem.sched_ids, schedId],
                };
            })
        );
    };

    const updateSetSeatAssignments = (
        setId: string,
        updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)
    ) => {
        setCategorySets((prev) =>
            prev.map((setItem) => {
                if (setItem.id !== setId) return setItem;
                const nextAssignments =
                    typeof updater === "function" ? updater(setItem.seatAssignments) : updater;
                return { ...setItem, seatAssignments: nextAssignments };
            })
        );
    };

    const handleAddSchedules = () => {
        if (!selectedDates.length) {
            toast.error("Select at least one date.");
            return;
        }

        const validRanges = timeRanges.filter((t) => t.start && t.end);
        if (!validRanges.length) {
            toast.error("Add at least one valid time range.");
            return;
        }

        const newEntries: SchedDraft[] = [];
        selectedDates.forEach((date) => {
            const dateKey = toManilaDateKey(date);
            validRanges.forEach((range) => {
                newEntries.push({
                    sched_date: dateKey,
                    sched_start_time: range.start,
                    sched_end_time: range.end,
                });
            });
        });

        setFormData(prev => ({
            ...prev,
            scheds: [...prev.scheds, ...newEntries]
        }));

        setSelectedDates([]);
        setTimeRanges([{ id: `time-${uuidv4()}`, start: "19:00", end: "21:00" }]);
        setIsScheduleOpen(false);
        if (!isEditing) setIsEditing(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateShowAction(show.show_id, {
                ...formData,
                category_sets: categorySets.map((setItem, index) => {
                    // Map seatAssignments (seatId -> categoryId) to (seatId -> categoryName)
                    const assignmentsByName: Record<string, string> = {};
                    if (setItem.seatAssignments) {
                        Object.entries(setItem.seatAssignments).forEach(([seatId, categoryId]) => {
                            const category = setItem.categories.find((c) => c.id === categoryId);
                            if (category) {
                                assignmentsByName[seatId] = category.category_name.trim() || "Untitled";
                            }
                        });
                    }

                    return {
                        set_name: setItem.set_name.trim() || `Set ${index + 1}`,
                        apply_to_all: setItem.apply_to_all,
                        sched_ids: setItem.sched_ids,
                        categories: setItem.categories.map((category) => ({
                            category_name: category.category_name.trim() || "Untitled",
                            price: category.price,
                            color_code: category.color_code,
                        })),
                        seat_assignments: assignmentsByName,
                    };
                }),
            });

            if (result.success) {
                toast.success("Show updated successfully");
                setIsEditing(false);
                router.refresh();
            } else {
                toast.error(result.error || "Failed to update show");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* 1. Banner Section */}
            <div className="relative aspect-[21/9] md:aspect-[3/1] bg-muted overflow-hidden rounded-xl border border-sidebar-border shadow-2xl">
                {show.show_image_key ? (
                    <Image
                        src={show.show_image_key}
                        alt={formData.show_name}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: "50% 35%" }}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                        <Ticket className="w-16 h-16 text-primary/20 mb-4" />
                        <span className="text-muted-foreground font-medium italic">NO PRODUCTION ASSET</span>
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-8 right-8 flex justify-between items-end">
                    <div className="space-y-1">
                        <h1 className="text-3xl md:text-4xl font-semibold text-white drop-shadow-md">
                            {formData.show_name}
                        </h1>
                        <p className="text-white/80 font-medium flex items-center gap-2 drop-shadow-sm">
                            <MapPin className="w-4 h-4" />
                            {formData.venue}
                        </p>
                    </div>
                    <Badge
                        variant="outline"
                        style={{
                            backgroundColor: STATUS_COLORS[formData.show_status] || "#6B7280",
                            color: "white",
                            borderColor: "transparent"
                        }}
                        className="shadow-xl font-bold italic px-4 py-1.5 text-sm uppercase tracking-wider"
                    >
                        {formData.show_status.replace('_', ' ')}
                    </Badge>
                </div>
            </div>

            <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
                {/* 2. Primary Details Section */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-sidebar-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg md:text-xl font-semibold">Show Information</CardTitle>
                            <CardDescription>Update the primary details of the production.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground">Show Name</Label>
                                    <Input
                                        id="name"
                                        value={formData.show_name}
                                        onChange={(e) => setFormData({ ...formData, show_name: e.target.value })}
                                        className="font-medium bg-muted/30 focus-visible:ring-primary/20"
                                        disabled={!isEditing}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status" className="text-xs font-semibold text-muted-foreground">Current Status</Label>
                                    {isEditing ? (
                                        <Select
                                            value={formData.show_status}
                                            onValueChange={(value) =>
                                                setFormData({ ...formData, show_status: value as ShowStatus })
                                            }
                                        >
                                            <SelectTrigger id="status" className="h-9 w-full font-medium">
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.keys(STATUS_COLORS).map((status) => (
                                                    <SelectItem key={status} value={status}>
                                                        {status.replace("_", " ")}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Input
                                            id="status"
                                            value={formData.show_status}
                                            disabled
                                            className="font-medium bg-muted/20 opacity-60 italic"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground">Production Description</Label>
                                <textarea
                                    id="description"
                                    value={formData.show_description}
                                    onChange={(e) => setFormData({ ...formData, show_description: e.target.value })}
                                    rows={4}
                                    className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 font-medium"
                                    disabled={!isEditing}
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="venue" className="text-xs font-semibold text-muted-foreground">Venue</Label>
                                    <Input
                                        id="venue"
                                        value={formData.venue}
                                        onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                                        className="font-medium bg-muted/30"
                                        disabled={!isEditing}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address" className="text-xs font-semibold text-muted-foreground">Full Address</Label>
                                    <Input
                                        id="address"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="font-medium bg-muted/30"
                                        disabled={!isEditing}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground">Start Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-medium bg-muted/30",
                                                    !formData.show_start_date && "text-muted-foreground"
                                                )}
                                                disabled={!isEditing}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                {formData.show_start_date ? formatManilaDate(formData.show_start_date) : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={formData.show_start_date}
                                                onSelect={(date) => {
                                                    if (!isEditing) return;
                                                    if (date) {
                                                        setFormData({ ...formData, show_start_date: date });
                                                    }
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-muted-foreground">End Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-medium bg-muted/30",
                                                    !formData.show_end_date && "text-muted-foreground"
                                                )}
                                                disabled={!isEditing}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                {formData.show_end_date ? formatManilaDate(formData.show_end_date) : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={formData.show_end_date}
                                                onSelect={(date) => {
                                                    if (!isEditing) return;
                                                    if (date) {
                                                        setFormData({ ...formData, show_end_date: date });
                                                    }
                                                }}
                                                initialFocus
                                                disabled={(date) => date < formData.show_start_date}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="seatmap" className="text-xs font-semibold text-muted-foreground">Seatmap</Label>
                                {isEditing ? (
                                    <Combobox
                                        value={formData.seatmap_id}
                                        onValueChange={(value) => {
                                            const nextValue = value ?? "";
                                            setFormData({ ...formData, seatmap_id: nextValue });
                                            const match = seatmaps.find((seatmap) => seatmap.seatmap_id === nextValue);
                                            if (match) {
                                                setSeatmapQuery(match.seatmap_name);
                                            }
                                        }}
                                    >
                                        <ComboboxInput
                                            id="seatmap"
                                            placeholder="Select a seatmap"
                                            value={seatmapQuery}
                                            onChange={(event) => setSeatmapQuery(event.target.value)}
                                        />
                                        <ComboboxContent>
                                            <ComboboxList>
                                                {filteredSeatmaps.map((seatmap) => (
                                                    <ComboboxItem key={seatmap.seatmap_id} value={seatmap.seatmap_id}>
                                                        {seatmap.seatmap_name}
                                                    </ComboboxItem>
                                                ))}
                                                {seatmaps.length === 0 && (
                                                    <ComboboxEmpty>No seatmaps found.</ComboboxEmpty>
                                                )}
                                            </ComboboxList>
                                        </ComboboxContent>
                                    </Combobox>
                                ) : (
                                    <Input
                                        id="seatmap"
                                        value={seatmaps.find(s => s.seatmap_id === formData.seatmap_id)?.seatmap_name || "Unassigned"}
                                        disabled
                                        className="font-medium bg-muted/20 opacity-60 italic"
                                    />
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Performance Schedule Section */}
                    <Card className="border-sidebar-border shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg md:text-xl font-semibold">Performance Schedule</CardTitle>
                                <CardDescription>Manage show dates and times.</CardDescription>
                            </div>
                            {isEditing && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsScheduleOpen(true)}
                                    className="gap-2"
                                >
                                    <Clock className="h-4 w-4" />
                                    Add Schedule
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {Object.entries(
                                [...(formData.scheds || [])]
                                    .sort((a, b) => toDateValue(a.sched_date).getTime() - toDateValue(b.sched_date).getTime())
                                    .reduce((acc, sched) => {
                                        const dateKey = toManilaDateKey(toDateValue(sched.sched_date));
                                        if (!acc[dateKey]) acc[dateKey] = [];
                                        acc[dateKey].push(sched);
                                        return acc;
                                    }, {} as Record<string, typeof formData.scheds>)
                            ).map(([dateKey, scheds]) => (
                                <div key={dateKey} className="space-y-3">
                                    <h4 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                                        <CalendarIcon className="w-4 h-4 text-primary" />
                                        {formatManilaDateLong(new Date(`${dateKey}T00:00:00+08:00`))}
                                    </h4>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {scheds
                                            .sort((a, b) => toTimeValue(a.sched_start_time).getTime() - toTimeValue(b.sched_start_time).getTime())
                                            .map((sched, idx) => (
                                                <div
                                                    key={sched.sched_id || `new-${idx}`}
                                                    className="flex items-center justify-between p-3 rounded-lg border border-sidebar-border/60 bg-muted/20"
                                                >
                                                    <div className="space-y-1">
                                                        <div className="text-sm font-medium flex items-center gap-2">
                                                            {formatManilaTime(toTimeValue(sched.sched_start_time))}
                                                            <span className="text-muted-foreground">-</span>
                                                            {formatManilaTime(toTimeValue(sched.sched_end_time))}
                                                        </div>
                                                    </div>
                                                    {isEditing && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                            onClick={() => {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    scheds: prev.scheds.filter(s => s !== sched)
                                                                }));
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ))}
                            {(!formData.scheds || formData.scheds.length === 0) && (
                                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                                    No schedules found.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 4. Seatmap & Category Management Section - Display when seatmap exists */}
                    {formData.seatmap_id && (
                        <Card className="border-sidebar-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg md:text-xl font-semibold">
                                    Category Management
                                </CardTitle>
                                <CardDescription>
                                    {isEditing
                                        ? "Manage pricing categories and seat assignments for schedules."
                                        : "View pricing categories and seat assignments."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Seatmap Preview with Tabs */}
                                {categorySets.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-8 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            {isEditing
                                                ? "Add a category set below to start assigning seats."
                                                : "No category sets configured for this show."}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3 w-full">
                                        {/* Tab Navigation */}
                                        <div className="flex w-fit max-w-full justify-start overflow-x-auto rounded-lg bg-muted p-1">
                                            {categorySets.map((setItem, index) => {
                                                const isActive = (activeSetId ?? categorySets[0]?.id) === setItem.id;
                                                return (
                                                    <button
                                                        key={setItem.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setActiveSetId(setItem.id);
                                                            setSelectedSeatIds([]);
                                                        }}
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

                                        {/* Active Content */}
                                        {(() => {
                                            const activeSet = categorySets.find(
                                                (s) => s.id === (activeSetId ?? categorySets[0]?.id)
                                            );

                                            if (!activeSet) return null;

                                            const setCategories = activeSet.categories.map((category) => ({
                                                category_id: category.id,
                                                name: category.category_name,
                                                color_code: category.color_code,
                                            }));

                                            const currentAssignments = activeSet.seatAssignments || {};

                                            return (
                                                <div className="relative mt-1">
                                                    <SeatmapPreview
                                                        seatmapId={formData.seatmap_id || undefined}
                                                        allowMarqueeSelection={isEditing}
                                                        selectedSeatIds={isEditing ? selectedSeatIds : []}
                                                        onSelectionChange={isEditing ? setSelectedSeatIds : undefined}
                                                        categories={setCategories}
                                                        seatCategories={currentAssignments}
                                                        onSeatCategoriesChange={isEditing ? (newAssignments) =>
                                                            updateSetSeatAssignments(activeSet.id, newAssignments)
                                                        : undefined}
                                                    />
                                                    {isEditing && (
                                                        <CategoryAssignPanel
                                                            className="absolute right-3 top-14 z-10"
                                                            selectedSeatIds={selectedSeatIds}
                                                            categories={setCategories}
                                                            seatCategories={currentAssignments}
                                                            onAssign={(seatIds, categoryId) => {
                                                                updateSetSeatAssignments(activeSet.id, (prev) => {
                                                                    const next = { ...prev };
                                                                    seatIds.forEach((id) => {
                                                                        next[id] = categoryId;
                                                                    });
                                                                    return next;
                                                                });
                                                            }}
                                                            onClear={(seatIds) => {
                                                                updateSetSeatAssignments(activeSet.id, (prev) => {
                                                                    const next = { ...prev };
                                                                    seatIds.forEach((id) => {
                                                                        delete next[id];
                                                                    });
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Category Sets Management - Only show when editing */}
                                {isEditing && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold">Category Sets</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Define pricing tiers and assign them to schedules.
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={addCategorySet}
                                                className="gap-1.5"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                Add Category Set
                                            </Button>
                                        </div>

                                        {categorySets.length === 0 && (
                                            <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-6 text-sm text-muted-foreground">
                                                No category sets yet. Add one to start pricing.
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            {categorySets.map((setItem, index) => (
                                                <div key={setItem.id} className="rounded-lg border border-sidebar-border/60 p-4 space-y-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="space-y-1 w-full">
                                                            <p className="text-sm font-semibold">Category Set {index + 1}</p>
                                                            <div className="space-y-2 max-w-xs">
                                                                <Label className="text-[11px] font-semibold text-muted-foreground">Set Name</Label>
                                                                <Input
                                                                    value={setItem.set_name}
                                                                    onChange={(e) => updateCategorySet(setItem.id, { set_name: e.target.value })}
                                                                    placeholder="e.g. Premiere Set"
                                                                    className="h-8 text-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 text-destructive hover:bg-destructive/10"
                                                            onClick={() => removeCategorySet(setItem.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>

                                                    {/* Categories in this set */}
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-xs font-semibold text-muted-foreground">Categories in this set</p>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                className="gap-1.5"
                                                                onClick={() => addCategoryToSet(setItem.id)}
                                                            >
                                                                <Plus className="h-3.5 w-3.5" />
                                                                Add Category
                                                            </Button>
                                                        </div>

                                                        {setItem.categories.length === 0 && (
                                                            <div className="rounded-lg border border-dashed border-sidebar-border px-3 py-4 text-xs text-muted-foreground">
                                                                Add at least one category to define pricing.
                                                            </div>
                                                        )}

                                                        {setItem.categories.map((category) => (
                                                            <div key={category.id} className="flex items-start gap-3">
                                                                <div className="grid gap-3 md:grid-cols-[1.2fr_0.6fr_0.8fr] w-full">
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[11px] font-semibold text-muted-foreground">Category Name</Label>
                                                                        <Input
                                                                            value={category.category_name}
                                                                            onChange={(e) =>
                                                                                updateCategoryInSet(setItem.id, category.id, { category_name: e.target.value })
                                                                            }
                                                                            placeholder="e.g. VIP"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[11px] font-semibold text-muted-foreground">Price</Label>
                                                                        <Input
                                                                            value={category.price}
                                                                            onChange={(e) => {
                                                                                const next = e.target.value;
                                                                                if (next !== "" && !/^\d{0,4}(\.\d{0,2})?$/.test(next)) return;
                                                                                updateCategoryInSet(setItem.id, category.id, { price: next });
                                                                            }}
                                                                            onBlur={() => {
                                                                                const raw = String(category.price ?? "").trim();
                                                                                const normalizedValue = raw === "" ? 0 : Number(raw);
                                                                                if (Number.isNaN(normalizedValue)) {
                                                                                    updateCategoryInSet(setItem.id, category.id, { price: "0.00" });
                                                                                    return;
                                                                                }
                                                                                const clamped = Math.min(Math.max(normalizedValue, 0), 9999.99);
                                                                                updateCategoryInSet(setItem.id, category.id, { price: clamped.toFixed(2) });
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[11px] font-semibold text-muted-foreground">Color</Label>
                                                                        <Select
                                                                            value={category.color_code}
                                                                            onValueChange={(value) =>
                                                                                updateCategoryInSet(setItem.id, category.id, {
                                                                                    color_code: value as CategoryDraft["color_code"],
                                                                                })
                                                                            }
                                                                        >
                                                                            <SelectTrigger className="h-9 w-full">
                                                                                <SelectValue placeholder="Select color" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {COLOR_OPTIONS.map((option) => (
                                                                                    <SelectItem key={option.value} value={option.value}>
                                                                                        <span className="flex items-center gap-2">
                                                                                            {option.swatch ? (
                                                                                                <span
                                                                                                    className="h-2.5 w-2.5 rounded-full border border-border"
                                                                                                    style={{ backgroundColor: option.swatch }}
                                                                                                />
                                                                                            ) : (
                                                                                                <span className="h-2.5 w-2.5 rounded-full border border-border bg-transparent" />
                                                                                            )}
                                                                                            {option.label}
                                                                                        </span>
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-9 w-9 text-destructive hover:bg-destructive/10"
                                                                    onClick={() => removeCategoryFromSet(setItem.id, category.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    <Card className="border-sidebar-border shadow-md bg-primary/5 border-primary/10 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Clock className="w-24 h-24" />
                        </div>
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold">Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-sidebar-border/50">
                                <span className="text-xs font-semibold text-muted-foreground">Total Days</span>
                                <span className="font-black text-xl">
                                    {new Set(formData.scheds.map(s => {
                                        const d = toDateValue(s.sched_date);
                                        return toManilaDateKey(d);
                                    })).size}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-sidebar-border/50">
                                <span className="text-xs font-semibold text-muted-foreground">Total Shows</span>
                                <span className="font-black text-xl">{formData.scheds.length}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {isEditing ? (
                        <div className="grid gap-3">
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full h-12 font-black uppercase tracking-widest text-base shadow-xl shadow-primary/20"
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                                {isSaving ? "Saving changes..." : "Save Production"}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsEditing(false);
                                    setFormData({
                                        show_name: show.show_name,
                                        show_description: show.show_description,
                                        venue: show.venue,
                                        address: show.address,
                                        show_status: show.show_status,
                                        show_start_date: new Date(show.show_start_date),
                                        show_end_date: new Date(show.show_end_date),
                                        seatmap_id: show.seatmap_id || "",
                                        scheds: show.scheds || [],
                                    });
                                    setSelectedDates([]);
                                    setTimeRanges([{ id: `time-${uuidv4()}`, start: "19:00", end: "21:00" }]);
                                }}
                                disabled={isSaving}
                                className="w-full h-12 font-semibold uppercase tracking-widest text-base"
                            >
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            <Button
                                onClick={() => setIsEditing(true)}
                                className="w-full h-12 font-black uppercase tracking-widest text-base shadow-xl shadow-primary/20"
                            >
                                Edit Production
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => router.push("/admin/shows")}
                                className="w-full h-12 font-semibold uppercase tracking-widest text-base"
                            >
                                Back to Shows
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle>Add Schedules</DialogTitle>
                        <DialogDescription>
                            Select dates and times to add new performances.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
                        <div className="rounded-lg border p-3 flex justify-center md:block">
                            <Calendar
                                mode="multiple"
                                selected={selectedDates}
                                onSelect={(dates) => setSelectedDates(dates ?? [])}
                                numberOfMonths={1}
                                disabled={(date) => {
                                    const start = new Date(formData.show_start_date);
                                    const end = new Date(formData.show_end_date);
                                    return date < start || date > end;
                                }}
                                className="[--cell-size:--spacing(7)] text-xs"
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Time Ranges</Label>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {timeRanges.map((range) => (
                                        <div key={range.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                            <div className="grid gap-1">
                                                <Label className="text-[10px]">Start</Label>
                                                <Input
                                                    type="time"
                                                    value={range.start}
                                                    onChange={(e) => updateTimeRange(range.id, { start: e.target.value })}
                                                    className="h-8 text-xs"
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Label className="text-[10px]">End</Label>
                                                <Input
                                                    type="time"
                                                    value={range.end}
                                                    onChange={(e) => updateTimeRange(range.id, { end: e.target.value })}
                                                    className="h-8 text-xs"
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive"
                                                onClick={() => removeTimeRange(range.id)}
                                                disabled={timeRanges.length === 1}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <Button variant="outline" size="sm" onClick={addTimeRange} className="w-full mt-2">
                                    <Plus className="h-4 w-4 mr-2" /> Add Time Slot
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddSchedules}>Add Schedules</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
