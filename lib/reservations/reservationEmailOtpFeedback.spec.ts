import assert from "node:assert/strict";
import { getReservationEmailOtpInlineError } from "./reservationEmailOtpFeedback.ts";

assert.equal(
  getReservationEmailOtpInlineError(400, "Invalid verification code."),
  "Invalid verification code.",
);

assert.equal(
  getReservationEmailOtpInlineError(410, "Verification code expired. Request a new code."),
  "Verification code expired. Request a new code.",
);

assert.equal(getReservationEmailOtpInlineError(500, "Something went wrong"), null);
