export type VisibleQueueRankEntry = {
  ticketId: string;
  isTarget: boolean;
  hasTicketData: boolean;
  hasCurrentUserMapping: boolean;
};

export function computeVisibleQueueRank(entries: VisibleQueueRankEntry[]): number | null {
  let visibleEntriesAhead = 0;

  for (const entry of entries) {
    const isVisible = entry.hasTicketData && entry.hasCurrentUserMapping;

    if (entry.isTarget) {
      return isVisible ? visibleEntriesAhead + 1 : null;
    }

    if (isVisible) {
      visibleEntriesAhead += 1;
    }
  }

  return null;
}
