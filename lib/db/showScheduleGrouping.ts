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

  schedules.forEach((schedule) => {
    const dateKey = toDateKey(schedule.sched_date);
    const start = toTimeKey(schedule.sched_start_time);
    const end = toTimeKey(schedule.sched_end_time);
    const categorySetId = schedule.category_set_id ?? null;
    const setName = schedule.set_name ?? null;
    const signature = `${start}|${end}|${categorySetId ?? ""}|${setName ?? ""}`;

    if (!signatureToDates.has(signature)) {
      signatureToDates.set(signature, new Set<string>());
    }
    signatureToDates.get(signature)?.add(dateKey);

    if (!signatureToItem.has(signature)) {
      signatureToItem.set(signature, {
        sched_start_time: start,
        sched_end_time: end,
        category_set_id: categorySetId,
        set_name: setName,
      });
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

  return Array.from(groupedByRange.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
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
