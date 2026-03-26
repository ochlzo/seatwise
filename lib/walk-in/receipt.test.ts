import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWalkInReceiptAttachment,
  buildWalkInReceiptSvg,
  buildWalkInReceiptUploadDataUri,
} from "./receipt.ts";

const payload = {
  reservationNumber: "4821",
  customerName: "Ada Lovelace",
  customerEmail: "ada@example.com",
  customerPhoneNumber: "09171234567",
  showName: "Seatwise Live",
  venue: "Main Hall",
  scheduleLabel: "Apr 1, 2026, 11:30 AM - 1:00 PM",
  seatNumbers: ["A1", "A2"],
  totalAmount: 900,
  issuedAt: new Date("2026-04-01T10:15:00+08:00"),
};

test("buildWalkInReceiptSvg includes walk-in wording and reservation details", () => {
  const svg = buildWalkInReceiptSvg(payload);

  assert.match(svg, /Seatwise Walk-In Receipt/);
  assert.match(svg, /Bought in person/);
  assert.match(svg, /#4821/);
  assert.match(svg, /Ada Lovelace/);
  assert.match(svg, /A1/);
  assert.match(svg, /A2/);
  assert.match(svg, /WALK_IN/);
});

test("buildWalkInReceiptUploadDataUri encodes the SVG as a data URI", () => {
  const dataUri = buildWalkInReceiptUploadDataUri(payload);

  assert.match(dataUri, /^data:image\/svg\+xml;base64,/);
});

test("buildWalkInReceiptAttachment returns a named svg attachment", () => {
  const attachment = buildWalkInReceiptAttachment(payload);

  assert.equal(attachment.filename, "seatwise-walk-in-4821.svg");
  assert.equal(attachment.mimeType, "image/svg+xml");
  assert.ok(attachment.content.length > 0);
});

test("buildWalkInReceiptSvg supports generic confirmed-receipt copy", () => {
  const svg = buildWalkInReceiptSvg({
    ...payload,
    title: "Seatwise Reservation Receipt",
    headline: "Payment verified",
    paymentMethodLabel: "Method: GCASH",
  });

  assert.match(svg, /Seatwise Reservation Receipt/);
  assert.match(svg, /Payment verified/);
  assert.match(svg, /Method: GCASH/);
});
