import test from "node:test";
import assert from "node:assert/strict";

import { getReservationRoomModeConfig } from "./reservationRoomMode.ts";

test("online reservation mode keeps the upload-first payment flow", () => {
  const config = getReservationRoomModeConfig("online");

  assert.equal(config.requiresScreenshotUpload, true);
  assert.equal(config.paymentTitle, "Upload GCash Payment");
  assert.equal(config.paymentActionLabel, "Submit Reservation");
  assert.equal(config.paymentConfirmationTitle, "Submit reservation?");
});

test("walk-in reservation mode uses explicit in-person confirmation copy", () => {
  const config = getReservationRoomModeConfig("walk_in");

  assert.equal(config.requiresScreenshotUpload, false);
  assert.equal(config.paymentTitle, "Confirm Walk-In Payment");
  assert.equal(config.paymentActionLabel, "Review Walk-In Sale");
  assert.equal(config.paymentConfirmationTitle, "Payment received?");
  assert.equal(config.finalConfirmationTitle, "Finalize walk-in sale?");
});
