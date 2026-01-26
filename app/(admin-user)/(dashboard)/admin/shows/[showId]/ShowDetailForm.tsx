"use client";

import * as React from "react";
import { format, differenceInDays, addDays, isSameDay, differenceInCalendarMonths } from "date-fns";
import { CalendarIcon, MapPin, Ticket, Clock, Plus, Trash2, Save, Loader2, CalendarDays } from "lucide-react";
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
import { updateShowAction } from "@/lib/actions/updateShow";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const STATUS_COLORS: Record<string, string> = {
    UPCOMING: "#3B82F6",
    DRAFT: "#64748B",
    OPEN: "#22C55E",
    CLOSED: "#6B7280",
    ON_GOING: "#F59E0B",
    CANCELLED: "#EF4444",
    POSTPONED: "#A855F7",
};

interface ShowDetailFormProps {
    show: any;
}

export function ShowDetailForm({ show }: ShowDetailFormProps) {
    const router = useRouter();
    const [isSaving, setIsSaving] = React.useState(false);
    const [isScheduleOpen, setIsScheduleOpen] = React.useState(false);
    const [formData, setFormData] = React.useState({
        show_name: show.show_name,
        show_description: show.show_description,
        venue: show.venue,
        address: show.address,
        show_status: show.show_status,
        show_start_date: new Date(show.show_start_date),
        show_end_date: new Date(show.show_end_date),
    });

    const [scheds, setScheds] = React.useState(
        show.scheds.map((s: any) => ({
            ...s,
            sched_date: format(new Date(s.sched_date), "yyyy-MM-dd"),
            sched_start_time: format(new Date(s.sched_start_time), "HH:mm"),
            sched_end_time: format(new Date(s.sched_end_time), "HH:mm"),
        }))
    );
    const [selectedDates, setSelectedDates] = React.useState<Date[]>([]);
    const [applyToAllDates, setApplyToAllDates] = React.useState(false);
    const [timeRanges, setTimeRanges] = React.useState([
        { id: `time-${Date.now()}`, start: "19:00", end: "21:00" },
    ]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateShowAction(show.show_id, {
                ...formData,
                scheds,
            });

            if (result.success) {
                toast.success("Show updated successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to update show");
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    // Calculate dates in range
    const daysInRange = React.useMemo(() => {
        const days = [];
        const start = formData.show_start_date;
        const end = formData.show_end_date;
        const diff = differenceInDays(end, start);

        for (let i = 0; i <= diff; i++) {
            days.push(addDays(start, i));
        }
        return days;
    }, [formData.show_start_date, formData.show_end_date]);

    const removeSched = (id: string) => {
        setScheds(scheds.filter((s: any) => s.sched_id !== id));
    };

    const addTimeRange = () => {
        setTimeRanges((prev) => [
            ...prev,
            { id: `time-${Date.now()}`, start: "19:00", end: "21:00" },
        ]);
    };

    const updateTimeRange = (id: string, patch: { start?: string; end?: string }) => {
        setTimeRanges((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    };

    const removeTimeRange = (id: string) => {
        setTimeRanges((prev) => prev.filter((t) => t.id !== id));
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

        const newEntries: any[] = [];
        selectedDates.forEach((date) => {
            const dateKey = format(date, "yyyy-MM-dd");
            validRanges.forEach((range) => {
                newEntries.push({
                    sched_id: `new-${dateKey}-${range.start}-${range.end}-${Date.now()}`,
                    sched_date: dateKey,
                    sched_start_time: range.start,
                    sched_end_time: range.end,
                });
            });
        });

        setScheds((prev: any) => [...prev, ...newEntries]);
        setSelectedDates([]);
        setTimeRanges([{ id: `time-${Date.now()}`, start: "19:00", end: "21:00" }]);
        setIsScheduleOpen(false);
    };

    const isDateRangeValid =
        formData.show_start_date &&
        formData.show_end_date &&
        formData.show_start_date.getTime() <= formData.show_end_date.getTime();
    const numberOfMonths =
        differenceInCalendarMonths(formData.show_end_date, formData.show_start_date) >= 1 ? 2 : 1;

    const getDatesInRange = React.useCallback(() => {
        const dates: Date[] = [];
        const cursor = new Date(formData.show_start_date);
        while (cursor <= formData.show_end_date) {
            dates.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        return dates;
    }, [formData.show_start_date, formData.show_end_date]);

    React.useEffect(() => {
        if (applyToAllDates && isDateRangeValid) {
            const nextDates = getDatesInRange();
            setSelectedDates((prev) => {
                if (prev.length !== nextDates.length) return nextDates;
                for (let i = 0; i < prev.length; i += 1) {
                    if (prev[i].getTime() !== nextDates[i].getTime()) {
                        return nextDates;
                    }
                }
                return prev;
            });
        }
    }, [applyToAllDates, getDatesInRange, isDateRangeValid]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* 1. Banner Section */}
            <div className="relative aspect-[21/9] md:aspect-[3/1] bg-muted overflow-hidden rounded-xl border border-sidebar-border shadow-2xl">
                {show.show_image_key ? (
                    <img
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
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status" className="text-xs font-semibold text-muted-foreground">Current Status</Label>
                                    <Input
                                        id="status"
                                        value={formData.show_status}
                                        disabled
                                        className="font-medium bg-muted/20 opacity-60 italic"
                                    />
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
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address" className="text-xs font-semibold text-muted-foreground">Full Address</Label>
                                    <Input
                                        id="address"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="font-medium bg-muted/30"
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
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                {formData.show_start_date ? format(formData.show_start_date, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={formData.show_start_date}
                                                onSelect={(date) => date && setFormData({ ...formData, show_start_date: date })}
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
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                                {formData.show_end_date ? format(formData.show_end_date, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={formData.show_end_date}
                                                onSelect={(date) => date && setFormData({ ...formData, show_end_date: date })}
                                                initialFocus
                                                disabled={(date) => date < formData.show_start_date}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Schedule Section */}
                    <Card className="border-sidebar-border shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg md:text-xl font-semibold">Production Schedule</CardTitle>
                            <CardDescription>Manage daily showtimes for the entire production run.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            {daysInRange.map((date, idx) => {
                                const dayScheds = scheds.filter((s: any) => isSameDay(new Date(s.sched_date), date));
                                return (
                                    <div key={idx} className="space-y-4 pb-6 border-b border-sidebar-border last:border-0 last:pb-0">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <h3 className="text-sm font-semibold">
                                                    {format(date, "EEEE, MMMM do")}
                                                </h3>
                                                <p className="text-[10px] text-muted-foreground font-semibold">Day {idx + 1}</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsScheduleOpen(true)}
                                                className="h-8 gap-1.5 text-[10px] font-semibold"
                                                disabled={!isDateRangeValid}
                                            >
                                                <CalendarDays className="w-3 h-3" />
                                                Add Schedule
                                            </Button>
                                        </div>

                                        <div className="grid gap-3">
                                            {dayScheds.map((s: any) => (
                                                <div
                                                    key={s.sched_id}
                                                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg group/sched border border-sidebar-border/50"
                                                >
                                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Starts</Label>
                                                            <Input
                                                                type="time"
                                                                className="h-9 bg-background"
                                                                value={s.sched_start_time}
                                                                readOnly
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Ends</Label>
                                                            <Input
                                                                type="time"
                                                                className="h-9 bg-background"
                                                                value={s.sched_end_time}
                                                                readOnly
                                                            />
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                        onClick={() => removeSched(s.sched_id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {dayScheds.length === 0 && (
                                                <div className="p-4 rounded-lg bg-muted/20 border border-dashed border-sidebar-border flex items-center justify-center">
                                                    <p className="text-xs text-muted-foreground italic font-medium">No schedules set for this day.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>

                {/* 4. Sidebar Stats */}
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
                                <span className="font-black text-xl">{daysInRange.length}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-sidebar-border/50">
                                <span className="text-xs font-semibold text-muted-foreground">Total Shows</span>
                                <span className="font-black text-xl">{scheds.length}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl shadow-primary/20"
                    >
                        {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6 mr-2" />}
                        {isSaving ? "Saving changes..." : "Save Production"}
                    </Button>
                </div>
            </div>

            <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="text-sm sm:text-lg">Add schedules</DialogTitle>
                        <DialogDescription className="text-[11px] sm:text-sm">
                            Select dates within the show range, then add one or more time ranges.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 md:gap-6 md:grid-cols-[1.1fr_1fr]">
                        <div className="rounded-lg border border-sidebar-border/60 p-3 flex justify-center md:block">
                            <Calendar
                                mode="multiple"
                                selected={selectedDates}
                                onSelect={(dates) => setSelectedDates(dates ?? [])}
                                numberOfMonths={numberOfMonths}
                                disabled={(date) =>
                                    date < formData.show_start_date || date > formData.show_end_date
                                }
                                className="[--cell-size:--spacing(7)] text-xs"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold">Time ranges</p>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                                        <input
                                            type="checkbox"
                                            className="h-3.5 w-3.5 accent-primary"
                                            checked={applyToAllDates}
                                            onChange={(e) => {
                                                const next = e.target.checked;
                                                setApplyToAllDates(next);
                                                if (next) {
                                                    setSelectedDates(getDatesInRange());
                                                }
                                            }}
                                            disabled={!isDateRangeValid}
                                        />
                                        Apply to all dates
                                    </label>
                                    <Button variant="outline" size="sm" onClick={addTimeRange} className="gap-1.5">
                                        <Plus className="h-3.5 w-3.5" />
                                        Add time
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="grid grid-cols-[1fr_1fr_auto] items-center text-[11px] font-semibold text-muted-foreground px-3">
                                    <span>Starts</span>
                                    <span>Ends</span>
                                    <span className="sr-only">Actions</span>
                                </div>
                                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                    {timeRanges.map((range) => (
                                        <div
                                            key={range.id}
                                            className="grid gap-2 grid-cols-[1fr_1fr_auto] items-end rounded-lg border border-sidebar-border/60 p-2"
                                        >
                                            <div className="space-y-2">
                                                <Input
                                                    type="time"
                                                    value={range.start}
                                                    className="h-8 text-xs sm:h-9 sm:text-sm"
                                                    onChange={(e) => updateTimeRange(range.id, { start: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Input
                                                    type="time"
                                                    value={range.end}
                                                    className="h-8 text-xs sm:h-9 sm:text-sm"
                                                    onChange={(e) => updateTimeRange(range.id, { end: e.target.value })}
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                onClick={() => removeTimeRange(range.id)}
                                                disabled={timeRanges.length === 1}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddSchedules}>
                            Add schedules
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
