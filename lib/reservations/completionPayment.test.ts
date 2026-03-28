import test from "node:test";
import assert from "node:assert/strict";

import { buildCompletionPaymentRecord } from "./completionPayment.ts";

test("buildCompletionPaymentRecord keeps the online pending payment branch", () => {
  const payment = buildCompletionPaymentRecord({
    mode: "online",
    assetUrl: "https://cdn.example.com/proof.png",
    paidAt: new Date("2026-03-27T10:00:00.000Z"),
  });

  assert.equal(payment.method, "GCASH");
  assert.equal(payment.status, "PENDING");
  assert.equal(payment.screenshot_url, "https://cdn.example.com/proof.png");
  assert.equal(payment.paid_at, null);
});

test("buildCompletionPaymentRecord keeps walk-in sales paid without a generated receipt image url", () => {
  const paidAt = new Date("2026-03-27T10:00:00.000Z");
  const payment = buildCompletionPaymentRecord({
    mode: "walk_in",
    assetUrl: "https://cdn.example.com/receipt.png",
    paidAt,
  });

  assert.equal(payment.method, "WALK_IN");
  assert.equal(payment.status, "PAID");
  assert.equal(payment.screenshot_url, null);
  assert.equal(payment.paid_at, paidAt);
});

