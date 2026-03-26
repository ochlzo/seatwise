import test from "node:test";
import assert from "node:assert/strict";

import {
  WALK_IN_QUEUE_PAUSE_MESSAGE,
  createQueuePauseState,
  parseQueuePauseState,
  shouldClearWalkInPauseState,
} from "./pauseState.ts";

test("createQueuePauseState uses the walk-in copy for walk_in pauses", () => {
  const pauseState = createQueuePauseState("walk_in");

  assert.equal(pauseState.reason, "walk_in");
  assert.equal(pauseState.message, WALK_IN_QUEUE_PAUSE_MESSAGE);
  assert.equal(typeof pauseState.pausedAt, "number");
});

test("parseQueuePauseState upgrades legacy truthy pause flags to postponed copy", () => {
  const pauseState = parseQueuePauseState("1");

  assert.equal(pauseState?.reason, "postponed");
  assert.equal(pauseState?.message, "This show has been postponed. Queue is temporarily paused.");
});

test("shouldClearWalkInPauseState clears stale walk-in pauses without a live active session", () => {
  assert.equal(
    shouldClearWalkInPauseState({
      pauseState: createQueuePauseState("walk_in"),
      hasLiveActiveSession: false,
    }),
    true,
  );

  assert.equal(
    shouldClearWalkInPauseState({
      pauseState: createQueuePauseState("walk_in"),
      hasLiveActiveSession: true,
    }),
    false,
  );

  assert.equal(
    shouldClearWalkInPauseState({
      pauseState: createQueuePauseState("postponed"),
      hasLiveActiveSession: false,
    }),
    false,
  );
});
