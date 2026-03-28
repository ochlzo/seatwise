import test from "node:test";
import assert from "node:assert/strict";

import { getAdminPaymentDisplay } from "./adminPaymentDisplay.ts";

test("getAdminPaymentDisplay treats walk-in screenshot urls as uploaded payment proof only", () => {
  const display = getAdminPaymentDisplay("WALK_IN");

  assert.equal(display.kind, "proof_of_payment");
  assert.equal(display.cardTagLabel, "Walk-In");
  assert.equal(display.panelTitle, "Payment Proof");
  assert.equal(display.emptyStateLabel, "No uploaded payment proof for this walk-in payment.");
  assert.match(display.imageAlt("Ada Lovelace"), /uploaded payment proof.*Ada Lovelace/i);
  assert.equal(display.downloadLabel, "Download uploaded payment proof image");
});

test("getAdminPaymentDisplay keeps proof-of-payment copy for online payments", () => {
  const display = getAdminPaymentDisplay("GCASH");

  assert.equal(display.kind, "proof_of_payment");
  assert.equal(display.cardTagLabel, null);
  assert.equal(display.panelTitle, "Payment Proof");
  assert.equal(display.emptyStateLabel, "No uploaded payment proof.");
  assert.match(display.imageAlt("Ada Lovelace"), /Payment proof for Ada Lovelace/);
  assert.equal(display.downloadLabel, "Download uploaded payment proof image");
});

