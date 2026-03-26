export type WalkInEntryState = "queued" | "active_and_paused";

export function shouldAutoEnterWalkInRoom(
  previousState: WalkInEntryState | null,
  nextState: WalkInEntryState,
) {
  return previousState === null && nextState === "active_and_paused";
}

export function buildAdminWalkInRoomHref(showId: string, schedId: string) {
  return `/admin/walk-in/${showId}/${schedId}/room`;
}
