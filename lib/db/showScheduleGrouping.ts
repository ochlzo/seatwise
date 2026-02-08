type ScheduleInput = {
  sched_date: string | Date;
  sched_start_time: string | Date;
  sched_end_time: string | Date;
  category_set_id?: string | null;
  set_name?: string | null;
};

type GroupItem = {
  sched_start_time: string;
  sched_end_time: string;
  category_set_id: string | null;
  set_name: string | null;
};

export type GroupedScheduleRange = {
  label: string;
  start_date: string;
  end_date: string;
  items: GroupItem[];
};

type SignatureRun = {
  start_date: string;
  end_date: string;
  item: GroupItem;
};

const toDateKey = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (value.includes("T")) {
    return new Date(value).toISOString().slice(0, 10);
  }
  return value;
};

const toTimeKey = (value: string | Date) => {
  if (value instanceof Date) {
    return value.toISOString().slice(11, 16);
  }
  if (value.includes("T")) {
    return new Date(value).toISOString().slice(11, 16);
  }
  return value.slice(0, 5);
};

const addOneDay = (dateKey: string) => {
  const dt = new Date(`${dateKey}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
};

const formatRangeLabel = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const startMonth = start.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const endMonth = end.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();

  if (startDate === endDate) return `${startMonth} ${startDay}`;
  if (startMonth === endMonth) return `${startMonth} ${startDay}-${endDay}`;
  return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
};

export function groupSchedulesByCommonalities(
  schedules: ScheduleInput[],
): GroupedScheduleRange[] {
  const signatureToDates = new Map<string, Set<string>>();
  const signatureToItem = new Map<string, GroupItem>();
  const dateToItems = new Map<string, GroupItem[]>();

  schedules.forEach((schedule) => {
    const dateKey = toDateKey(schedule.sched_date);
    const start = toTimeKey(schedule.sched_start_time);
    const end = toTimeKey(schedule.sched_end_time);
    const categorySetId = schedule.category_set_id ?? null;
    const setName = schedule.set_name ?? null;
    const signature = `${start}|${end}|${categorySetId ?? ""}|${setName ?? ""}`;
    const item: GroupItem = {
      sched_start_time: start,
      sched_end_time: end,
      category_set_id: categorySetId,
      set_name: setName,
    };

    if (!signatureToDates.has(signature)) {
      signatureToDates.set(signature, new Set<string>());
    }
    signatureToDates.get(signature)?.add(dateKey);

    if (!dateToItems.has(dateKey)) {
      dateToItems.set(dateKey, []);
    }
    dateToItems.get(dateKey)?.push(item);

    if (!signatureToItem.has(signature)) {
      signatureToItem.set(signature, item);
    }
  });

  const runs: SignatureRun[] = [];

  signatureToDates.forEach((dateSet, signature) => {
    const item = signatureToItem.get(signature);
    if (!item) return;

    const dates = Array.from(dateSet).sort();
    if (dates.length === 0) return;

    let runStart = dates[0];
    let runEnd = dates[0];

    for (let i = 1; i < dates.length; i += 1) {
      const current = dates[i];
      const expectedNext = addOneDay(runEnd);
      if (current === expectedNext) {
        runEnd = current;
      } else {
        runs.push({
          start_date: runStart,
          end_date: runEnd,
          item,
        });
        runStart = current;
        runEnd = current;
      }
    }

    runs.push({
      start_date: runStart,
      end_date: runEnd,
      item,
    });
  });

  const groupedByRange = new Map<string, GroupedScheduleRange>();

  runs.forEach((run) => {
    const key = `${run.start_date}|${run.end_date}`;
    if (!groupedByRange.has(key)) {
      groupedByRange.set(key, {
        label: formatRangeLabel(run.start_date, run.end_date),
        start_date: run.start_date,
        end_date: run.end_date,
        items: [],
      });
    }
    groupedByRange.get(key)?.items.push(run.item);
  });

  const uniqueItems = (items: GroupItem[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.sched_start_time}|${item.sched_end_time}|${item.category_set_id ?? ""}|${item.set_name ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Track which schedule signatures are covered by multi-day ranges for each date
  const multiDaySchedulesByDate = new Map<string, Set<string>>();

  Array.from(groupedByRange.values()).forEach((group) => {
    if (group.start_date !== group.end_date) {
      // This is a multi-day range
      let currentDate = group.start_date;
      while (currentDate <= group.end_date) {
        if (!multiDaySchedulesByDate.has(currentDate)) {
          multiDaySchedulesByDate.set(currentDate, new Set<string>());
        }
        // Track all schedule signatures in this range for this date
        group.items.forEach((item) => {
          const signature = `${item.sched_start_time}|${item.sched_end_time}|${item.category_set_id ?? ""}|${item.set_name ?? ""}`;
          multiDaySchedulesByDate.get(currentDate)?.add(signature);
        });
        currentDate = addOneDay(currentDate);
      }
    }
  });

  // Filter out single-day groups where ALL schedules are covered by multi-day ranges
  const filteredGroups = Array.from(groupedByRange.values()).filter((group) => {
    const isSingleDay = group.start_date === group.end_date;
    if (isSingleDay) {
      const date = group.start_date;
      const allSchedulesOnDate = dateToItems.get(date) ?? [];
      const multiDaySchedules = multiDaySchedulesByDate.get(date);

      if (!multiDaySchedules || multiDaySchedules.size === 0) {
        // No multi-day ranges cover this date, keep the single-day group
        return true;
      }

      // Check if ALL schedules on this date are covered by multi-day ranges
      const hasUniqueSchedules = allSchedulesOnDate.some((item) => {
        const signature = `${item.sched_start_time}|${item.sched_end_time}|${item.category_set_id ?? ""}|${item.set_name ?? ""}`;
        return !multiDaySchedules.has(signature);
      });

      // Keep single-day group only if it has schedules NOT covered by multi-day ranges
      return hasUniqueSchedules;
    }
    return true; // Keep all multi-day ranges
  });

  return filteredGroups
    .map((group) => ({
      ...group,
      // For single-day groups, show the complete schedule for that day.
      items: uniqueItems(
        group.start_date === group.end_date
          ? [...(dateToItems.get(group.start_date) ?? [])]
          : [...group.items],
      ).sort((a, b) => {
        const timeCompare = a.sched_start_time.localeCompare(b.sched_start_time);
        if (timeCompare !== 0) return timeCompare;
        return (a.category_set_id ?? "").localeCompare(b.category_set_id ?? "");
      }),
    }))
    .sort((a, b) => {
      const startCompare = a.start_date.localeCompare(b.start_date);
      if (startCompare !== 0) return startCompare;
      return a.end_date.localeCompare(b.end_date);
    });
}
