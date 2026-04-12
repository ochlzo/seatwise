import type { ShowStatus } from "@prisma/client";

const MANILA_TZ = "Asia/Manila";

type ShowSchedInput = {
  client_id: string;
  sched_date: string | Date;
  sched_start_time: string | Date;
  sched_end_time: string | Date;
};

type ShowCategoryInput = {
  category_name: string;
  price: string;
  color_code: string;
};

type ShowCategorySetInput = {
  set_name: string;
  apply_to_all: boolean;
  sched_ids: string[];
  categories: ShowCategoryInput[];
  seat_assignments?: Record<string, string>;
};

type ValidateShowPayloadArgs = {
  show_name: string;
  show_description: string;
  venue: string;
  address: string;
  show_status: ShowStatus;
  show_start_date: string | Date;
  show_end_date: string | Date;
  gcash_qr_image_key?: string | null;
  gcash_qr_image_base64?: string;
  gcash_number?: string;
  gcash_account_name?: string;
  seatmap_id?: string | null;
  ticket_template_ids?: string[] | null;
  ticket_template_id?: string | null;
  scheds: ShowSchedInput[];
  categorySets: ShowCategorySetInput[];
  seatIds: string[];
  seatmapExists: boolean;
  ticketTemplatesExist?: boolean;
  ticketTemplateExists?: boolean;
};

type ValidationState = {
  fieldErrors: {
    show_name: boolean;
    show_description: boolean;
    venue: boolean;
    address: boolean;
    show_status: boolean;
    show_start_date: boolean;
    show_end_date: boolean;
    gcash_qr_image_key: boolean;
    gcash_number: boolean;
    gcash_account_name: boolean;
    seatmap_id: boolean;
    ticket_template_id: boolean;
  };
  cardErrors: {
    schedule: boolean;
    seatmap: boolean;
    gcash: boolean;
  };
};

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

const toDateKey = (value: string | Date) => {
  if (typeof value === "string") {
    return value.includes("T") ? toManilaDateKey(new Date(value)) : value;
  }
  return toManilaDateKey(value);
};

const toDateOnly = (value: string | Date) => {
  const dateKey = toDateKey(value);
  return new Date(`${dateKey}T00:00:00.000Z`);
};

const toMinutes = (value: string | Date) => {
  const timeValue =
    typeof value === "string"
      ? value.includes("T")
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: MANILA_TZ,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(value))
        : value
      : new Intl.DateTimeFormat("en-GB", {
          timeZone: MANILA_TZ,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(value);

  const [hours, minutes] = timeValue.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const buildDateRangeKeys = (start: string | Date, end: string | Date) => {
  const startDate = toDateOnly(start);
  const endDate = toDateOnly(end);
  const dates: string[] = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    dates.push(toDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

const buildValidationMessage = (validation: ValidationState) => {
  const { fieldErrors, cardErrors } = validation;

  if (fieldErrors.show_name) return "Show name is required.";
  if (fieldErrors.show_description) return "Show description is required.";
  if (fieldErrors.venue) return "Venue is required.";
  if (fieldErrors.address) return "Address is required.";
  if (fieldErrors.gcash_qr_image_key) return "GCash QR image is required.";
  if (fieldErrors.gcash_number) return "GCash number is required.";
  if (fieldErrors.gcash_account_name) return "GCash account name is required.";
  if (fieldErrors.show_start_date || fieldErrors.show_end_date) {
    return "A valid show date range is required.";
  }
  if (fieldErrors.ticket_template_id) return "One or more selected ticket templates were not found.";
  if (fieldErrors.seatmap_id) return "A seatmap is required for UPCOMING, OPEN, or DRY_RUN shows.";
  if (cardErrors.schedule) {
    return "Schedules must cover every show date without overlapping time ranges.";
  }
  if (cardErrors.seatmap) {
    return "Every seat must be assigned to a valid category in each category set.";
  }

  return "Please complete all required fields.";
};

export function validateShowPayload(args: ValidateShowPayloadArgs) {
  const {
    show_name,
    show_description,
    venue,
    address,
    show_status,
    show_start_date,
    show_end_date,
    gcash_qr_image_key,
    gcash_qr_image_base64,
    gcash_number,
    gcash_account_name,
    seatmap_id,
    ticket_template_ids,
    ticket_template_id,
    scheds,
    categorySets,
    seatIds,
    seatmapExists,
    ticketTemplatesExist,
    ticketTemplateExists = true,
  } = args;

  const normalizedTicketTemplateIds = Array.isArray(ticket_template_ids)
    ? ticket_template_ids.map((value) => value.trim()).filter(Boolean)
    : [];
  const hasTicketTemplateSelection =
    normalizedTicketTemplateIds.length > 0 || !!ticket_template_id?.trim();
  const templatesExist =
    ticketTemplatesExist ?? ticketTemplateExists;

  const hasDateRange = !!show_start_date && !!show_end_date;
  const dateRangeInvalid = hasDateRange
    ? toDateOnly(show_start_date).getTime() > toDateOnly(show_end_date).getTime()
    : false;
  const requiresSeatmap =
    show_status === "UPCOMING" ||
    show_status === "OPEN" ||
    show_status === "DRY_RUN";

  const normalizedSetNames = categorySets.map(
    (setItem, index) => setItem.set_name?.trim() || `Set ${index + 1}`,
  );

  const flatCategories = categorySets.flatMap((setItem) => setItem.categories);
  const uniqueCategoryMap = new Map<string, (typeof flatCategories)[number]>();
  flatCategories.forEach((category) => {
    const key = `${category.category_name.trim().toLowerCase()}|${Number(category.price).toString()}|${category.color_code}`;
    if (!uniqueCategoryMap.has(key)) {
      uniqueCategoryMap.set(key, category);
    }
  });
  const uniqueCategories = Array.from(uniqueCategoryMap.values());

  const fieldErrors: ValidationState["fieldErrors"] = {
    show_name: !show_name?.trim(),
    show_description: !show_description?.trim(),
    venue: !venue?.trim(),
    address: !address?.trim(),
    show_status: !show_status,
    show_start_date: !show_start_date || dateRangeInvalid,
    show_end_date: !show_end_date || dateRangeInvalid,
    gcash_qr_image_key:
      !gcash_qr_image_key?.trim() && !gcash_qr_image_base64?.trim(),
    gcash_number: !gcash_number?.trim(),
    gcash_account_name: !gcash_account_name?.trim(),
    seatmap_id: requiresSeatmap && !seatmap_id?.trim(),
    ticket_template_id:
      hasTicketTemplateSelection && !templatesExist,
  };

  const allClientSchedIds = scheds.map((sched) => sched.client_id);
  const scheduleDates = new Set(scheds.map((sched) => toDateKey(sched.sched_date)));
  const expectedDateKeys =
    hasDateRange && !dateRangeInvalid
      ? buildDateRangeKeys(show_start_date, show_end_date)
      : [];
  const missingDates = expectedDateKeys.filter((dateKey) => !scheduleDates.has(dateKey));

  const scheduleRangesByDate = new Map<string, Array<{ start: number; end: number }>>();
  let hasInvalidScheduleRange = false;
  for (const sched of scheds) {
    const start = toMinutes(sched.sched_start_time);
    const end = toMinutes(sched.sched_end_time);
    if (start === null || end === null || end <= start) {
      hasInvalidScheduleRange = true;
      continue;
    }

    const dateKey = toDateKey(sched.sched_date);
    const ranges = scheduleRangesByDate.get(dateKey) ?? [];
    ranges.push({ start, end });
    scheduleRangesByDate.set(dateKey, ranges);
  }

  let hasOverlappingSchedules = false;
  scheduleRangesByDate.forEach((ranges) => {
    if (hasOverlappingSchedules) return;
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index].start < sorted[index - 1].end) {
        hasOverlappingSchedules = true;
        break;
      }
    }
  });

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

  const seenSetNames = new Set<string>();
  let hasDuplicateSetName = false;
  for (const setName of normalizedSetNames) {
    const key = setName.toLowerCase();
    if (seenSetNames.has(key)) {
      hasDuplicateSetName = true;
      break;
    }
    seenSetNames.add(key);
  }

  const clientSchedToSetName = new Map<string, string>();
  let hasDuplicateSchedAssignment = false;
  let hasInvalidSchedReference = false;
  let hasInvalidCategoryReference = false;
  let hasIncompleteSeatAssignment = false;
  const validSeatIds = new Set(seatIds);

  categorySets.forEach((setItem, index) => {
    const setName = normalizedSetNames[index];

    for (const schedId of setItem.sched_ids) {
      if (!allClientSchedIds.includes(schedId)) {
        hasInvalidSchedReference = true;
        continue;
      }

      const existing = clientSchedToSetName.get(schedId);
      if (existing && existing !== setName) {
        hasDuplicateSchedAssignment = true;
      } else {
        clientSchedToSetName.set(schedId, setName);
      }
    }

    const normalizedCategoryNameCounts = new Map<string, number>();
    setItem.categories.forEach((category) => {
      const key = category.category_name.trim().toLowerCase();
      if (!key) return;
      normalizedCategoryNameCounts.set(
        key,
        (normalizedCategoryNameCounts.get(key) ?? 0) + 1,
      );
    });

    const validCategoryNames = new Set(
      setItem.categories
        .map((category) => category.category_name.trim().toLowerCase())
        .filter(Boolean),
    );
    const validAssignedSeatIds = new Set<string>();

    Object.entries(setItem.seat_assignments ?? {}).forEach(([seatId, categoryName]) => {
      const normalizedCategoryName = categoryName.trim().toLowerCase();
      const categoryCount = normalizedCategoryNameCounts.get(normalizedCategoryName) ?? 0;

      if (
        !validSeatIds.has(seatId) ||
        !validCategoryNames.has(normalizedCategoryName) ||
        categoryCount !== 1
      ) {
        hasInvalidCategoryReference = true;
        return;
      }

      validAssignedSeatIds.add(seatId);
    });

    if (
      seatIds.length > 0 &&
      seatIds.some((seatId) => !validAssignedSeatIds.has(seatId))
    ) {
      hasIncompleteSeatAssignment = true;
    }
  });

  const hasUnassignedScheds =
    allClientSchedIds.length > 0 && clientSchedToSetName.size !== allClientSchedIds.length;

  const cardErrors: ValidationState["cardErrors"] = {
    schedule:
      (requiresSeatmap && scheds.length === 0) ||
      missingDates.length > 0 ||
      hasInvalidScheduleRange ||
      hasOverlappingSchedules,
    seatmap:
      (requiresSeatmap && (!seatmap_id?.trim() || !seatmapExists)) ||
      (!!seatmap_id?.trim() &&
        (!seatmapExists ||
          categorySets.length === 0 ||
          hasInvalidCategory ||
          hasDuplicateSetName ||
          hasDuplicateSchedAssignment ||
          hasInvalidSchedReference ||
          hasUnassignedScheds ||
          hasInvalidCategoryReference ||
          hasIncompleteSeatAssignment)),
    gcash:
      fieldErrors.gcash_qr_image_key ||
      fieldErrors.gcash_number ||
      fieldErrors.gcash_account_name,
  };

  const validation = { fieldErrors, cardErrors };

  return {
    validation,
    hasValidationErrors:
      Object.values(fieldErrors).some(Boolean) ||
      Object.values(cardErrors).some(Boolean),
    errorMessage: buildValidationMessage(validation),
    normalizedSetNames,
    uniqueCategories,
  };
}
