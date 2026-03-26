import test from "node:test";
import assert from "node:assert/strict";

import { getAdminPaymentDisplay } from "./adminPaymentDisplay.ts";

test("getAdminPaymentDisplay returns walk-in receipt labels for WALK_IN payments", () => {
  const display = getAdminPaymentDisplay("WALK_IN");

  assert.equal(display.kind, "walk_in_receipt");
  assert.equal(display.cardTagLabel, "Walk-In");
  assert.equal(display.panelTitle, "Walk-In Receipt");
  assert.equal(display.emptyStateLabel, "No walk-in receipt uploaded.");
  assert.match(display.imageAlt("Ada Lovelace"), /Walk-in receipt for Ada Lovelace/);
  assert.equal(display.downloadLabel, "Download walk-in receipt image");
});

test("getAdminPaymentDisplay keeps proof-of-payment copy for online payments", () => {
  const display = getAdminPaymentDisplay("GCASH");

  assert.equal(display.kind, "proof_of_payment");
  assert.equal(display.cardTagLabel, null);
  assert.equal(display.panelTitle, "Proof Of Payment");
  assert.equal(display.emptyStateLabel, "No payment image uploaded.");
  assert.match(display.imageAlt("Ada Lovelace"), /Payment proof for Ada Lovelace/);
  assert.equal(display.downloadLabel, "Download proof of payment image");
});

