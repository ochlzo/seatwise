"use client";

import * as React from "react";

import {
  CalendarIcon,
  MapPin,
  Ticket,
  Clock,
  Save,
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  CalendarDays,
  Play,
  Armchair,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { differenceInCalendarMonths } from "date-fns";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { updateShowAction } from "@/lib/actions/updateShow";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { ShowStatus } from "@prisma/client";
import Image from "next/image";
import { SeatmapPreview } from "@/components/seatmap/SeatmapPreview";
import { CategoryAssignPanel } from "@/components/seatmap/CategoryAssignPanel";
import type { SeatmapState } from "@/lib/seatmap/types";
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

const formatManilaTimeKey = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);

const toManilaTimeKey = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);

const toDateKey = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.includes("T")) {
    return new Date(value).toISOString().slice(0, 10);
  }
  return value;
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
          price: string; // Serialized from Decimal
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
        price: string; // Serialized from Decimal
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

interface ShowDetailFormProps {
  show: ShowDetail;
}

type SeatmapOption = {
  seatmap_id: string;
  seatmap_name: string;
  updatedAt: string;
};

type SchedDraft = Omit<
  ShowDetail["scheds"][number],
  "sched_date" | "sched_start_time" | "sched_end_time"
> & {
  client_id: string;
  sched_date: string;
  sched_start_time: string;
  sched_end_time: string;
};

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
  const [categorySets, setCategorySets] = React.useState<CategorySetDraft[]>(
    [],
  );
  const [selectedSeatIds, setSelectedSeatIds] = React.useState<string[]>([]);
  const [seatmapData, setSeatmapData] = React.useState<SeatmapState | null>(
    null,
  );
  const [activeSetId, setActiveSetId] = React.useState<string | null>(null);

  const filteredSeatmaps = React.useMemo(() => {
    const query = seatmapQuery.trim().toLowerCase();
    if (!query) return seatmaps;
    return seatmaps.filter((seatmap) =>
      seatmap.seatmap_name.toLowerCase().includes(query),
    );
  }, [seatmapQuery, seatmaps]);

  const [formData, setFormData] = React.useState<{
    show_name: string;
    show_description: string;
    venue: string;
    address: string;
    show_status: ShowStatus;
    show_start_date: string;
    show_end_date: string;
    seatmap_id: string;
    scheds: SchedDraft[];
  }>({
    show_name: show.show_name,
    show_description: show.show_description,
    venue: show.venue,
    address: show.address,
    show_status: show.show_status,
    show_start_date: toManilaDateKey(new Date(show.show_start_date)),
    show_end_date: toManilaDateKey(new Date(show.show_end_date)),
    seatmap_id: show.seatmap_id || "",
    scheds: (show.scheds || []).map((s) => ({
      ...s,
      sched_date: toManilaDateKey(new Date(s.sched_date)),
      sched_start_time:
        typeof s.sched_start_time === "string" &&
        s.sched_start_time.includes("T")
          ? formatManilaTimeKey(new Date(s.sched_start_time))
          : typeof s.sched_start_time === "string"
            ? s.sched_start_time
            : formatManilaTimeKey(new Date(s.sched_start_time)),
      sched_end_time:
        typeof s.sched_end_time === "string" && s.sched_end_time.includes("T")
          ? formatManilaTimeKey(new Date(s.sched_end_time))
          : typeof s.sched_end_time === "string"
            ? s.sched_end_time
            : formatManilaTimeKey(new Date(s.sched_end_time)),
      client_id: s.sched_id || uuidv4(),
    })),
  });

  React.useEffect(() => {
    setFormData({
      show_name: show.show_name,
      show_description: show.show_description,
      venue: show.venue,
      address: show.address,
      show_status: show.show_status,
      show_start_date: toManilaDateKey(new Date(show.show_start_date)),
      show_end_date: toManilaDateKey(new Date(show.show_end_date)),
      seatmap_id: show.seatmap_id || "",
      scheds: (show.scheds || []).map((s) => ({
        ...s,
        sched_date: toManilaDateKey(new Date(s.sched_date)),
        sched_start_time:
          typeof s.sched_start_time === "string" &&
          s.sched_start_time.includes("T")
            ? formatManilaTimeKey(new Date(s.sched_start_time))
            : typeof s.sched_start_time === "string"
              ? s.sched_start_time
              : formatManilaTimeKey(new Date(s.sched_start_time)),
        sched_end_time:
          typeof s.sched_end_time === "string" && s.sched_end_time.includes("T")
            ? formatManilaTimeKey(new Date(s.sched_end_time))
            : typeof s.sched_end_time === "string"
              ? s.sched_end_time
              : formatManilaTimeKey(new Date(s.sched_end_time)),
        client_id: s.sched_id || uuidv4(),
      })),
    });
  }, [show]);

  const showStartDate = React.useMemo(
    () =>
      formData.show_start_date
        ? new Date(`${formData.show_start_date}T00:00:00+08:00`)
        : null,
    [formData.show_start_date],
  );

  const showEndDate = React.useMemo(
    () =>
      formData.show_end_date
        ? new Date(`${formData.show_end_date}T00:00:00+08:00`)
        : null,
    [formData.show_end_date],
  );
  const numberOfMonths =
    showStartDate &&
    showEndDate &&
    differenceInCalendarMonths(showEndDate, showStartDate) >= 1
      ? 2
      : 1;

  React.useEffect(() => {
    if (!showStartDate || !showEndDate) return;
    setSelectedDates((prev) =>
      prev.filter((date) => date >= showStartDate && date <= showEndDate),
    );
  }, [showStartDate, showEndDate]);

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
    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!formData.seatmap_id) {
      if (seatmapQuery) {
        setSeatmapQuery("");
      }
      return;
    }
    const match = seatmaps.find(
      (seatmap) => seatmap.seatmap_id === formData.seatmap_id,
    );
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
  const resetCategorySets = React.useCallback(() => {
    if (!show.categorySets || show.categorySets.length === 0) {
      setCategorySets([]);
      setActiveSetId(null);
      return;
    }

    // Convert database category sets to draft format
    const drafts: CategorySetDraft[] = show.categorySets.map((dbSet) => {
      // Find schedules that use this category set
      const schedsWithThisSet = show.scheds.filter(
        (sched) => sched.category_set_id === dbSet.category_set_id,
      );

      // Build seat assignments map from the schedules
      const seatAssignments: Record<string, string> = {};

      // Use the first schedule's seat assignments as the reference
      // (since apply_to_all sets should have the same assignments across all schedules)
      if (
        schedsWithThisSet.length > 0 &&
        schedsWithThisSet[0].seatAssignments
      ) {
        schedsWithThisSet[0].seatAssignments.forEach((assignment) => {
          // Map seat_id -> seat_category_id
          seatAssignments[assignment.seat_id] = assignment.set.seat_category_id;
        });
      }

      return {
        id: dbSet.category_set_id,
        set_name: dbSet.set_name,
        sched_ids: schedsWithThisSet.map((s) => s.sched_id || ""),
        apply_to_all:
          schedsWithThisSet.length === show.scheds.length &&
          show.scheds.length > 0,
        filter_date: "",
        categories: dbSet.items.map((item) => ({
          id: item.seatCategory.seat_category_id,
          category_name: item.seatCategory.category_name,
          price: String(item.seatCategory.price),
          color_code: item.seatCategory.color_code,
        })),
        seatAssignments,
      };
    });

    setCategorySets(drafts);
    if (drafts.length > 0) {
      setActiveSetId(drafts[0].id);
    } else {
      setActiveSetId(null);
    }
  }, [show]);

  React.useEffect(() => {
    resetCategorySets();
  }, [resetCategorySets]);

  const addTimeRange = () => {
    setTimeRanges((prev) => [
      ...prev,
      { id: `time-${uuidv4()}`, start: "19:00", end: "21:00" },
    ]);
  };

  const removeTimeRange = (id: string) => {
    setTimeRanges((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTimeRange = (
    id: string,
    patch: { start?: string; end?: string },
  ) => {
    setTimeRanges((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };

  const addCategorySet = () => {
    const newSetId = `set-${uuidv4()}`;
    setCategorySets((prev) => [
      ...prev,
      {
        id: newSetId,
        set_name: `Set ${prev.length + 1}`,
        apply_to_all: prev.length === 0,
        sched_ids: [],
        filter_date: "",
        categories: [],
        seatAssignments: {},
      },
    ]);
    setActiveSetId(newSetId);
  };

  const updateCategorySet = (id: string, patch: Partial<CategorySetDraft>) => {
    setCategorySets((prev) =>
      prev.map((setItem) =>
        setItem.id === id ? { ...setItem, ...patch } : setItem,
      ),
    );
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
      }),
    );
  };

  const updateCategoryInSet = (
    setId: string,
    categoryId: string,
    patch: Partial<CategoryDraft>,
  ) => {
    setCategorySets((prev) =>
      prev.map((setItem) => {
        if (setItem.id !== setId) return setItem;
        return {
          ...setItem,
          categories: setItem.categories.map((category) =>
            category.id === categoryId ? { ...category, ...patch } : category,
          ),
        };
      }),
    );
  };

  const removeCategoryFromSet = (setId: string, categoryId: string) => {
    setCategorySets((prev) =>
      prev.map((setItem) => {
        if (setItem.id !== setId) return setItem;

        // Filter out the category
        const nextCategories = setItem.categories.filter(
          (category) => category.id !== categoryId,
        );

        // Filter out seat assignments that were pointing to this category
        const nextAssignments = { ...setItem.seatAssignments };
        Object.entries(nextAssignments).forEach(([seatId, catId]) => {
          if (catId === categoryId) {
            delete nextAssignments[seatId];
          }
        });

        return {
          ...setItem,
          categories: nextCategories,
          seatAssignments: nextAssignments,
        };
      }),
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
      }),
    );
  };

  const updateSetSeatAssignments = (
    setId: string,
    updater:
      | Record<string, string>
      | ((prev: Record<string, string>) => Record<string, string>),
  ) => {
    setCategorySets((prev) =>
      prev.map((setItem) => {
        if (setItem.id !== setId) return setItem;
        const nextAssignments =
          typeof updater === "function"
            ? updater(setItem.seatAssignments)
            : updater;
        return { ...setItem, seatAssignments: nextAssignments };
      }),
    );
  };

  const isDateRangeValid = React.useMemo(() => {
    return (
      showStartDate &&
      showEndDate &&
      showStartDate.getTime() <= showEndDate.getTime()
    );
  }, [showStartDate, showEndDate]);

  const scheduleCoverage = React.useMemo(() => {
    if (!showStartDate || !showEndDate) {
      return {
        hasSchedules: formData.scheds.length > 0,
        missingDates: [] as string[],
      };
    }
    const scheduleDates = new Set(
      formData.scheds.map((sched) =>
        toManilaDateKey(toDateValue(sched.sched_date)),
      ),
    );
    const missingDates: string[] = [];
    const cursor = new Date(showStartDate);
    while (showEndDate && cursor <= showEndDate) {
      const dateKey = toManilaDateKey(cursor);
      if (!scheduleDates.has(dateKey)) {
        missingDates.push(dateKey);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return { hasSchedules: formData.scheds.length > 0, missingDates };
  }, [formData.scheds, showStartDate, showEndDate]);

  const allSchedsCovered = React.useMemo(() => {
    if (formData.scheds.length === 0) return false;
    const allIds = new Set(formData.scheds.map((sched) => sched.client_id));
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
  }, [categorySets, formData.scheds]);

  const unassignedSchedCount = React.useMemo(() => {
    if (formData.scheds.length === 0) return 0;
    const used = new Set<string>();
    categorySets.forEach((setItem) => {
      setItem.sched_ids.forEach((id) => used.add(id));
    });
    return formData.scheds.filter((sched) => !used.has(sched.client_id)).length;
  }, [categorySets, formData.scheds]);

  const totalSeatsCount = React.useMemo(() => {
    if (!seatmapData || !seatmapData.nodes) return 0;
    return Object.values(seatmapData.nodes).filter(
      (node) => node.type === "seat",
    ).length;
  }, [seatmapData]);

  const incompleteCategorySets = React.useMemo(() => {
    if (!totalSeatsCount || categorySets.length === 0) return [];
    return categorySets
      .map((setItem, index) => {
        const assignedInThisSet = setItem.seatAssignments
          ? Object.keys(setItem.seatAssignments).length
          : 0;
        if (assignedInThisSet < totalSeatsCount) {
          return {
            setName: setItem.set_name || `Set ${index + 1}`,
            missing: totalSeatsCount - assignedInThisSet,
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{ setName: string; missing: number }>;
  }, [categorySets, totalSeatsCount]);

  const missingFields = React.useMemo(() => {
    const missing: string[] = [];
    // 1. Basic Fields
    if (!formData.show_name.trim()) missing.push("Show Name");
    if (!formData.show_description.trim()) missing.push("Description");
    if (!formData.venue.trim()) missing.push("Venue");
    if (!formData.address.trim()) missing.push("Address");
    if (!formData.show_start_date) missing.push("Start Date");
    if (!formData.show_end_date) missing.push("End Date");

    // 2. Schedule Validation
    if (formData.scheds.length === 0) {
      missing.push("Schedules");
    } else if (scheduleCoverage.missingDates.length > 0) {
      missing.push("Schedules (missing dates)");
    }

    // 3. Seatmap & Assignments Validation (Mandatory for ALL productions)
    if (!formData.seatmap_id) {
      missing.push("Seatmap");
    }
    if (categorySets.length === 0) {
      missing.push("Category Sets");
    }

    if (formData.seatmap_id) {
      if (
        categorySets.length > 0 &&
        formData.scheds.length > 0 &&
        unassignedSchedCount > 0
      ) {
        missing.push("Assigned Scheds");
      }

      const hasInvalidCategory = categorySets.some(
        (setItem) =>
          setItem.categories.length === 0 || // Flag empty sets
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
      if (hasInvalidCategory) missing.push("Category name/price/empty set");

      if (incompleteCategorySets.length > 0) {
        incompleteCategorySets.forEach((incomplete) => {
          missing.push(
            `${incomplete.setName}: ${incomplete.missing} seats unassigned`,
          );
        });
      }
    }

    if (
      formData.show_start_date &&
      formData.show_end_date &&
      !isDateRangeValid
    ) {
      missing.push("Date range (start must be before end)");
    }
    return missing;
  }, [
    formData,
    scheduleCoverage,
    categorySets,
    unassignedSchedCount,
    incompleteCategorySets,
    isDateRangeValid,
  ]);

  const isFormValid = React.useMemo(() => {
    if (missingFields.length > 0) return false;
    if (
      formData.seatmap_id &&
      formData.scheds.length > 0 &&
      unassignedSchedCount > 0
    )
      return false;
    return true;
  }, [
    missingFields,
    formData.seatmap_id,
    formData.scheds.length,
    unassignedSchedCount,
  ]);

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
          client_id: uuidv4(),
          sched_date: dateKey,
          sched_start_time: range.start,
          sched_end_time: range.end,
        });
      });
    });

    setFormData((prev) => ({
      ...prev,
      scheds: [...prev.scheds, ...newEntries] as SchedDraft[],
    }));

    setSelectedDates([]);
    setTimeRanges([{ id: `time-${uuidv4()}`, start: "19:00", end: "21:00" }]);
    setIsScheduleOpen(false);
    if (!isEditing) setIsEditing(true);
  };

  const handleSave = async () => {
    if (!isFormValid) return;
    setIsSaving(true);
    try {
      const result = await updateShowAction(show.show_id, {
        show_name: formData.show_name,
        show_description: formData.show_description,
        venue: formData.venue,
        address: formData.address,
        show_status: formData.show_status,
        show_start_date: formData.show_start_date,
        show_end_date: formData.show_end_date,
        seatmap_id: formData.seatmap_id || null,
        scheds: formData.scheds.map((s) => ({
          client_id: s.client_id,
          sched_date: s.sched_date,
          sched_start_time: s.sched_start_time,
          sched_end_time: s.sched_end_time,
        })),
        category_sets: categorySets.map((setItem, index) => {
          // Map seatAssignments (seatId -> categoryId) to (seatId -> categoryName)
          const assignmentsByName: Record<string, string> = {};
          if (setItem.seatAssignments) {
            Object.entries(setItem.seatAssignments).forEach(
              ([seatId, categoryId]) => {
                const category = setItem.categories.find(
                  (c) => c.id === categoryId,
                );
                if (category) {
                  assignmentsByName[seatId] =
                    category.category_name.trim() || "Untitled";
                }
              },
            );
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

  const getAvailableScheds = (currentSetId: string) => {
    return formData.scheds.filter((s) => {
      const assignedToOther = categorySets.some(
        (set) => set.id !== currentSetId && set.sched_ids.includes(s.client_id),
      );
      return !assignedToOther;
    });
  };

  const getFilteredScheds = (setItem: CategorySetDraft) => {
    const available = getAvailableScheds(setItem.id);
    if (setItem.filter_date) {
      return available.filter(
        (s) =>
          toManilaDateKey(toDateValue(s.sched_date)) === setItem.filter_date,
      );
    }
    return available;
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
              borderColor: "transparent",
            }}
            className="shadow-xl font-bold italic px-4 py-1.5 text-sm uppercase tracking-wider"
          >
            {formData.show_status.replace("_", " ")}
          </Badge>
        </div>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
        {/* 2. Primary Details Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-sidebar-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-semibold">
                Show Information
              </CardTitle>
              <CardDescription>
                Update the primary details of the production.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Show Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.show_name}
                    onChange={(e) =>
                      setFormData({ ...formData, show_name: e.target.value })
                    }
                    className="font-medium bg-muted/30 focus-visible:ring-primary/20"
                    readOnly={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="status"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Current Status
                  </Label>
                  {isEditing ? (
                    <Select
                      value={formData.show_status}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          show_status: value as ShowStatus,
                        })
                      }
                    >
                      <SelectTrigger
                        id="status"
                        className="h-9 w-full font-medium"
                      >
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
                      readOnly
                      className="font-medium bg-muted/30"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Production Description
                </Label>
                <textarea
                  id="description"
                  value={formData.show_description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      show_description: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 font-medium"
                  readOnly={!isEditing}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="venue"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Venue
                  </Label>
                  <Input
                    id="venue"
                    value={formData.venue}
                    onChange={(e) =>
                      setFormData({ ...formData, venue: e.target.value })
                    }
                    className="font-medium bg-muted/30"
                    readOnly={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="address"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Full Address
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="font-medium bg-muted/30"
                    readOnly={!isEditing}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Start Date
                  </Label>
                  {isEditing ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-medium bg-muted/30",
                            !showStartDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {showStartDate ? (
                            formatManilaDate(showStartDate)
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={showStartDate ?? undefined}
                          onSelect={(date) => {
                            if (date) {
                              setFormData({
                                ...formData,
                                show_start_date: toManilaDateKey(date),
                              });
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-medium bg-muted/30 cursor-default",
                        !showStartDate && "text-muted-foreground",
                      )}
                      onClick={(e) => e.preventDefault()}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                      {showStartDate ? (
                        formatManilaDate(showStartDate)
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    End Date
                  </Label>
                  {isEditing ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-medium bg-muted/30",
                            !showEndDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {showEndDate ? (
                            formatManilaDate(showEndDate)
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={showEndDate ?? undefined}
                          onSelect={(date) => {
                            if (date) {
                              setFormData({
                                ...formData,
                                show_end_date: toManilaDateKey(date),
                              });
                            }
                          }}
                          initialFocus
                          disabled={(date) =>
                            !!showStartDate && date < showStartDate
                          }
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-medium bg-muted/30 cursor-default",
                        !showEndDate && "text-muted-foreground",
                      )}
                      onClick={(e) => e.preventDefault()}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                      {showEndDate ? (
                        formatManilaDate(showEndDate)
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Performance Schedule Section */}
          <Card className="border-sidebar-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg md:text-xl font-semibold">
                  Performance Schedule
                </CardTitle>
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
              {(() => {
                if (!formData.scheds || formData.scheds.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                      No schedules found.
                    </div>
                  );
                }

                // Prepare schedules with category set info
                const schedulesWithSets = formData.scheds.map((sched) => {
                  const categorySet = categorySets.find(
                    (set) =>
                      set.apply_to_all ||
                      set.sched_ids.includes(sched.client_id),
                  );

                  return {
                    ...sched,
                    category_set_id: categorySet?.id || null,
                    set_name: categorySet?.set_name || null,
                  };
                });

                // When editing, show simple list grouped by date
                if (isEditing) {
                  // Group schedules by date
                  const schedulesByDate = new Map<string, typeof schedulesWithSets>();

                  schedulesWithSets.forEach((sched) => {
                    const dateKey = toDateKey(sched.sched_date);
                    if (!schedulesByDate.has(dateKey)) {
                      schedulesByDate.set(dateKey, []);
                    }
                    schedulesByDate.get(dateKey)?.push(sched);
                  });

                  // Sort dates and schedules within each date
                  const sortedDates = Array.from(schedulesByDate.keys()).sort();

                  return (
                    <div className="space-y-4">
                      {sortedDates.map((dateKey) => {
                        const schedules = schedulesByDate.get(dateKey) || [];
                        const sortedSchedules = schedules.sort((a, b) =>
                          toManilaTimeKey(toTimeValue(a.sched_start_time)).localeCompare(
                            toManilaTimeKey(toTimeValue(b.sched_start_time))
                          )
                        );

                        const schedDate = toDateValue(dateKey);
                        const formattedDate = new Intl.DateTimeFormat("en-US", {
                          timeZone: MANILA_TZ,
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(schedDate);

                        return (
                          <div key={dateKey} className="space-y-3">
                            <h4 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                              <CalendarIcon className="w-4 h-4 text-primary" />
                              {formattedDate}
                            </h4>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {sortedSchedules.map((sched) => {
                                const categorySet = categorySets.find(
                                  (set) => set.id === sched.category_set_id,
                                );

                                return (
                                  <div
                                    key={sched.client_id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-sidebar-border/60 bg-muted/20"
                                  >
                                    <div className="space-y-1.5 flex-1">
                                      <div className="text-sm font-medium flex items-center gap-2">
                                        {formatManilaTime(toTimeValue(sched.sched_start_time))}
                                        <span className="text-muted-foreground">-</span>
                                        {formatManilaTime(toTimeValue(sched.sched_end_time))}
                                      </div>
                                      {categorySet && (
                                        <div className="space-y-1.5 pt-1">
                                          <div className="text-[11px] font-medium text-muted-foreground">
                                            {categorySet.set_name}
                                          </div>
                                          <div className="flex flex-wrap gap-1.5">
                                            {categorySet.categories
                                              .filter((category) =>
                                                Object.values(categorySet.seatAssignments || {}).includes(category.id),
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
                                                          : category.color_code === "GOLD"
                                                            ? "#ffd700"
                                                            : category.color_code === "PINK"
                                                              ? "#e005b9"
                                                              : category.color_code === "BLUE"
                                                                ? "#111184"
                                                                : category.color_code === "BURGUNDY"
                                                                  ? "#800020"
                                                                  : "#046307",
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
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                      onClick={() => {
                                        setFormData((prev) => ({
                                          ...prev,
                                          scheds: prev.scheds.filter((s) => s !== sched),
                                        }));
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // When not editing, use grouped view with tabs
                // Group schedules using the helper function
                const groupedSchedules = groupSchedulesByCommonalities(schedulesWithSets);

                if (groupedSchedules.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                      No schedules found.
                    </div>
                  );
                }

                // Single group - no tabs needed
                if (groupedSchedules.length === 1) {
                  const group = groupedSchedules[0];
                  return (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        {group.label}
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {group.items.map((item, idx) => {
                          const categorySet = categorySets.find(
                            (set) => set.id === item.category_set_id,
                          );

                          // Convert 24-hour time string (e.g., "19:00") to 12-hour format
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
                                          Object.values(categorySet.seatAssignments || {}).includes(category.id),
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
                                                    : category.color_code === "GOLD"
                                                      ? "#ffd700"
                                                      : category.color_code === "PINK"
                                                        ? "#e005b9"
                                                        : category.color_code === "BLUE"
                                                          ? "#111184"
                                                          : category.color_code === "BURGUNDY"
                                                            ? "#800020"
                                                            : "#046307",
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
                  );
                }

                // Multiple groups - use tabs
                return (
                  <Tabs
                    defaultValue={groupedSchedules[0].label}
                    className="w-full"
                    onValueChange={(tabLabel) => {
                      // Sync seatmap tab when schedule tab changes
                      const selectedGroup = groupedSchedules.find(g => g.label === tabLabel);
                      if (selectedGroup && selectedGroup.items[0]) {
                        // Each group has exactly 1 category set (guaranteed by use case)
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
                            // Find one matching schedule for delete functionality
                            const firstMatchingSched = schedulesWithSets.find(
                              (s) =>
                                toManilaTimeKey(toTimeValue(s.sched_start_time)) === item.sched_start_time &&
                                toManilaTimeKey(toTimeValue(s.sched_end_time)) === item.sched_end_time &&
                                (s.category_set_id || null) === item.category_set_id,
                            );

                            const categorySet = categorySets.find(
                              (set) => set.id === item.category_set_id,
                            );

                            // Convert 24-hour time string (e.g., "19:00") to 12-hour format
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
                                            Object.values(categorySet.seatAssignments || {}).includes(category.id),
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
                                                      : category.color_code === "GOLD"
                                                        ? "#ffd700"
                                                        : category.color_code === "PINK"
                                                          ? "#e005b9"
                                                          : category.color_code === "BLUE"
                                                            ? "#111184"
                                                            : category.color_code === "BURGUNDY"
                                                              ? "#800020"
                                                              : "#046307",
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
                                {isEditing && firstMatchingSched && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      const isSingleDay = group.start_date === group.end_date;

                                      setFormData((prev) => ({
                                        ...prev,
                                        scheds: prev.scheds.filter(
                                          (s) => {
                                            const schedDate = toDateKey(s.sched_date);
                                            const matchesTime =
                                              toManilaTimeKey(toTimeValue(s.sched_start_time)) === item.sched_start_time &&
                                              toManilaTimeKey(toTimeValue(s.sched_end_time)) === item.sched_end_time &&
                                              (s.category_set_id || null) === item.category_set_id;

                                            if (isSingleDay) {
                                              // For single-day groups, only delete schedules on that specific date
                                              return !(matchesTime && schedDate === group.start_date);
                                            } else {
                                              // For multi-day ranges, delete all matching schedules in the range
                                              const inRange = schedDate >= group.start_date && schedDate <= group.end_date;
                                              return !(matchesTime && inRange);
                                            }
                                          }
                                        ),
                                      }));
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                );
              })()}
            </CardContent>
          </Card>

          {/* 4. Seatmap & Category Management Section - Always display */}
          <Card className="border-sidebar-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl font-semibold">
                Seatmap
              </CardTitle>
              <CardDescription>
                {isEditing
                  ? "Manage pricing categories and seat assignments for schedules."
                  : "View pricing categories and seat assignments."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Seatmap Selection */}
              <div className="space-y-2">
                <Label
                  htmlFor="seatmap"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Seatmap Template
                </Label>
                {isEditing ? (
                  <Combobox
                    value={formData.seatmap_id}
                    onValueChange={(value) => {
                      const nextValue = value ?? "";
                      setFormData({ ...formData, seatmap_id: nextValue });
                      const match = seatmaps.find(
                        (seatmap) => seatmap.seatmap_id === nextValue,
                      );
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
                          <ComboboxItem
                            key={seatmap.seatmap_id}
                            value={seatmap.seatmap_id}
                          >
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
                    value={
                      seatmaps.find((s) => s.seatmap_id === formData.seatmap_id)
                        ?.seatmap_name || "Unassigned"
                    }
                    readOnly
                    className="font-medium bg-muted/30"
                  />
                )}
              </div>

              {!formData.seatmap_id ? (
                <div className="rounded-lg border border-dashed border-sidebar-border px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No seatmap selected.{" "}
                    {isEditing && "Choose a seatmap template to get started."}
                  </p>
                </div>
              ) : (
                <>
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
                          const isActive =
                            (activeSetId ?? categorySets[0]?.id) === setItem.id;
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
                                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
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
                          (s) => s.id === (activeSetId ?? categorySets[0]?.id),
                        );

                        if (!activeSet) return null;

                        const setCategories = activeSet.categories.map(
                          (category) => ({
                            category_id: category.id,
                            name: category.category_name,
                            color_code: category.color_code,
                          }),
                        );

                        const currentAssignments =
                          activeSet.seatAssignments || {};

                        return (
                          <div className="relative mt-1">
                            <SeatmapPreview
                              seatmapId={formData.seatmap_id || undefined}
                              allowMarqueeSelection={isEditing}
                              selectedSeatIds={selectedSeatIds}
                              onSelectionChange={setSelectedSeatIds}
                              categories={setCategories}
                              seatCategories={currentAssignments}
                              onSeatCategoriesChange={
                                isEditing
                                  ? (newAssignments) =>
                                      updateSetSeatAssignments(
                                        activeSet.id,
                                        newAssignments,
                                      )
                                  : undefined
                              }
                            />
                            <CategoryAssignPanel
                              className="absolute right-3 top-14 z-10"
                              selectedSeatIds={selectedSeatIds}
                              categories={setCategories}
                              seatCategories={currentAssignments}
                              onAssign={
                                isEditing
                                  ? (seatIds, categoryId) => {
                                      updateSetSeatAssignments(
                                        activeSet.id,
                                        (prev) => {
                                          const next = { ...prev };
                                          seatIds.forEach((id) => {
                                            next[id] = categoryId;
                                          });
                                          return next;
                                        },
                                      );
                                    }
                                  : undefined
                              }
                              onClear={
                                isEditing
                                  ? (seatIds) => {
                                      updateSetSeatAssignments(
                                        activeSet.id,
                                        (prev) => {
                                          const next = { ...prev };
                                          seatIds.forEach((id) => {
                                            delete next[id];
                                          });
                                          return next;
                                        },
                                      );
                                    }
                                  : undefined
                              }
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Category Sets Management - Only show when editing and seatmap exists */}
                  {isEditing && formData.seatmap_id && (
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
                          disabled={allSchedsCovered}
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
                          <div
                            key={setItem.id}
                            className="rounded-lg border border-sidebar-border/60 p-4 space-y-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="space-y-1 w-full">
                                <p className="text-sm font-semibold">
                                  Category Set {index + 1}
                                </p>
                                <div className="space-y-2 max-w-xs">
                                  <Label className="text-[11px] font-semibold text-muted-foreground">
                                    Set Name
                                  </Label>
                                  <Input
                                    value={setItem.set_name}
                                    onChange={(e) =>
                                      updateCategorySet(setItem.id, {
                                        set_name: e.target.value,
                                      })
                                    }
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
                                        filter_date:
                                          value === "all" ? "" : value,
                                      })
                                    }
                                    disabled={
                                      formData.scheds.length === 0 ||
                                      setItem.apply_to_all
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-[160px] text-[11px]">
                                      <SelectValue placeholder="Filter date" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">
                                        All dates
                                      </SelectItem>
                                      {Array.from(
                                        new Map(
                                          formData.scheds.map((sched) => [
                                            toManilaDateKey(
                                              toDateValue(sched.sched_date),
                                            ),
                                            sched,
                                          ]),
                                        ).keys(),
                                      ).map((dateValue) => (
                                        <SelectItem
                                          key={dateValue}
                                          value={dateValue}
                                        >
                                          {formatManilaDateLong(
                                            toDateValue(dateValue),
                                          )}
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
                                      onClick={() =>
                                        updateCategorySet(setItem.id, {
                                          filter_date: "",
                                        })
                                      }
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
                                    const remaining = getAvailableScheds(
                                      setItem.id,
                                    ).map((sched) => sched.client_id);
                                    updateCategorySet(setItem.id, {
                                      apply_to_all: next,
                                      sched_ids: next ? remaining : [],
                                    });
                                  }}
                                  disabled={
                                    formData.scheds.length === 0 ||
                                    getAvailableScheds(setItem.id).length === 0
                                  }
                                />
                                Apply to all schedules
                              </label>
                              <div className="grid gap-2 md:grid-cols-2">
                                {getFilteredScheds(setItem).map((sched) => (
                                  <label
                                    key={sched.client_id}
                                    className="flex items-center gap-2 text-xs text-muted-foreground"
                                  >
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 accent-primary"
                                      checked={
                                        setItem.apply_to_all ||
                                        setItem.sched_ids.includes(
                                          sched.client_id,
                                        )
                                      }
                                      onChange={() =>
                                        toggleSetSched(
                                          setItem.id,
                                          sched.client_id,
                                        )
                                      }
                                      disabled={setItem.apply_to_all}
                                    />
                                    {formatManilaDate(
                                      toDateValue(sched.sched_date),
                                    )}{" "}
                                    -{" "}
                                    {formatManilaTime(
                                      toTimeValue(sched.sched_start_time),
                                    )}{" "}
                                    to{" "}
                                    {formatManilaTime(
                                      toTimeValue(sched.sched_end_time),
                                    )}
                                  </label>
                                ))}
                                {formData.scheds.length === 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Add schedules first to target specific
                                    dates.
                                  </p>
                                )}
                                {formData.scheds.length > 0 &&
                                  getAvailableScheds(setItem.id).length ===
                                    0 && (
                                    <p className="text-xs text-destructive">
                                      All schedules already assigned.
                                    </p>
                                  )}
                                {formData.scheds.length > 0 &&
                                  getAvailableScheds(setItem.id).length > 0 &&
                                  getFilteredScheds(setItem).length === 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      No schedules match the selected date.
                                    </p>
                                  )}
                              </div>
                            </div>

                            {/* Categories in this set */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-muted-foreground">
                                  Categories in this set
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => addCategoryToSet(setItem.id)}
                                  disabled={
                                    getAvailableScheds(setItem.id).length === 0
                                  }
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
                                <div
                                  key={category.id}
                                  className="flex items-start gap-3"
                                >
                                  <div className="grid gap-3 md:grid-cols-[1.2fr_0.6fr_0.8fr] w-full">
                                    <div className="space-y-2">
                                      <Label className="text-[11px] font-semibold text-muted-foreground">
                                        Category Name
                                      </Label>
                                      <Input
                                        value={category.category_name}
                                        onChange={(e) =>
                                          updateCategoryInSet(
                                            setItem.id,
                                            category.id,
                                            { category_name: e.target.value },
                                          )
                                        }
                                        placeholder="e.g. VIP"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-[11px] font-semibold text-muted-foreground">
                                        Price
                                      </Label>
                                      <Input
                                        value={category.price}
                                        onChange={(e) => {
                                          const next = e.target.value;
                                          if (
                                            next !== "" &&
                                            !/^\d{0,4}(\.\d{0,2})?$/.test(next)
                                          )
                                            return;
                                          updateCategoryInSet(
                                            setItem.id,
                                            category.id,
                                            { price: next },
                                          );
                                        }}
                                        onBlur={() => {
                                          const raw = String(
                                            category.price ?? "",
                                          ).trim();
                                          const normalizedValue =
                                            raw === "" ? 0 : Number(raw);
                                          if (Number.isNaN(normalizedValue)) {
                                            updateCategoryInSet(
                                              setItem.id,
                                              category.id,
                                              { price: "0.00" },
                                            );
                                            return;
                                          }
                                          const clamped = Math.min(
                                            Math.max(normalizedValue, 0),
                                            9999.99,
                                          );
                                          updateCategoryInSet(
                                            setItem.id,
                                            category.id,
                                            { price: clamped.toFixed(2) },
                                          );
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-[11px] font-semibold text-muted-foreground">
                                        Color
                                      </Label>
                                      <Select
                                        value={category.color_code}
                                        onValueChange={(value) =>
                                          updateCategoryInSet(
                                            setItem.id,
                                            category.id,
                                            {
                                              color_code:
                                                value as CategoryDraft["color_code"],
                                            },
                                          )
                                        }
                                      >
                                        <SelectTrigger className="h-9 w-full">
                                          <SelectValue placeholder="Select color" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {COLOR_OPTIONS.map((option) => (
                                            <SelectItem
                                              key={option.value}
                                              value={option.value}
                                            >
                                              <span className="flex items-center gap-2">
                                                {option.swatch ? (
                                                  <span
                                                    className="h-2.5 w-2.5 rounded-full border border-border"
                                                    style={{
                                                      backgroundColor:
                                                        option.swatch,
                                                    }}
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
                                    onClick={() =>
                                      removeCategoryFromSet(
                                        setItem.id,
                                        category.id,
                                      )
                                    }
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
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-sidebar-border shadow-lg bg-card overflow-hidden relative">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Ticket className="w-4 h-4 text-primary" />
                Production Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-sidebar-border/50 group hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground">
                      Total Days
                    </span>
                  </div>
                  <span className="font-black text-xl tracking-tighter">
                    {
                      new Set(
                        formData.scheds.map((s) => {
                          const d = toDateValue(s.sched_date);
                          return toManilaDateKey(d);
                        }),
                      ).size
                    }
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-sidebar-border/50 group hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                      <Play className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground">
                      Total Performances
                    </span>
                  </div>
                  <span className="font-black text-xl tracking-tighter">
                    {formData.scheds.length}
                  </span>
                </div>

                {formData.seatmap_id && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-sidebar-border/50 group hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                        <Armchair className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">
                        Total Capacity
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

          {isEditing ? (
            <div className="grid gap-3">
              {!isFormValid && !isSaving && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-destructive animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider">
                      Required Details Missing
                    </p>
                    <p className="text-xs font-medium leading-relaxed">
                      {missingFields.join(", ")}
                    </p>
                  </div>
                </div>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving || !isFormValid}
                className="w-full h-12 font-black uppercase tracking-widest text-base shadow-xl bg-green-600 hover:bg-green-700 text-white"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                {isSaving ? "Saving changes..." : "Save Production"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    show_name: show.show_name,
                    show_description: show.show_description,
                    venue: show.venue,
                    address: show.address,
                    show_status: show.show_status,
                    show_start_date: toManilaDateKey(
                      new Date(show.show_start_date),
                    ),
                    show_end_date: toManilaDateKey(
                      new Date(show.show_end_date),
                    ),
                    seatmap_id: show.seatmap_id || "",
                    scheds: (show.scheds || []).map((s) => ({
                      ...s,
                      sched_date: toManilaDateKey(new Date(s.sched_date)),
                      sched_start_time:
                        typeof s.sched_start_time === "string" &&
                        s.sched_start_time.includes("T")
                          ? formatManilaTimeKey(new Date(s.sched_start_time))
                          : typeof s.sched_start_time === "string"
                            ? s.sched_start_time
                            : formatManilaTimeKey(new Date(s.sched_start_time)),
                      sched_end_time:
                        typeof s.sched_end_time === "string" &&
                        s.sched_end_time.includes("T")
                          ? formatManilaTimeKey(new Date(s.sched_end_time))
                          : typeof s.sched_end_time === "string"
                            ? s.sched_end_time
                            : formatManilaTimeKey(new Date(s.sched_end_time)),
                      client_id: s.sched_id || uuidv4(),
                    })),
                  });
                  resetCategorySets();
                  setSelectedDates([]);
                  setSelectedSeatIds([]);
                  setTimeRanges([
                    { id: `time-${uuidv4()}`, start: "19:00", end: "21:00" },
                  ]);
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
        <DialogContent
          className={cn(
            "sm:max-w-2xl p-4 sm:p-6",
            numberOfMonths >= 2 && "md:max-h-[90vh] md:overflow-y-auto",
          )}
        >
          <DialogHeader>
            <DialogTitle>Add Schedules</DialogTitle>
            <DialogDescription>
              Select dates and times to add new performances.
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              "grid gap-6",
              numberOfMonths >= 2
                ? "md:grid-cols-1"
                : "md:grid-cols-[1.1fr_1fr]",
            )}
          >
            <div
              className={cn(
                "rounded-lg border p-3 flex justify-center",
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
                  if (!showStartDate || !showEndDate) return false;
                  return date < showStartDate || date > showEndDate;
                }}
                className="[--cell-size:--spacing(7)] text-xs"
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Time Ranges</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {timeRanges.map((range) => (
                    <div
                      key={range.id}
                      className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
                    >
                      <div className="grid gap-1">
                        <Label className="text-[10px]">Start</Label>
                        <Input
                          type="time"
                          value={range.start}
                          onChange={(e) =>
                            updateTimeRange(range.id, { start: e.target.value })
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[10px]">End</Label>
                        <Input
                          type="time"
                          value={range.end}
                          onChange={(e) =>
                            updateTimeRange(range.id, { end: e.target.value })
                          }
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addTimeRange}
                  className="w-full mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Time Slot
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSchedules}>Add Schedules</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
