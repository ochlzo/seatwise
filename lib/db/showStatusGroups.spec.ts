import assert from "node:assert/strict";

import { ACTIVE_SHOW_STATUSES } from "./showStatusGroups.ts";

assert.deepEqual(ACTIVE_SHOW_STATUSES, ["UPCOMING", "OPEN", "ON_GOING"]);
assert.equal(ACTIVE_SHOW_STATUSES.includes("DRY_RUN" as never), false);

console.log("showStatusGroups.spec.ts passed");
