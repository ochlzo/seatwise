"use client";

import * as React from "react";
import { format, differenceInDays, addDays, isSameDay } from "date-fns";
import { CalendarIcon, MapPin, Ticket, Clock, Plus, Trash2, Save, Loader2 } from "lucide-react";
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
            sched_start_time: new Date(s.sched_start_time),
            sched_end_time: new Date(s.sched_end_time),
        }))
    );

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

    const addSched = (date: Date) => {
        const start = new Date(date);
        start.setHours(19, 0, 0, 0); // Default 7pm
        const end = new Date(date);
        end.setHours(21, 0, 0, 0); // Default 9pm

        setScheds([...scheds, {
            sched_id: `new-${Date.now()}`,
            sched_start_time: start,
            sched_end_time: end,
        }]);
    };

    const removeSched = (id: string) => {
        setScheds(scheds.filter((s: any) => s.sched_id !== id));
    };

    const updateSched = (id: string, start: Date, end: Date) => {
        setScheds(scheds.map((s: any) =>
            s.sched_id === id
                ? { ...s, sched_start_time: start, sched_end_time: end }
                : s
        ));
    };

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
                                const dayScheds = scheds.filter((s: any) => isSameDay(new Date(s.sched_start_time), date));
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
                                                onClick={() => addSched(date)}
                                                className="h-8 gap-1.5 text-[10px] font-semibold"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Add Time
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
                                                                value={format(s.sched_start_time, "HH:mm")}
                                                                onChange={(e) => {
                                                                    const [h, m] = e.target.value.split(':').map(Number);
                                                                    const newStart = new Date(s.sched_start_time);
                                                                    newStart.setHours(h, m);
                                                                    updateSched(s.sched_id, newStart, s.sched_end_time);
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[9px] font-semibold text-muted-foreground ml-1">Ends</Label>
                                                            <Input
                                                                type="time"
                                                                className="h-9 bg-background"
                                                                value={format(s.sched_end_time, "HH:mm")}
                                                                onChange={(e) => {
                                                                    const [h, m] = e.target.value.split(':').map(Number);
                                                                    const newEnd = new Date(s.sched_end_time);
                                                                    newEnd.setHours(h, m);
                                                                    updateSched(s.sched_id, s.sched_start_time, newEnd);
                                                                }}
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
        </div>
    );
}
