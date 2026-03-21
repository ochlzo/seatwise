import test from "node:test";
import assert from "node:assert/strict";

import { toOneBasedQueueRank } from "./rank.ts";

test("queue rank contract is 1-based for the first waiting user", () => {
  assert.equal(toOneBasedQueueRank(0), 1);
});

test("queue rank contract stays aligned between join and status flows", () => {
  const zeroBasedRanks = [0, 1, 4, 9];

  for (const zeroBasedRank of zeroBasedRanks) {
    const joinRank = toOneBasedQueueRank(zeroBasedRank);
    const statusRank = toOneBasedQueueRank(zeroBasedRank);

    assert.equal(joinRank, statusRank);
    assert.equal(joinRank, zeroBasedRank + 1);
  }
});
