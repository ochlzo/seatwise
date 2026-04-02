import assert from "node:assert/strict";
import {
  DEFAULT_QUEUE_PRESENCE_TTL_SECONDS,
  OTP_QUEUE_PRESENCE_TTL_SECONDS,
  getQueuePresenceTtlSeconds,
} from "./presenceTtl.ts";

assert.equal(getQueuePresenceTtlSeconds("email_otp"), OTP_QUEUE_PRESENCE_TTL_SECONDS);
assert.equal(getQueuePresenceTtlSeconds("contact"), DEFAULT_QUEUE_PRESENCE_TTL_SECONDS);
assert.equal(getQueuePresenceTtlSeconds(undefined), DEFAULT_QUEUE_PRESENCE_TTL_SECONDS);
