export type ShowStructureColorCode =
  | "NO_COLOR"
  | "GOLD"
  | "PINK"
  | "BLUE"
  | "BURGUNDY"
  | "GREEN";

export type ShowStructureCategoryState = {
  category_name: string;
  price: string;
  color_code: ShowStructureColorCode;
};

export type ShowStructureCategorySetState = {
  category_set_id: string;
  seatmap_id?: string | null;
  categories: ShowStructureCategoryState[];
  seat_assignments: Record<string, string>;
};

export type ShowStructureScheduleState = {
  sched_id: string;
  category_set_id: string | null;
};

const normalizeCategoryName = (value: string) => value.trim().toLowerCase();

export const buildShowStructureCategoryKey = (
  category: ShowStructureCategoryState,
) =>
  `${normalizeCategoryName(category.category_name)}|${Number(category.price).toString()}|${category.color_code}`;

export const buildShowStructureSetSignature = (
  setState: ShowStructureCategorySetState,
) => {
  const seatmapKey = setState.seatmap_id ?? "";
  const categoryKeyByName = new Map(
    setState.categories.map((category) => [
      normalizeCategoryName(category.category_name),
      buildShowStructureCategoryKey(category),
    ]),
  );

  const categoryKeys = [...setState.categories]
    .map(buildShowStructureCategoryKey)
    .sort();
  const seatAssignmentKeys = Object.entries(setState.seat_assignments)
    .map(([seatId, categoryName]) => {
      const normalizedCategoryName = normalizeCategoryName(categoryName);
      const categoryKey =
        categoryKeyByName.get(normalizedCategoryName) ??
        `missing:${normalizedCategoryName}`;
      return `${seatId}|${categoryKey}`;
    })
    .sort();

  return `${seatmapKey}::${categoryKeys.join(",")}::${seatAssignmentKeys.join(",")}`;
};

export function collectAffectedScheduleIdsForDerivedRows({
  previousSchedules,
  nextSchedules,
  previousCategorySets,
  nextCategorySets,
}: {
  previousSchedules: ShowStructureScheduleState[];
  nextSchedules: ShowStructureScheduleState[];
  previousCategorySets: ShowStructureCategorySetState[];
  nextCategorySets: ShowStructureCategorySetState[];
}) {
  const previousScheduleMap = new Map(
    previousSchedules.map((schedule) => [schedule.sched_id, schedule]),
  );
  const nextScheduleMap = new Map(
    nextSchedules.map((schedule) => [schedule.sched_id, schedule]),
  );

  const previousSetSignatureMap = new Map(
    previousCategorySets.map((setState) => [
      setState.category_set_id,
      buildShowStructureSetSignature(setState),
    ]),
  );
  const nextSetSignatureMap = new Map(
    nextCategorySets.map((setState) => [
      setState.category_set_id,
      buildShowStructureSetSignature(setState),
    ]),
  );

  const affected = new Set<string>();

  for (const [schedId, previousSchedule] of previousScheduleMap.entries()) {
    const nextSchedule = nextScheduleMap.get(schedId);
    if (!nextSchedule) {
      affected.add(schedId);
      continue;
    }

    const previousSetId = previousSchedule.category_set_id;
    const nextSetId = nextSchedule.category_set_id;
    const previousSignature = previousSetId
      ? previousSetSignatureMap.get(previousSetId)
      : undefined;
    const nextSignature = nextSetId
      ? nextSetSignatureMap.get(nextSetId)
      : undefined;

    if (previousSetId === nextSetId) {
      if (previousSetId && previousSignature !== nextSignature) {
        affected.add(schedId);
      }
      continue;
    }

    if (previousSignature !== nextSignature) {
      affected.add(schedId);
    }
  }

  for (const [schedId, nextSchedule] of nextScheduleMap.entries()) {
    if (!previousScheduleMap.has(schedId) && nextSchedule.category_set_id) {
      affected.add(schedId);
    }
  }

  return [...affected].sort();
}

export function collectRemovedCategorySetIds({
  existingCategorySets,
  nextCategorySets,
}: {
  existingCategorySets: Array<{
    category_set_id: string;
  }>;
  nextCategorySets: Array<{
    id: string;
  }>;
}) {
  const nextDraftIds = new Set(nextCategorySets.map((setItem) => setItem.id));
  return existingCategorySets
    .map((setItem) => setItem.category_set_id)
    .filter((categorySetId) => !nextDraftIds.has(categorySetId))
    .sort();
}
