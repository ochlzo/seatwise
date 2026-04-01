import assert from "node:assert/strict";
import { isQueueCompletionSessionRecovery } from "./queueCompletionRecovery.ts";

assert.equal(
  isQueueCompletionSessionRecovery({
    status: 400,
    error: "Active session is invalid or expired",
    reason: "expired",
  }),
  true,
);

assert.equal(
  isQueueCompletionSessionRecovery({
    status: 400,
    error: "Please select at least one seat.",
  }),
  false,
);
