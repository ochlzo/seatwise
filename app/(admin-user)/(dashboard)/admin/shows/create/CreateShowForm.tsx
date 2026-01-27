"use client";

import * as React from "react";
import { format, differenceInCalendarMonths } from "date-fns";
import { Plus, Trash2, Save, CalendarDays, CalendarIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";

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

type CategoryDraft = {
  id: string;
  category_name: string;
  price: string;
  color_code: "NO_COLOR" | "GOLD" | "PINK" | "BLUE" | "BURGUNDY" | "GREEN";
  apply_to_all: boolean;
  sched_ids: string[];
  filter_date: string;
};

const COLOR_OPTIONS: Array<{ value: CategoryDraft["color_code"]; label: string; swatch: string | null }> = [
  { value: "NO_COLOR", label: "No Color", swatch: null },
  { value: "GOLD", label: "Gold", swatch: "#ffd700" },
  { value: "PINK", label: "Pink", swatch: "#e005b9" },
  { value: "BLUE", label: "Blue", swatch: "#111184" },
  { value: "BURGUNDY", label: "Burgundy", swatch: "#800020" },
  { value: "GREEN", label: "Green", swatch: "#046307" },
];

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
  const [seatmapQuery, setSeatmapQuery] = React.useState("");
  const [timeRanges, setTimeRanges] = React.useState<TimeRangeDraft[]>([
    { id: `time-${uuidv4()}`, start: "19:00", end: "21:00" },
  ]);
  const [categories, setCategories] = React.useState<CategoryDraft[]>([]);
  const filteredSeatmaps = React.useMemo(() => {
    const query = seatmapQuery.trim().toLowerCase();
    if (!query) return seatmaps;
    const selected = seatmaps.find((seatmap) => seatmap.seatmap_id === formData.seatmap_id);
    if (selected && selected.seatmap_name.toLowerCase() === query) {
      return seatmaps;
    }
    return seatmaps.filter((seatmap) =>
      seatmap.seatmap_name.toLowerCase().includes(query)
    );
  }, [seatmapQuery, seatmaps, formData.seatmap_id]);
  const hasSeatmapSelected = Boolean(formData.seatmap_id);

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
      } catch (error: unknown) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "Unable to load seatmaps";
        toast.error(message);
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

  const showStartDate = React.useMemo(
    () =>
      formData.show_start_date
        ? new Date(`${formData.show_start_date}T00:00:00`)
        : null,
    [formData.show_start_date]
  );
  const showEndDate = React.useMemo(
    () =>
      formData.show_end_date
        ? new Date(`${formData.show_end_date}T00:00:00`)
        : null,
    [formData.show_end_date]
  );
  const isDateRangeValid =
    showStartDate &&
    showEndDate &&
    showStartDate.getTime() <= showEndDate.getTime();
  const numberOfMonths =
    showStartDate && showEndDate && differenceInCalendarMonths(showEndDate, showStartDate) >= 1
      ? 2
      : 1;
  const formatTime = React.useCallback((timeValue: string) => {
    if (!timeValue) return "";
    const date = new Date(`1970-01-01T${timeValue}:00`);
    if (Number.isNaN(date.getTime())) return timeValue;
    return format(date, "hh:mm a");
  }, []);
  const formatDateLabel = React.useCallback((dateValue: string) => {
    if (!dateValue) return "";
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateValue;
    return format(date, "PPP");
  }, []);
  const getAvailableScheds = React.useCallback((categoryId: string) => {
    const used = new Set<string>();
    categories.forEach((cat) => {
      if (cat.id === categoryId) return;
      if (cat.apply_to_all) {
        scheds.forEach((sched) => used.add(sched.id));
        return;
      }
      cat.sched_ids.forEach((id) => used.add(id));
    });
    return scheds.filter((sched) => !used.has(sched.id));
  }, [categories, scheds]);
  const getFilteredScheds = React.useCallback((category: CategoryDraft) => {
    const available = getAvailableScheds(category.id);
    if (!category.filter_date) return available;
    return available.filter((sched) => sched.sched_date === category.filter_date);
  }, [getAvailableScheds]);
  const missingFields = React.useMemo(() => {
    const missing: string[] = [];
    if (!formData.show_name.trim()) missing.push("Show name");
    if (!formData.show_description.trim()) missing.push("Description");
    if (!formData.venue.trim()) missing.push("Venue");
    if (!formData.address.trim()) missing.push("Address");
    if (!formData.show_start_date) missing.push("Start date");
    if (!formData.show_end_date) missing.push("End date");
    if (!formData.seatmap_id) missing.push("Seatmap");
    if (formData.show_start_date && formData.show_end_date && !isDateRangeValid) {
      missing.push("Date range (start must be before end)");
    }
    return missing;
  }, [formData, isDateRangeValid]);

  const isFormValid = missingFields.length === 0;

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

  const addCategory = () => {
    setCategories((prev) => [
      ...prev,
      {
        id: `cat-${uuidv4()}`,
        category_name: "",
        price: "0.00",
        color_code: "NO_COLOR",
        apply_to_all: true,
        sched_ids: [],
        filter_date: "",
      },
    ]);
  };

  const updateCategory = (id: string, patch: Partial<CategoryDraft>) => {
    setCategories((prev) => prev.map((cat) => (cat.id === id ? { ...cat, ...patch } : cat)));
  };

  const removeCategory = (id: string) => {
    setCategories((prev) => prev.filter((cat) => cat.id !== id));
  };

  const toggleCategorySched = (categoryId: string, schedId: string) => {
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.id !== categoryId) return cat;
        const exists = cat.sched_ids.includes(schedId);
        return {
          ...cat,
          sched_ids: exists
            ? cat.sched_ids.filter((id) => id !== schedId)
            : [...cat.sched_ids, schedId],
        };
      }),
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
      !formData.show_end_date ||
      !formData.seatmap_id
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
    // @ts-expect-error server action typing isn't compatible with direct client invocation
    const result = await createShowAction({
      ...formData,
      seatmap_id: formData.seatmap_id,
      scheds: validScheds.map((sched) => ({
        client_id: sched.id,
        sched_date: sched.sched_date,
        sched_start_time: sched.sched_start_time,
        sched_end_time: sched.sched_end_time,
      })),
      categories: categories.map((category) => ({
        category_name: category.category_name.trim() || "Untitled",
        price: category.price,
        color_code: category.color_code,
        apply_to_all: category.apply_to_all,
        sched_ids: category.sched_ids,
      })),
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
              <div className="space-y-2">
                <Label htmlFor="show-status" className="text-xs font-semibold text-muted-foreground">
                  Status
                </Label>
                <Select
                  value={formData.show_status}
                  onValueChange={(value) => setFormData({ ...formData, show_status: value })}
                >
                  <SelectTrigger id="show-status" className="h-9 w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="show-description" className="text-xs font-semibold text-muted-foreground">
                Description
              </Label>
              <textarea
                id="show-description"
                value={formData.show_description}
                onChange={(e) => setFormData({ ...formData, show_description: e.target.value })}
                className="min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="show-venue" className="text-xs font-semibold text-muted-foreground">
                Venue
              </Label>
              <Input
                id="show-venue"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="show-address" className="text-xs font-semibold text-muted-foreground">
                Address
              </Label>
              <Input
                id="show-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                Start Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "h-9 w-full justify-start text-left font-medium",
                      !showStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {showStartDate ? format(showStartDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={showStartDate ?? undefined}
                    onSelect={(date) => {
                      if (!date) return;
                      setFormData({
                        ...formData,
                        show_start_date: format(date, "yyyy-MM-dd"),
                        show_end_date:
                          formData.show_end_date &&
                          new Date(`${formData.show_end_date}T00:00:00`) < date
                            ? ""
                            : formData.show_end_date,
                      });
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                End Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "h-9 w-full justify-start text-left font-medium",
                      !showEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {showEndDate ? format(showEndDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={showEndDate ?? undefined}
                    onSelect={(date) => {
                      if (!date) return;
                      setFormData({ ...formData, show_end_date: format(date, "yyyy-MM-dd") });
                    }}
                    initialFocus
                    disabled={(date) => !!showStartDate && date < showStartDate}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                Show Poster
              </Label>
              <div className="flex flex-col gap-3">
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

      <Card className="border-sidebar-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl font-semibold">
            Seatmap
          </CardTitle>
          <CardDescription>Select a seatmap template and preview the layout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="seatmap" className="text-xs font-semibold text-muted-foreground">
                Seatmap
              </Label>
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
                  placeholder={isLoadingSeatmaps ? "Loading seatmaps..." : "Select a seatmap"}
                  disabled={isLoadingSeatmaps}
                  required
                  value={seatmapQuery}
                  onChange={(event) => setSeatmapQuery(event.target.value)}
                />
                <ComboboxContent>
                  <ComboboxList>
                    {isLoadingSeatmaps ? (
                      <ComboboxItem value="loading" disabled>
                        Loading seatmaps...
                      </ComboboxItem>
                    ) : (
                      filteredSeatmaps.map((seatmap) => (
                        <ComboboxItem key={seatmap.seatmap_id} value={seatmap.seatmap_id}>
                          {seatmap.seatmap_name}
                        </ComboboxItem>
                      ))
                    )}
                    {!isLoadingSeatmaps && seatmaps.length === 0 && (
                      <ComboboxEmpty>No seatmaps found.</ComboboxEmpty>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>

          <SeatmapPreview
            seatmapId={formData.seatmap_id || undefined}
            categories={categories.map((category) => ({
              category_id: category.id,
              name: category.category_name,
              color_code: category.color_code,
            }))}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Seat Categories</p>
                <p className="text-xs text-muted-foreground">
                  Define pricing and which schedules each category applies to.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCategory}
                className="gap-1.5"
                disabled={!hasSeatmapSelected}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Category
              </Button>
            </div>

            {!hasSeatmapSelected && (
              <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-6 text-sm text-muted-foreground">
                Select a seatmap before adding categories.
              </div>
            )}

            {hasSeatmapSelected && categories.length === 0 && (
              <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-6 text-sm text-muted-foreground">
                No categories yet. Add at least one to set pricing.
              </div>
            )}

            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category.id} className="rounded-lg border border-sidebar-border/60 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid gap-3 md:grid-cols-[1.2fr_0.6fr_0.8fr] w-full">
                      <div className="space-y-2">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Category Name</Label>
                        <Input
                          value={category.category_name}
                          onChange={(e) => updateCategory(category.id, { category_name: e.target.value })}
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
                            updateCategory(category.id, { price: next });
                          }}
                          onBlur={() => {
                            const raw = String(category.price ?? "").trim();
                            const normalizedValue = raw === "" ? 0 : Number(raw);
                            if (Number.isNaN(normalizedValue)) {
                              updateCategory(category.id, { price: "0.00" });
                              return;
                            }
                            const clamped = Math.min(Math.max(normalizedValue, 0), 9999.99);
                            updateCategory(category.id, { price: clamped.toFixed(2) });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Color</Label>
                        <Select
                          value={category.color_code}
                          onValueChange={(value) =>
                            updateCategory(category.id, { color_code: value as CategoryDraft["color_code"] })
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
                      onClick={() => removeCategory(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Applies to schedules
                      </Label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={category.filter_date || "all"}
                          onValueChange={(value) =>
                            updateCategory(category.id, {
                              filter_date: value === "all" ? "" : value,
                            })
                          }
                          disabled={scheds.length === 0}
                        >
                          <SelectTrigger className="h-7 w-[160px] text-[11px]">
                            <SelectValue placeholder="Filter date" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All dates</SelectItem>
                            {Array.from(
                              new Map(
                                scheds.map((sched) => [sched.sched_date, sched])
                              ).keys()
                            ).map((dateValue) => (
                              <SelectItem key={dateValue} value={dateValue}>
                                {formatDateLabel(dateValue)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {category.filter_date && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => updateCategory(category.id, { filter_date: "" })}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={category.apply_to_all}
                        onChange={(e) => updateCategory(category.id, { apply_to_all: e.target.checked })}
                        disabled={scheds.length === 0}
                      />
                      Apply to all schedules
                    </label>
                    {!category.apply_to_all && (
                      <div className="grid gap-2 md:grid-cols-2">
                        {getFilteredScheds(category).map((sched) => (
                          <label key={sched.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-primary"
                              checked={category.sched_ids.includes(sched.id)}
                              onChange={() => toggleCategorySched(category.id, sched.id)}
                            />
                            {sched.sched_date} • {formatTime(sched.sched_start_time)}–{formatTime(sched.sched_end_time)}
                          </label>
                        ))}
                        {scheds.length === 0 && (
                          <p className="text-xs text-muted-foreground">Add schedules first to target specific dates.</p>
                        )}
                        {scheds.length > 0 && getAvailableScheds(category.id).length === 0 && (
                          <p className="text-xs text-muted-foreground">All schedules already assigned.</p>
                        )}
                        {scheds.length > 0 && getAvailableScheds(category.id).length > 0 && getFilteredScheds(category).length === 0 && (
                          <p className="text-xs text-muted-foreground">No schedules match the selected date.</p>
                        )}
                      </div>
                    )}
                    {category.apply_to_all && scheds.length === 0 && (
                      <p className="text-xs text-muted-foreground">Add schedules to apply categories.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
        <div className="flex flex-col items-end gap-2">
          {!isFormValid && !isSaving && (
            <p className="text-xs text-red-600">
              Missing: {missingFields.join(", ")}
            </p>
          )}
          <Button onClick={handleSave} disabled={isSaving || !isFormValid} className="gap-2">
          <Save className="h-4 w-4" />
          {isSaving ? "Creating..." : "Create Show"}
          </Button>
        </div>
      </div>
    </div>
  );
}
