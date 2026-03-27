"use client";

import * as React from "react";
import { differenceInCalendarMonths } from "date-fns";
import { Plus, Trash2, Save, CalendarDays, CalendarIcon, AlertTriangle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";
import { createShowAction } from "@/lib/actions/createShow";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ImageUploadDropzone } from "@/components/ui/image-upload-dropzone";
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
import { CategoryAssignPanel } from "@/components/seatmap/CategoryAssignPanel";
import type { SeatmapState } from "@/lib/seatmap/types";
import { uploadImageToCloudinary } from "@/lib/clients/cloudinary-upload";
import { useAppDispatch } from "@/lib/hooks";
import { setLoading } from "@/lib/features/loading/isLoadingSlice";
// import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const STATUS_OPTIONS = [
  "DRAFT",
  "UPCOMING",
  "OPEN",
];
type ShowStatusOption = (typeof STATUS_OPTIONS)[number];

const MAX_POSTER_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_POSTER_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const MANILA_TZ = "Asia/Manila";

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

type TicketTemplateOption = {
  ticket_template_id: string;
  template_name: string;
  latestVersionNumber: number | null;
  updatedAt: string;
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
  /** Maps seat ID -> category ID for this set */
  seatAssignments: Record<string, string>;
};

const COLOR_OPTIONS: Array<{ value: CategoryDraft["color_code"]; label: string; swatch: string | null }> = [
  { value: "NO_COLOR", label: "No Color", swatch: null },
  { value: "GOLD", label: "Gold", swatch: "#ffd700" },
  { value: "PINK", label: "Pink", swatch: "#e005b9" },
  { value: "BLUE", label: "Blue", swatch: "#111184" },
  { value: "BURGUNDY", label: "Burgundy", swatch: "#800020" },
  { value: "GREEN", label: "Green", swatch: "#046307" },
];

type CreateShowFormProps = {
  teamId?: string | null;
};

export function CreateShowForm({ teamId }: CreateShowFormProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = React.useState(false);
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = React.useState(false);
  const [pendingStatus, setPendingStatus] = React.useState<ShowStatusOption | null>(null);
  const [formData, setFormData] = React.useState({
    show_name: "",
    show_description: "",
    venue: "",
    address: "",
    gcash_number: "",
    gcash_account_name: "",
    show_status: "DRAFT",
    show_start_date: "",
    show_end_date: "",
    seatmap_id: "",
    ticket_template_id: "",
  });
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [posterUploadError, setPosterUploadError] = React.useState<string | null>(null);
  const [gcashQrImageBase64, setGcashQrImageBase64] = React.useState("");
  const [gcashQrPreview, setGcashQrPreview] = React.useState<string | null>(null);
  const [gcashQrUploadError, setGcashQrUploadError] = React.useState<string | null>(null);
  const [isGcashQrProcessing, setIsGcashQrProcessing] = React.useState(false);
  const [scheds, setScheds] = React.useState<SchedDraft[]>([]);
  const [selectedDates, setSelectedDates] = React.useState<Date[]>([]);
  const [applyToAllDates, setApplyToAllDates] = React.useState(false);
  const [seatmaps, setSeatmaps] = React.useState<SeatmapOption[]>([]);
  const [isLoadingSeatmaps, setIsLoadingSeatmaps] = React.useState(false);
  const [seatmapQuery, setSeatmapQuery] = React.useState("");
  const [ticketTemplates, setTicketTemplates] = React.useState<TicketTemplateOption[]>([]);
  const [isLoadingTicketTemplates, setIsLoadingTicketTemplates] = React.useState(false);
  const [ticketTemplateQuery, setTicketTemplateQuery] = React.useState("");
  const [timeRanges, setTimeRanges] = React.useState<TimeRangeDraft[]>([
    { id: `time-${uuidv4()}`, start: "19:00", end: "21:00" },
  ]);
  const [categorySets, setCategorySets] = React.useState<CategorySetDraft[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = React.useState<string[]>([]);
  const [seatmapData, setSeatmapData] = React.useState<SeatmapState | null>(null); // Store seatmap JSON
  /** Active category set ID for tabs */
  const [activeSetId, setActiveSetId] = React.useState<string | null>(null);
  const unassignedSchedCount = React.useMemo(() => {
    if (scheds.length === 0) return 0;
    const used = new Set<string>();
    categorySets.forEach((setItem) => {
      if (setItem.apply_to_all) {
        setItem.sched_ids.forEach((id) => used.add(id));
        return;
      }
      setItem.sched_ids.forEach((id) => used.add(id));
    });
    return scheds.filter((sched) => !used.has(sched.id)).length;
  }, [categorySets, scheds]);
  const groupedScheds = React.useMemo(() => {
    const grouped = scheds.reduce<Record<string, SchedDraft[]>>((acc, sched) => {
      if (!acc[sched.sched_date]) acc[sched.sched_date] = [];
      acc[sched.sched_date].push(sched);
      return acc;
    }, {});
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, items]) => ({
        dateKey,
        items: items.sort((a, b) => a.sched_start_time.localeCompare(b.sched_start_time)),
      }));
  }, [scheds]);
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
  const filteredTicketTemplates = React.useMemo(() => {
    const query = ticketTemplateQuery.trim().toLowerCase();
    if (!query) return ticketTemplates;
    const selected = ticketTemplates.find(
      (template) => template.ticket_template_id === formData.ticket_template_id,
    );
    if (selected && selected.template_name.toLowerCase() === query) {
      return ticketTemplates;
    }
    return ticketTemplates.filter((template) =>
      template.template_name.toLowerCase().includes(query),
    );
  }, [formData.ticket_template_id, ticketTemplateQuery, ticketTemplates]);
  const hasSeatmapSelected = Boolean(formData.seatmap_id);

  React.useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handlePosterAccepted = React.useCallback((file: File) => {
    setPosterUploadError(null);
    setImageFile(file);
    setImagePreview((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return URL.createObjectURL(file);
    });
  }, []);

  const handlePosterRemove = React.useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    setPosterUploadError(null);
  }, [imagePreview]);

  const handleGcashQrAccepted = React.useCallback((file: File) => {
    setGcashQrUploadError(null);
    setIsGcashQrProcessing(true);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setGcashQrImageBase64(reader.result);
        setGcashQrPreview(reader.result);
      } else {
        setGcashQrUploadError("Failed to read GCash QR image.");
      }
      setIsGcashQrProcessing(false);
    };
    reader.onerror = () => {
      setGcashQrUploadError("Failed to read GCash QR image.");
      setIsGcashQrProcessing(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGcashQrRemove = React.useCallback(() => {
    setGcashQrImageBase64("");
    setGcashQrPreview(null);
    setGcashQrUploadError(null);
  }, []);

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

  React.useEffect(() => {
    let isMounted = true;
    const loadTicketTemplates = async () => {
      try {
        setIsLoadingTicketTemplates(true);
        const response = await fetch("/api/ticket-templates");
        if (!response.ok) {
          throw new Error("Failed to load ticket templates");
        }
        const data = await response.json();
        if (!isMounted) return;
        setTicketTemplates(data.ticketTemplates ?? []);
      } catch (error: unknown) {
        if (!isMounted) return;
        const message =
          error instanceof Error ? error.message : "Unable to load ticket templates";
        toast.error(message);
      } finally {
        if (isMounted) {
          setIsLoadingTicketTemplates(false);
        }
      }
    };
    loadTicketTemplates();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const showStartDate = React.useMemo(
    () =>
      formData.show_start_date
        ? new Date(`${formData.show_start_date}T00:00:00+08:00`)
        : null,
    [formData.show_start_date]
  );
  const showEndDate = React.useMemo(
    () =>
      formData.show_end_date
        ? new Date(`${formData.show_end_date}T00:00:00+08:00`)
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
  const toManilaDateKey = React.useCallback((dateValue: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: MANILA_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(dateValue);
    const year = parts.find((part) => part.type === "year")?.value ?? "0000";
    const month = parts.find((part) => part.type === "month")?.value ?? "00";
    const day = parts.find((part) => part.type === "day")?.value ?? "00";
    return `${year}-${month}-${day}`;
  }, []);
  const formatTime = React.useCallback((timeValue: string) => {
    if (!timeValue) return "";
    const date = new Date(`1970-01-01T${timeValue}:00+08:00`);
    if (Number.isNaN(date.getTime())) return timeValue;
    return new Intl.DateTimeFormat("en-US", {
      timeZone: MANILA_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }, []);
  const formatManilaDate = React.useCallback((dateValue: Date | null) => {
    if (!dateValue) return "";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: MANILA_TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(dateValue);
  }, []);
  const formatDateLabel = React.useCallback((dateValue: string) => {
    if (!dateValue) return "";
    const date = new Date(`${dateValue}T00:00:00+08:00`);
    if (Number.isNaN(date.getTime())) return dateValue;
    return new Intl.DateTimeFormat("en-US", {
      timeZone: MANILA_TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }, []);
  const scheduleCoverage = React.useMemo(() => {
    if (!showStartDate || !showEndDate) {
      return { hasSchedules: scheds.length > 0, missingDates: [] as string[] };
    }
    const scheduleDates = new Set(scheds.map((sched) => sched.sched_date));
    const missingDates: string[] = [];
    const cursor = new Date(showStartDate);
    while (cursor <= showEndDate) {
      const dateKey = toManilaDateKey(cursor);
      if (!scheduleDates.has(dateKey)) {
        missingDates.push(dateKey);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return { hasSchedules: scheds.length > 0, missingDates };
  }, [scheds, showStartDate, showEndDate, toManilaDateKey]);
  const overlappingScheduleDateKeys = React.useMemo(() => {
    const byDate = new Map<string, Array<{ start: number; end: number }>>();

    const toMinutes = (time: string) => {
      const [h, m] = time.split(":").map((part) => Number.parseInt(part, 10));
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return h * 60 + m;
    };

    for (const sched of scheds) {
      const start = toMinutes(sched.sched_start_time);
      const end = toMinutes(sched.sched_end_time);
      if (start === null || end === null) continue;
      if (end <= start) continue;
      const list = byDate.get(sched.sched_date) ?? [];
      list.push({ start, end });
      byDate.set(sched.sched_date, list);
    }

    const overlapping = new Set<string>();
    byDate.forEach((ranges, dateKey) => {
      const sorted = [...ranges].sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].start < sorted[i - 1].end) {
          overlapping.add(dateKey);
          break;
        }
      }
    });

    return Array.from(overlapping).sort((a, b) => a.localeCompare(b));
  }, [scheds]);
  const hasOverlappingSchedules = overlappingScheduleDateKeys.length > 0;
  const getAvailableScheds = React.useCallback((setId: string) => {
    const used = new Set<string>();
    categorySets.forEach((setItem) => {
      if (setItem.id === setId) return;
      if (setItem.apply_to_all) {
        setItem.sched_ids.forEach((id) => used.add(id));
        return;
      }
      setItem.sched_ids.forEach((id) => used.add(id));
    });
    return scheds.filter((sched) => !used.has(sched.id));
  }, [categorySets, scheds]);
  const getFilteredScheds = React.useCallback((setItem: CategorySetDraft) => {
    const available = getAvailableScheds(setItem.id);
    if (!setItem.filter_date) return available;
    return available.filter((sched) => sched.sched_date === setItem.filter_date);
  }, [getAvailableScheds]);
  const allSchedsCovered = React.useMemo(() => {
    if (scheds.length === 0) return false;
    const allIds = new Set(scheds.map((sched) => sched.id));
    return categorySets.some((setItem) => {
      if (setItem.apply_to_all) return true;
      if (setItem.sched_ids.length === 0) return false;
      const covered = new Set(setItem.sched_ids);
      if (covered.size !== allIds.size) return false;
      for (const id of allIds) {
        if (!covered.has(id)) return false;
      }
      return true;
    });
  }, [categorySets, scheds]);

  // Count total seats in seatmap
  const seatNodeIds = React.useMemo(() => {
    if (!seatmapData?.nodes) return [] as string[];
    return Object.values(seatmapData.nodes)
      .filter((node) => node.type === "seat")
      .map((node) => node.id);
  }, [seatmapData]);

  // Validate that EACH category set has valid assignments for all seats in the seatmap.
  const seatAssignmentIssues = React.useMemo(() => {
    if (!seatNodeIds.length || categorySets.length === 0) return [];

    const validSeatIds = new Set(seatNodeIds);

    return categorySets
      .map((setItem, index) => {
        const validCategoryIds = new Set(setItem.categories.map((category) => category.id));
        const validAssignedSeatIds = new Set<string>();
        let invalidAssignments = 0;

        Object.entries(setItem.seatAssignments ?? {}).forEach(([seatId, categoryId]) => {
          if (!validSeatIds.has(seatId) || !validCategoryIds.has(categoryId)) {
            invalidAssignments += 1;
            return;
          }
          validAssignedSeatIds.add(seatId);
        });

        const missing = seatNodeIds.reduce((count, seatId) => {
          return validAssignedSeatIds.has(seatId) ? count : count + 1;
        }, 0);

        if (missing > 0 || invalidAssignments > 0) {
          return {
            setName: setItem.set_name || `Set ${index + 1}`,
            missing,
            invalidAssignments,
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{
        setName: string;
        missing: number;
        invalidAssignments: number;
      }>;
  }, [categorySets, seatNodeIds]);

  const validationState = React.useMemo(() => {
    const requiresSeatmap = formData.show_status === "UPCOMING" || formData.show_status === "OPEN";
    const dateRangeInvalid =
      !!formData.show_start_date && !!formData.show_end_date && !isDateRangeValid;

    const hasInvalidCategory = categorySets.some((setItem) =>
      setItem.categories.some((category) => {
        const nameValid = category.category_name.trim().length > 0;
        const priceValue = String(category.price ?? "").trim();
        const priceValid =
          priceValue !== "" &&
          /^\d{1,4}(\.\d{1,2})?$/.test(priceValue) &&
          !Number.isNaN(Number(priceValue)) &&
          Number(priceValue) >= 0;
        return !nameValid || !priceValid;
      }),
    );

    const fieldErrors = {
      showName: !formData.show_name.trim(),
      description: !formData.show_description.trim(),
      venue: !formData.venue.trim(),
      address: !formData.address.trim(),
      gcashQr: !gcashQrImageBase64.trim(),
      gcashNumber: !formData.gcash_number.trim(),
      gcashAccountName: !formData.gcash_account_name.trim(),
      startDate: !formData.show_start_date || dateRangeInvalid,
      endDate: !formData.show_end_date || dateRangeInvalid,
      seatmap: requiresSeatmap && !formData.seatmap_id,
    };

    const seatmapDetailsError =
      !!formData.seatmap_id &&
      (categorySets.length === 0 ||
        (scheds.length > 0 && unassignedSchedCount > 0) ||
        hasInvalidCategory ||
        seatAssignmentIssues.length > 0);

    const cardErrors = {
      schedule:
        scheduleCoverage.missingDates.length > 0 || hasOverlappingSchedules,
      seatmap: seatmapDetailsError,
    };

    const hasValidationErrors =
      Object.values(fieldErrors).some(Boolean) ||
      Object.values(cardErrors).some(Boolean);

    return { fieldErrors, cardErrors, hasValidationErrors };
  }, [
    formData,
    gcashQrImageBase64,
    isDateRangeValid,
    categorySets,
    scheds.length,
    unassignedSchedCount,
    seatAssignmentIssues.length,
    scheduleCoverage.missingDates.length,
    hasOverlappingSchedules,
  ]);

  const seatAssignmentIssueMessage = React.useMemo(() => {
    if (seatAssignmentIssues.length === 0) return null;

    const labels = seatAssignmentIssues.slice(0, 2).map((issue) => {
      const parts: string[] = [];
      if (issue.missing > 0) {
        parts.push(
          `${issue.missing} unassigned seat${issue.missing === 1 ? "" : "s"}`
        );
      }
      if (issue.invalidAssignments > 0) {
        parts.push(
          `${issue.invalidAssignments} invalid assignment${issue.invalidAssignments === 1 ? "" : "s"}`
        );
      }
      return `${issue.setName}: ${parts.join(", ")}`;
    });

    const suffix =
      seatAssignmentIssues.length > 2
        ? ` +${seatAssignmentIssues.length - 2} more`
        : "";

    return `Assign every seat to a valid category before creating the show. ${labels.join(" | ")}${suffix}.`;
  }, [seatAssignmentIssues]);

  const scheduleIssueMessage = React.useMemo(() => {
    if (scheduleCoverage.missingDates.length > 0) {
      const labels = scheduleCoverage.missingDates
        .slice(0, 3)
        .map((dateKey) => formatDateLabel(dateKey));
      const suffix =
        scheduleCoverage.missingDates.length > 3
          ? ` +${scheduleCoverage.missingDates.length - 3} more`
          : "";
      return `Missing schedules for: ${labels.join(", ")}${suffix}.`;
    }

    if (hasOverlappingSchedules) {
      const labels = overlappingScheduleDateKeys
        .slice(0, 3)
        .map((dateKey) => formatDateLabel(dateKey));
      const suffix =
        overlappingScheduleDateKeys.length > 3
          ? ` +${overlappingScheduleDateKeys.length - 3} more`
          : "";
      return `Overlapping schedule times detected on: ${labels.join(", ")}${suffix}.`;
    }

    return null;
  }, [
    scheduleCoverage.missingDates,
    hasOverlappingSchedules,
    overlappingScheduleDateKeys,
    formatDateLabel,
  ]);

  const isFormValid = !validationState.hasValidationErrors;

  const statusConfirmMessage = React.useMemo(() => {
    if (pendingStatus === "UPCOMING") {
      return "Setting this show to UPCOMING will pre-launch it. Customers can view show details, but booking reservations will stay disabled until the status is set to OPEN.";
    }
    if (pendingStatus === "OPEN") {
      return "Setting this show to OPEN will launch it and enable customers to book reservations.";
    }
    return "";
  }, [pendingStatus]);

  const handleStatusSelection = React.useCallback((nextStatus: string) => {
    if (nextStatus === formData.show_status) return;

    if (nextStatus === "UPCOMING" || nextStatus === "OPEN") {
      setPendingStatus(nextStatus as ShowStatusOption);
      setIsStatusConfirmOpen(true);
      return;
    }

    setFormData((prev) => ({ ...prev, show_status: nextStatus }));
  }, [formData.show_status]);

  const handleConfirmStatusChange = React.useCallback(() => {
    if (!pendingStatus) return;
    setFormData((prev) => ({ ...prev, show_status: pendingStatus }));
    setIsStatusConfirmOpen(false);
    setPendingStatus(null);
  }, [pendingStatus]);

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

  React.useEffect(() => {
    if (!formData.ticket_template_id) {
      if (ticketTemplateQuery) {
        setTicketTemplateQuery("");
      }
      return;
    }
    const match = ticketTemplates.find(
      (template) => template.ticket_template_id === formData.ticket_template_id,
    );
    if (match && match.template_name !== ticketTemplateQuery) {
      setTicketTemplateQuery(match.template_name);
    }
  }, [formData.ticket_template_id, ticketTemplateQuery, ticketTemplates]);

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

  const addCategorySet = () => {
    const newSetId = `set-${uuidv4()}`;
    setCategorySets((prev) => {
      const nextPrev = prev.map((setItem) =>
        setItem.apply_to_all
          ? { ...setItem, apply_to_all: false, sched_ids: [] }
          : setItem,
      );
      return [
        ...nextPrev,
        {
          id: newSetId,
          set_name: `Set ${prev.length + 1}`,
          apply_to_all: prev.length === 0,
          sched_ids: prev.length === 0 ? scheds.map((sched) => sched.id) : [],
          filter_date: "",
          categories: [],
          seatAssignments: {},
        },
      ];
    });
    setActiveSetId(newSetId);
  };

  // Keep apply-to-all sets in sync with schedule assignments.
  // This fixes the state where a set is checked by default but has no sched_ids
  // until the user manually toggles the checkbox.
  React.useEffect(() => {
    if (scheds.length === 0) return;

    setCategorySets((prev) => {
      let hasChange = false;

      const next = prev.map((setItem) => {
        if (!setItem.apply_to_all || setItem.sched_ids.length > 0) {
          return setItem;
        }

        const usedByOtherSets = new Set<string>();
        prev.forEach((other) => {
          if (other.id === setItem.id) return;
          other.sched_ids.forEach((id) => usedByOtherSets.add(id));
        });

        const remainingSchedIds = scheds
          .map((sched) => sched.id)
          .filter((id) => !usedByOtherSets.has(id));

        hasChange = true;
        return {
          ...setItem,
          sched_ids: remainingSchedIds,
        };
      });

      return hasChange ? next : prev;
    });
  }, [scheds]);

  const updateCategorySet = (id: string, patch: Partial<CategorySetDraft>) => {
    setCategorySets((prev) => prev.map((setItem) => (setItem.id === id ? { ...setItem, ...patch } : setItem)));
  };

  const removeCategorySet = (id: string) => {
    setCategorySets((prev) => {
      const filtered = prev.filter((setItem) => setItem.id !== id);
      // If we removed the active set, switch to the first remaining set (or null)
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
    if (!isFormValid) return;

    setIsSaving(true);
    const validScheds = scheds.filter(
      (s) => s.sched_date && s.sched_start_time && s.sched_end_time
    );

    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const uploaded = await uploadImageToCloudinary(imageFile, "show-thumbnail");
        imageUrl = uploaded.secureUrl;
      }

      // @ts-expect-error server action typing isn't compatible with direct client invocation
      const result = await createShowAction({
        ...formData,
        team_id: teamId || undefined,
        seatmap_id: formData.seatmap_id,
        ticket_template_id: formData.ticket_template_id || undefined,
        scheds: validScheds.map((sched) => ({
          client_id: sched.id,
          sched_date: sched.sched_date,
          sched_start_time: sched.sched_start_time,
          sched_end_time: sched.sched_end_time,
        })),
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
        show_image_key: imageUrl,
        gcash_qr_image_base64: gcashQrImageBase64,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to create show");
        return;
      }

      toast.success("Show created successfully");
      dispatch(setLoading(true));
      router.push(`/admin/shows/${result.showId}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 px-0 md:px-0">
      <div className="h-px bg-border/60 md:hidden" />
      <Card className="border-0 shadow-none rounded-none md:border md:shadow-sm md:rounded-lg">
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
                className={cn(
                  validationState.fieldErrors.showName &&
                    "border-red-500 focus-visible:ring-red-500/30",
                )}
              />
            </div>
            <div className="space-y-2">
              <div className="space-y-2">
                <Label htmlFor="show-status" className="text-xs font-semibold text-muted-foreground">
                  Status
                </Label>
                <Select
                  value={formData.show_status}
                  onValueChange={handleStatusSelection}
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
                className={cn(
                  "min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  validationState.fieldErrors.description &&
                    "border-red-500 focus-visible:ring-red-500/30",
                )}
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
                className={cn(
                  validationState.fieldErrors.venue &&
                    "border-red-500 focus-visible:ring-red-500/30",
                )}
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
                className={cn(
                  validationState.fieldErrors.address &&
                    "border-red-500 focus-visible:ring-red-500/30",
                )}
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
                      !showStartDate && "text-muted-foreground",
                      validationState.fieldErrors.startDate && "border-red-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {showStartDate ? formatManilaDate(showStartDate) : <span>Pick a date</span>}
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
                        show_start_date: toManilaDateKey(date),
                        show_end_date:
                          formData.show_end_date &&
                            new Date(`${formData.show_end_date}T00:00:00+08:00`) < date
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
                      !showEndDate && "text-muted-foreground",
                      validationState.fieldErrors.endDate && "border-red-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {showEndDate ? formatManilaDate(showEndDate) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={showEndDate ?? undefined}
                    onSelect={(date) => {
                      if (!date) return;
                      setFormData({ ...formData, show_end_date: toManilaDateKey(date) });
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
              <ImageUploadDropzone
                previewUrl={imagePreview}
                previewAlt="Show poster preview"
                onFileAccepted={handlePosterAccepted}
                onRemove={handlePosterRemove}
                accept={ACCEPTED_POSTER_TYPES}
                maxSize={MAX_POSTER_FILE_SIZE}
                disabled={isSaving}
                uploadError={posterUploadError}
                onFileRejected={setPosterUploadError}
                idleTitle="Upload Show Poster"
                activeTitle="Drop the poster here"
                helperText="Drag and drop or click to browse. JPG, PNG, or WEBP (max 5MB)"
                successMessage={imageFile ? `Poster ready: ${imageFile.name}` : null}
                emptyHint="Optional. Add a poster to improve show listing visibility."
                minHeightClassName="min-h-[170px]"
                previewMaxHeightClassName="max-h-[280px]"
              />
            </div>
            <div
              className={cn(
                "space-y-2",
                validationState.fieldErrors.gcashQr &&
                  "rounded-md ring-1 ring-red-500 p-1",
              )}
            >
              <Label className="text-xs font-semibold text-muted-foreground">
                GCash QR Code
              </Label>
              <ImageUploadDropzone
                previewUrl={gcashQrPreview}
                previewAlt="GCash QR code preview"
                onFileAccepted={handleGcashQrAccepted}
                onRemove={handleGcashQrRemove}
                accept={ACCEPTED_POSTER_TYPES}
                maxSize={MAX_POSTER_FILE_SIZE}
                disabled={isSaving}
                isProcessing={isGcashQrProcessing}
                processingText="Processing GCash QR image..."
                uploadError={gcashQrUploadError}
                onFileRejected={setGcashQrUploadError}
                idleTitle="Upload GCash QR Code"
                activeTitle="Drop the GCash QR code here"
                helperText="Drag and drop or click to browse. JPG, PNG, or WEBP (max 5MB)"
                successMessage={gcashQrImageBase64 ? "GCash QR image ready for submission" : null}
                emptyHint="Required. This QR code is shown to users during payment."
                minHeightClassName="min-h-[170px]"
                previewMaxHeightClassName="max-h-[280px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gcash-number" className="text-xs font-semibold text-muted-foreground">
                GCash Number
              </Label>
              <Input
                id="gcash-number"
                required
                value={formData.gcash_number}
                onChange={(e) => setFormData({ ...formData, gcash_number: e.target.value })}
                placeholder="09XXXXXXXXX"
                className={cn(
                  validationState.fieldErrors.gcashNumber &&
                    "border-red-500 focus-visible:ring-red-500/30",
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gcash-account-name" className="text-xs font-semibold text-muted-foreground">
                GCash Account Name
              </Label>
              <Input
                id="gcash-account-name"
                required
                value={formData.gcash_account_name}
                onChange={(e) => setFormData({ ...formData, gcash_account_name: e.target.value })}
                placeholder="Juan Dela Cruz"
                className={cn(
                  validationState.fieldErrors.gcashAccountName &&
                    "border-red-500 focus-visible:ring-red-500/30",
                )}
              />
            </div>

          </div>
        </CardContent>
      </Card>

      <div className="h-px bg-border/60 md:hidden" />

      <Card
        className={cn(
          "border-0 shadow-none rounded-none md:border md:shadow-sm md:rounded-lg",
          validationState.cardErrors.schedule && "md:border-red-500/70",
        )}
      >
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
          {scheduleIssueMessage && (
            <div className="rounded-lg border border-red-300 px-4 py-6 text-sm text-red-600 dark:border-red-900/60 dark:text-red-400">
              {scheduleIssueMessage}
            </div>
          )}
          {groupedScheds.map((group) => (
            <div key={group.dateKey} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                {formatDateLabel(group.dateKey)}
              </div>
              <div className="space-y-2">
                {group.items.map((s) => (
                  <div
                    key={s.id}
                    className="relative grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end rounded-lg border border-sidebar-border/60 p-3 pr-12 md:pr-3"
                  >
                    <div className="space-y-2">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Starts
                      </Label>
                      <Input
                        type="time"
                        value={s.sched_start_time}
                        className="h-8 text-xs sm:h-9 sm:text-sm"
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
                        className="h-8 text-xs sm:h-9 sm:text-sm"
                        readOnly
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/10 md:static md:h-9 md:w-9"
                      onClick={() => removeSched(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="h-px bg-border/60 md:hidden" />

      <Card className="border-0 shadow-none rounded-none md:border md:shadow-sm md:rounded-lg">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg md:text-xl font-semibold">
                Presentation Setup
              </CardTitle>
              <CardDescription>
                Select a seatmap template and optional ticket template for this production.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/ticket-templates")}
            >
              Manage Ticket Templates
            </Button>
          </div>
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
                className={cn(
                  validationState.fieldErrors.seatmap &&
                    "border-red-500 focus-visible:ring-red-500/30",
                )}
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
            <div className="space-y-2">
              <Label
                htmlFor="ticket-template"
                className="text-xs font-semibold text-muted-foreground"
              >
                Ticket Template
              </Label>
              <Combobox
                value={formData.ticket_template_id}
                onValueChange={(value) => {
                  const nextValue = value ?? "";
                  setFormData({ ...formData, ticket_template_id: nextValue });
                  const match = ticketTemplates.find(
                    (template) => template.ticket_template_id === nextValue,
                  );
                  if (match) {
                    setTicketTemplateQuery(match.template_name);
                  }
                }}
              >
                <ComboboxInput
                  id="ticket-template"
                  placeholder={
                    isLoadingTicketTemplates
                      ? "Loading ticket templates..."
                      : "Select a ticket template"
                  }
                  disabled={isLoadingTicketTemplates}
                  value={ticketTemplateQuery}
                  onChange={(event) => setTicketTemplateQuery(event.target.value)}
                />
                <ComboboxContent>
                  <ComboboxList>
                    {isLoadingTicketTemplates ? (
                      <ComboboxItem value="loading-ticket-templates" disabled>
                        Loading ticket templates...
                      </ComboboxItem>
                    ) : (
                      filteredTicketTemplates.map((template) => (
                        <ComboboxItem
                          key={template.ticket_template_id}
                          value={template.ticket_template_id}
                        >
                          {template.template_name}
                          {template.latestVersionNumber
                            ? ` (v${template.latestVersionNumber})`
                            : ""}
                        </ComboboxItem>
                      ))
                    )}
                    {!isLoadingTicketTemplates && ticketTemplates.length === 0 && (
                      <ComboboxEmpty>No ticket templates found.</ComboboxEmpty>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>

          {/* Tabbed Seatmap Preview - one tab per category set */}

          {categorySets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Add a category set below to start assigning seats.
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
                        setSelectedSeatIds([]); // Clear selection when switching tabs
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
                      // Key removed to persist view state and prevent unnecessary re-fetching
                      seatmapId={formData.seatmap_id || undefined}
                      allowMarqueeSelection
                      selectedSeatIds={selectedSeatIds}
                      onSelectionChange={setSelectedSeatIds}
                      categories={setCategories}
                      seatCategories={currentAssignments}
                      onSeatCategoriesChange={(newAssignments) =>
                        updateSetSeatAssignments(activeSet.id, newAssignments)
                      }
                    />
                    <CategoryAssignPanel
                      className="absolute right-3 top-3 z-10"
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
                    <div className="mt-2 hidden md:flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Use</span>
                      <span className="inline-flex items-center gap-1">
                        <img src="/shift.svg" alt="Shift key" className="h-4.5 w-4.5 object-contain" />
                        <span>Shift</span>
                      </span>
                      <span>or</span>
                      <span className="inline-flex items-center gap-1">
                        <img src="/control.svg" alt="Control key" className="h-4.5 w-4.5 object-contain" />
                        <span>Ctrl</span>
                      </span>
                      <span>to multi-select.</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}


          <div
            className={cn(
              "space-y-4",
              validationState.cardErrors.seatmap &&
                "rounded-lg border border-red-500/70 p-3",
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Category Sets</p>
                <p className="text-xs text-muted-foreground">
                  Group pricing categories and assign each set to schedules.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCategorySet}
                className="gap-1.5"
                disabled={
                  !hasSeatmapSelected ||
                  scheds.length === 0 ||
                  scheduleCoverage.missingDates.length > 0 ||
                  (scheds.length > 0 && unassignedSchedCount === 0) ||
                  allSchedsCovered
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add Category Set
              </Button>
            </div>
            {hasSeatmapSelected && scheds.length > 0 && scheduleCoverage.missingDates.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Add schedules for every date in the show range before creating category sets.
              </p>
            )}

            {!hasSeatmapSelected && (
              <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-6 text-sm text-muted-foreground">
                Select a seatmap before adding category sets.
              </div>
            )}
            {hasSeatmapSelected && scheds.length === 0 && (
              <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-4 text-xs text-muted-foreground">
                Add schedules before creating category sets.
              </div>
            )}

            {hasSeatmapSelected && categorySets.length === 0 && (
              <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-6 text-sm text-muted-foreground">
                No category sets yet. Add one to start pricing.
              </div>
            )}

            {seatAssignmentIssueMessage && (
              <p className="text-xs text-destructive">
                {seatAssignmentIssueMessage}
              </p>
            )}

            <div className="space-y-4">
              {categorySets.map((setItem, index) => (
                <div key={setItem.id} className="rounded-lg border border-sidebar-border/60 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1 w-full">
                      <p className="text-sm font-semibold">Category Set {index + 1}</p>
                      <p className="text-xs text-muted-foreground">
                        Assign schedules, then add categories inside the set.
                      </p>
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

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Applies to schedules
                      </Label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={setItem.filter_date || "all"}
                          onValueChange={(value) =>
                            updateCategorySet(setItem.id, {
                              filter_date: value === "all" ? "" : value,
                            })
                          }
                          disabled={scheds.length === 0 || setItem.apply_to_all}
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
                        {setItem.filter_date && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => updateCategorySet(setItem.id, { filter_date: "" })}
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
                        checked={setItem.apply_to_all}
                        onChange={(e) => {
                          const next = e.target.checked;
                          const remaining = getAvailableScheds(setItem.id).map(
                            (sched) => sched.id,
                          );
                          updateCategorySet(setItem.id, {
                            apply_to_all: next,
                            sched_ids: next ? remaining : [],
                          });
                        }}
                        disabled={
                          scheds.length === 0 ||
                          getAvailableScheds(setItem.id).length === 0
                        }
                      />
                      Apply to all schedules
                    </label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {getFilteredScheds(setItem).map((sched) => (
                        <label key={sched.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={setItem.apply_to_all || setItem.sched_ids.includes(sched.id)}
                            onChange={() => toggleSetSched(setItem.id, sched.id)}
                            disabled={setItem.apply_to_all}
                          />
                          {formatDateLabel(sched.sched_date)} - {formatTime(sched.sched_start_time)}-{formatTime(sched.sched_end_time)}
                        </label>
                      ))}
                      {scheds.length === 0 && (
                        <p className="text-xs text-muted-foreground">Add schedules first to target specific dates.</p>
                      )}
                      {scheds.length > 0 && getAvailableScheds(setItem.id).length === 0 && (
                        <p className="text-xs text-destructive">All schedules already assigned.</p>
                      )}
                      {scheds.length > 0 && getAvailableScheds(setItem.id).length > 0 && getFilteredScheds(setItem).length === 0 && (
                        <p className="text-xs text-muted-foreground">No schedules match the selected date.</p>
                      )}
                    </div>
                    {setItem.apply_to_all && scheds.length === 0 && (
                      <p className="text-xs text-muted-foreground">Add schedules to apply categories.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground">Categories in this set</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => addCategoryToSet(setItem.id)}
                        disabled={getAvailableScheds(setItem.id).length === 0}
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
        </CardContent>
      </Card>

      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent
          className={cn(
            "sm:max-w-2xl p-3 sm:p-6",
            numberOfMonths >= 2 && "md:max-h-[90vh] md:overflow-y-auto",
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg">Add schedules</DialogTitle>
            <DialogDescription className="text-[11px] sm:text-sm">
              Select dates within the show range, then add one or more time ranges.
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              "grid gap-3 md:gap-6",
              numberOfMonths >= 2 ? "md:grid-cols-1" : "md:grid-cols-[1.1fr_1fr]",
            )}
          >
            <div
              className={cn(
                "rounded-lg border border-sidebar-border/60 p-3 flex justify-center",
                numberOfMonths >= 2 ? "md:justify-center" : "md:block",
              )}
            >
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates ?? [])}
                numberOfMonths={numberOfMonths}
                month={showStartDate ?? undefined}
                defaultMonth={showStartDate ?? undefined}
                disableNavigation
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

      <Dialog
        open={isStatusConfirmOpen}
        onOpenChange={(open) => {
          setIsStatusConfirmOpen(open);
          if (!open) setPendingStatus(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <DialogTitle>Confirm status change</DialogTitle>
            <DialogDescription>
              {statusConfirmMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmStatusChange}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end">
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/admin/shows")}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !isFormValid} className="gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? "Creating..." : "Create Show"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

