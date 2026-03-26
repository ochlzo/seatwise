import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminWalkInRoomHref,
  shouldAutoEnterWalkInRoom,
  type WalkInEntryState,
} from "./walkInEntry.ts";

test("shouldAutoEnterWalkInRoom auto-enters only on the first active state", () => {
  assert.equal(shouldAutoEnterWalkInRoom(null, "active_and_paused"), true);
  assert.equal(shouldAutoEnterWalkInRoom("queued", "active_and_paused"), false);
  assert.equal(shouldAutoEnterWalkInRoom("active_and_paused", "active_and_paused"), false);
});

test("shouldAutoEnterWalkInRoom never auto-enters for queued state", () => {
  const previousStates: Array<WalkInEntryState | null> = [null, "queued", "active_and_paused"];

  for (const previousState of previousStates) {
    assert.equal(shouldAutoEnterWalkInRoom(previousState, "queued"), false);
  }
});

test("buildAdminWalkInRoomHref creates the dedicated room route", () => {
  assert.equal(
    buildAdminWalkInRoomHref("show-123", "sched-456"),
    "/admin/walk-in/show-123/sched-456/room",
  );
});
