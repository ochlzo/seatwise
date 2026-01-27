"use client";

import * as React from "react";
import { format, differenceInCalendarMonths } from "date-fns";
import { Plus, Trash2, Save, CalendarDays } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createShowAction } from "@/lib/actions/createShow";
import { Calendar } from "@/components/ui/calendar";
import { FileImagePreview } from "@/components/ui/file-uploader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_OPTIONS = [
  "DRAFT",
  "UPCOMING",
  "OPEN",
  "CLOSED",
  "ON_GOING",
  "CANCELLED",
  "POSTPONED",
];

type SchedDraft = {
  id: string;
  sched_date: string;
  sched_start_time: string;
  sched_end_time: string;
};

type TimeRangeDraft = {
  id: string;
  start: string;
  end: string;
};

type SeatmapOption = {
  seatmap_id: string;
  seatmap_name: string;
  updatedAt: string;
};

export function CreateShowForm() {
  const router = useRouter();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    show_name: "",
    show_description: "",
    venue: "",
    address: "",
    show_status: "DRAFT",
    show_start_date: "",
    show_end_date: "",
    seatmap_id: "",
  });
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [scheds, setScheds] = React.useState<SchedDraft[]>([]);
  const [selectedDates, setSelectedDates] = React.useState<Date[]>([]);
  const [applyToAllDates, setApplyToAllDates] = React.useState(false);
  const [seatmaps, setSeatmaps] = React.useState<SeatmapOption[]>([]);
  const [isLoadingSeatmaps, setIsLoadingSeatmaps] = React.useState(false);
  const [timeRanges, setTimeRanges] = React.useState<TimeRangeDraft[]>([
    { id: `time-${uuidv4()}`, start: "19:00", end: "21:00" },
  ]);

  React.useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  React.useEffect(() => {
    let isMounted = true;
    const loadSeatmaps = async () => {
      try {
        setIsLoadingSeatmaps(true);
        const response = await fetch("/api/seatmaps");
        if (!response.ok) {
          throw new Error("Failed to load seatmaps");
        }
        const data = await response.json();
        if (!isMounted) return;
        setSeatmaps(data.seatmaps ?? []);
      } catch (error: any) {
        if (!isMounted) return;
        toast.error(error.message || "Unable to load seatmaps");
      } finally {
        if (isMounted) {
          setIsLoadingSeatmaps(false);
        }
      }
    };
    loadSeatmaps();
    return () => {
      isMounted = false;
    };
  }, []);

  const showStartDate = formData.show_start_date
    ? new Date(`${formData.show_start_date}T00:00:00`)
    : null;
  const showEndDate = formData.show_end_date
    ? new Date(`${formData.show_end_date}T00:00:00`)
    : null;
  const isDateRangeValid =
    showStartDate &&
    showEndDate &&
    showStartDate.getTime() <= showEndDate.getTime();
  const numberOfMonths =
    showStartDate && showEndDate && differenceInCalendarMonths(showEndDate, showStartDate) >= 1
      ? 2
      : 1;

  const getDatesInRange = React.useCallback(() => {
    if (!showStartDate || !showEndDate) return [];
    const dates: Date[] = [];
    const cursor = new Date(showStartDate);
    while (cursor <= showEndDate) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [showStartDate, showEndDate]);

  React.useEffect(() => {
    if (applyToAllDates) {
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
  }, [applyToAllDates, getDatesInRange]);

  const removeSched = (id: string) => {
    setScheds((prev) => prev.filter((s) => s.id !== id));
  };

  const addTimeRange = () => {
    setTimeRanges((prev) => [
      ...prev,
      { id: `time-${uuidv4()}`, start: "19:00", end: "21:00" },
    ]);
  };

  const updateTimeRange = (id: string, patch: Partial<TimeRangeDraft>) => {
    setTimeRanges((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
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

    const newEntries: SchedDraft[] = [];
    selectedDates.forEach((date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      validRanges.forEach((range) => {
        newEntries.push({
          id: `new-${uuidv4()}`,
          sched_date: dateKey,
          sched_start_time: range.start,
          sched_end_time: range.end,
        });
      });
    });

    setScheds((prev) => [...prev, ...newEntries]);
    setSelectedDates([]);
    setTimeRanges([{ id: `time-${uuidv4()}`, start: "19:00", end: "21:00" }]);
    setIsScheduleOpen(false);
  };

  const handleSave = async () => {
    if (
      !formData.show_name ||
      !formData.show_description ||
      !formData.venue ||
      !formData.address ||
      !formData.show_start_date ||
      !formData.show_end_date
    ) {
      toast.error("Please fill out all required fields.");
      return;
    }

    const validScheds = scheds.filter(
      (s) => s.sched_date && s.sched_start_time && s.sched_end_time
    );

    let imageBase64: string | undefined;
    if (imageFile) {
      imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(imageFile);
      });
    }

    setIsSaving(true);
    // @ts-ignore
    const result = await createShowAction({
      ...formData,
      seatmap_id: formData.seatmap_id || null,
      scheds: validScheds,
      image_base64: imageBase64,
    });
    setIsSaving(false);

    if (!result.success) {
      toast.error(result.error || "Failed to create show");
      return;
    }

    toast.success("Show created successfully");
    router.push(`/admin/shows/${result.showId}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <Card className="border-sidebar-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl font-semibold">
            Show Details
          </CardTitle>
          <CardDescription>Set up a new production.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="show-name" className="text-xs font-semibold text-muted-foreground">
                Show Name
              </Label>
              <Input
                id="show-name"
                value={formData.show_name}
                onChange={(e) => setFormData({ ...formData, show_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="show-status" className="text-xs font-semibold text-muted-foreground">
                Status
              </Label>
              <select
                id="show-status"
                value={formData.show_status}
                onChange={(e) => setFormData({ ...formData, show_status: e.target.value })}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="show-description" className="text-xs font-semibold text-muted-foreground">
              Production Description
            </Label>
            <textarea
              id="show-description"
              value={formData.show_description}
              onChange={(e) => setFormData({ ...formData, show_description: e.target.value })}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venue" className="text-xs font-semibold text-muted-foreground">
                Venue
              </Label>
              <Input
                id="venue"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="text-xs font-semibold text-muted-foreground">
                Full Address
              </Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-xs font-semibold text-muted-foreground">
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={formData.show_start_date}
                onChange={(e) => setFormData({ ...formData, show_start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-xs font-semibold text-muted-foreground">
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={formData.show_end_date}
                onChange={(e) => setFormData({ ...formData, show_end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seatmap" className="text-xs font-semibold text-muted-foreground">
              Seatmap
            </Label>
            <select
              id="seatmap"
              value={formData.seatmap_id}
              onChange={(e) => setFormData({ ...formData, seatmap_id: e.target.value })}
              className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 font-medium"
              disabled={isLoadingSeatmaps}
            >
              <option value="">Select a seatmap (optional)</option>
              {seatmaps.map((seatmap) => (
                <option key={seatmap.seatmap_id} value={seatmap.seatmap_id}>
                  {seatmap.seatmap_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              Show Image
            </Label>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="show-image-upload"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("show-image-upload")?.click()}
                >
                  Upload Image
                </Button>
                {imageFile && (
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {imageFile.name}
                  </span>
                )}
              </div>
              {imagePreview && (
                <div className="flex items-center gap-2">
                  <FileImagePreview src={imagePreview} alt="Show preview" className="size-12 md:size-14" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-sidebar-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg md:text-xl font-semibold">
              Schedule
            </CardTitle>
            <CardDescription>Add performance dates and times.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsScheduleOpen(true)}
            className="gap-2"
            disabled={!isDateRangeValid}
          >
            <CalendarDays className="h-4 w-4" />
            Add Schedule
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {scheds.length === 0 && (
            <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-6 text-sm text-muted-foreground">
              No schedules yet. Add at least one if you want predefined showtimes.
            </div>
          )}
          {scheds.map((s) => (
            <div
              key={s.id}
              className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] items-end rounded-lg border border-sidebar-border/60 p-3"
            >
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Date
                </Label>
                <Input
                  type="date"
                  value={s.sched_date}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Starts
                </Label>
                <Input
                  type="time"
                  value={s.sched_start_time}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Ends
                </Label>
                <Input
                  type="time"
                  value={s.sched_end_time}
                  readOnly
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-destructive hover:bg-destructive/10"
                onClick={() => removeSched(s.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

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
                disabled={(date) => {
                  if (!showStartDate || !showEndDate) return true;
                  return date < showStartDate || date > showEndDate;
                }}
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

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? "Creating..." : "Create Show"}
        </Button>
      </div>
    </div>
  );
}
