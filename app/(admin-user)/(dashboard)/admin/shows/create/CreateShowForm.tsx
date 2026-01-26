"use client";

import * as React from "react";
import { format, differenceInCalendarMonths } from "date-fns";
import { Plus, Trash2, Save, CalendarDays } from "lucide-react";
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
  seatmap_id?: string | null;
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
  });
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [scheds, setScheds] = React.useState<SchedDraft[]>([]);
  const [selectedDates, setSelectedDates] = React.useState<Date[]>([]);
  const [applyToAllDates, setApplyToAllDates] = React.useState(false);
  const [seatmaps, setSeatmaps] = React.useState<SeatmapOption[]>([]);
  const [isSeatmapOpen, setIsSeatmapOpen] = React.useState(false);
  const [isManualSeatmapOpen, setIsManualSeatmapOpen] = React.useState(false);
  const [selectedSeatmapId, setSelectedSeatmapId] = React.useState<string | null>(null);
  const [manualSeatmapId, setManualSeatmapId] = React.useState<string | null>(null);
  const [selectedSchedIds, setSelectedSchedIds] = React.useState<string[]>([]);
  const [scheduleFilterStart, setScheduleFilterStart] = React.useState("");
  const [scheduleFilterEnd, setScheduleFilterEnd] = React.useState("");
  const [isLoadingSeatmaps, setIsLoadingSeatmaps] = React.useState(false);
  const [timeRanges, setTimeRanges] = React.useState<TimeRangeDraft[]>([
    { id: `time-${Date.now()}`, start: "19:00", end: "21:00" },
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
    setSelectedSchedIds((prev) => prev.filter((schedId) => schedId !== id));
  };

  const addTimeRange = () => {
    setTimeRanges((prev) => [
      ...prev,
      { id: `time-${Date.now()}`, start: "19:00", end: "21:00" },
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
          id: `new-${dateKey}-${range.start}-${range.end}-${Date.now()}`,
          sched_date: dateKey,
          sched_start_time: range.start,
          sched_end_time: range.end,
        });
      });
    });

    setScheds((prev) => [...prev, ...newEntries]);
    setSelectedDates([]);
    setTimeRanges([{ id: `time-${Date.now()}`, start: "19:00", end: "21:00" }]);
    setIsScheduleOpen(false);
  };

  const handleApplySeatmapToAll = () => {
    if (!selectedSeatmapId) {
      toast.error("Select a seatmap to apply.");
      return;
    }
    setScheds((prev) =>
      prev.map((sched) => ({ ...sched, seatmap_id: selectedSeatmapId }))
    );
    setIsSeatmapOpen(false);
  };

  const allSchedulesAssigned = React.useMemo(() => {
    if (scheds.length === 0) return true;
    return scheds.every((sched) => Boolean(sched.seatmap_id));
  }, [scheds]);

  const handleManualApply = () => {
    if (!manualSeatmapId) {
      toast.error("Select a seatmap to assign.");
      return;
    }
    if (!selectedSchedIds.length) {
      toast.error("Select at least one schedule.");
      return;
    }
    setScheds((prev) => {
      const next = prev.map((sched) =>
        selectedSchedIds.includes(sched.id)
          ? { ...sched, seatmap_id: manualSeatmapId }
          : sched
      );
      const hasUnassigned = next.some((sched) => !sched.seatmap_id);
      if (!hasUnassigned) {
        setIsManualSeatmapOpen(false);
      } else {
        toast.error("Assign a seatmap to every schedule before closing.");
      }
      return next;
    });
    setSelectedSchedIds([]);
  };

  const handleManualOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !allSchedulesAssigned) {
      toast.error("Assign a seatmap to every schedule before closing.");
      return;
    }
    setIsManualSeatmapOpen(nextOpen);
  };

  const seatmapNameById = React.useCallback(
    (seatmapId?: string | null) =>
      seatmaps.find((seatmap) => seatmap.seatmap_id === seatmapId)?.seatmap_name ??
      "Unassigned",
    [seatmaps]
  );

  const filteredSchedules = React.useMemo(() => {
    const start = scheduleFilterStart ? new Date(`${scheduleFilterStart}T00:00:00`) : null;
    const end = scheduleFilterEnd ? new Date(`${scheduleFilterEnd}T00:00:00`) : null;
    return scheds.filter((sched) => {
      const schedDate = new Date(`${sched.sched_date}T00:00:00`);
      if (start && schedDate < start) return false;
      if (end && schedDate > end) return false;
      return true;
    });
  }, [scheds, scheduleFilterStart, scheduleFilterEnd]);

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
    if (validScheds.length > 0 && validScheds.some((s) => !s.seatmap_id)) {
      toast.error("Assign a seatmap to every schedule before creating the show.");
      return;
    }

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
    const result = await createShowAction({
      ...formData,
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
              className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1.2fr_auto] items-end rounded-lg border border-sidebar-border/60 p-3"
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
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">
                  Seatmap
                </Label>
                <Input value={seatmapNameById(s.seatmap_id)} readOnly />
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

      <Card className="border-sidebar-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg md:text-xl font-semibold">
              Seatmaps
            </CardTitle>
            <CardDescription>
              Assign seatmaps to your schedules before saving.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSeatmapOpen(true)}
            className="gap-2"
            disabled={!scheds.length || isLoadingSeatmaps}
          >
            Add Seatmap
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!scheds.length && (
            <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-6 text-sm text-muted-foreground">
              Add schedules before assigning seatmaps.
            </div>
          )}
          {scheds.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {scheds.filter((s) => s.seatmap_id).length} of {scheds.length} schedules assigned.
            </div>
          )}
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

      <Dialog open={isSeatmapOpen} onOpenChange={setIsSeatmapOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg">Assign seatmap</DialogTitle>
            <DialogDescription className="text-[11px] sm:text-sm">
              Choose a seatmap to apply to all schedules or assign manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {seatmaps.length === 0 && (
              <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-6 text-sm text-muted-foreground">
                No active seatmaps found.
              </div>
            )}
            {seatmaps.map((seatmap) => (
              <div
                key={seatmap.seatmap_id}
                className="flex items-center gap-3 rounded-lg border border-sidebar-border/60 p-3"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={selectedSeatmapId === seatmap.seatmap_id}
                  onChange={() => {
                    setSelectedSeatmapId(
                      selectedSeatmapId === seatmap.seatmap_id ? null : seatmap.seatmap_id
                    );
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{seatmap.seatmap_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {format(new Date(seatmap.updatedAt), "PP")}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setIsSeatmapOpen(false);
                setIsManualSeatmapOpen(true);
              }}
            >
              Assign manually
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsSeatmapOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApplySeatmapToAll}>
                Apply to all schedules
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isManualSeatmapOpen} onOpenChange={handleManualOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg">Assign seatmaps manually</DialogTitle>
            <DialogDescription className="text-[11px] sm:text-sm">
              Select a seatmap and match it with one or more schedules.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground">
                Seatmaps
              </div>
              <div className="space-y-2">
                {seatmaps.map((seatmap) => (
                  <div
                    key={seatmap.seatmap_id}
                    className="flex items-center gap-3 rounded-lg border border-sidebar-border/60 p-3"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={manualSeatmapId === seatmap.seatmap_id}
                      onChange={() => {
                        setManualSeatmapId(
                          manualSeatmapId === seatmap.seatmap_id ? null : seatmap.seatmap_id
                        );
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{seatmap.seatmap_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {format(new Date(seatmap.updatedAt), "PP")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs font-semibold text-muted-foreground">
                  Schedules
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>From</span>
                    <Input
                      type="date"
                      value={scheduleFilterStart}
                      onChange={(e) => setScheduleFilterStart(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>To</span>
                    <Input
                      type="date"
                      value={scheduleFilterEnd}
                      onChange={(e) => setScheduleFilterEnd(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {filteredSchedules.map((sched) => (
                  <div
                    key={sched.id}
                    className="flex items-center gap-3 rounded-lg border border-sidebar-border/60 p-3"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={selectedSchedIds.includes(sched.id)}
                      onChange={() => {
                        setSelectedSchedIds((prev) =>
                          prev.includes(sched.id)
                            ? prev.filter((id) => id !== sched.id)
                            : [...prev, sched.id]
                        );
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {format(new Date(`${sched.sched_date}T00:00:00`), "PP")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sched.sched_start_time} - {sched.sched_end_time}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {seatmapNameById(sched.seatmap_id)}
                    </span>
                  </div>
                ))}
              </div>
              {filteredSchedules.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No schedules match the current date filters.
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => handleManualOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualApply}>Apply</Button>
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
