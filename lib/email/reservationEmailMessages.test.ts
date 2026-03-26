import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReservationStatusUpdateEmailMessage,
  buildReservationSubmittedEmailMessage,
  buildWalkInReceiptEmailMessage,
} from "./reservationEmailMessages.ts";

const sender = "seatwise@example.com";

test("buildReservationSubmittedEmailMessage keeps the pending GCash proof inline and attached", () => {
  const raw = buildReservationSubmittedEmailMessage({
    sender,
    payload: {
      to: "ada@example.com",
      customerName: "Ada Lovelace",
      reservationNumber: "4821",
      showName: "Seatwise Live",
      scheduleLabel: "Apr 10, 2026, 7:00 PM - 9:00 PM",
      seatNumbers: ["A1", "A2"],
      totalAmount: "PHP 900.00",
      proofImageUrl: "https://cdn.example.com/proof.png",
    },
    proofAttachment: {
      filename: "gcash-proof-4821.png",
      contentType: "image/png",
      content: Buffer.from("proof"),
    },
  });

  assert.match(raw, /Subject: Seatwise Reservation Received - Seatwise Live/);
  assert.match(raw, /GCash proof of payment/);
  assert.match(raw, /https:\/\/cdn\.example\.com\/proof\.png/);
  assert.match(raw, /Content-Disposition: attachment; filename="gcash-proof-4821\.png"/);
});

test("buildReservationStatusUpdateEmailMessage keeps confirmed receipts inline and attached", () => {
  const raw = buildReservationStatusUpdateEmailMessage({
    sender,
    payload: {
      to: "ada@example.com",
      customerName: "Ada Lovelace",
      targetStatus: "CONFIRMED",
      lineItems: [
        {
          reservationNumber: "4821",
          showName: "Seatwise Live",
          venue: "Main Hall",
          scheduleLabel: "Apr 10, 2026, 7:00 PM - 9:00 PM",
          seatNumbers: ["A1", "A2"],
          amount: "PHP 900.00",
          paymentMethod: "GCASH",
        },
      ],
    },
    receiptImageUrls: ["https://cdn.example.com/receipt.png"],
    receiptAttachments: [
      {
        filename: "reservation-receipt-4821.png",
        contentType: "image/png",
        content: Buffer.from("receipt"),
      },
    ],
  });

  assert.match(raw, /Subject: Seatwise Reservation Confirmed/);
  assert.match(raw, /Reservation receipt 1/);
  assert.match(raw, /https:\/\/cdn\.example\.com\/receipt\.png/);
  assert.match(raw, /Content-Disposition: attachment; filename="reservation-receipt-4821\.png"/);
});

test("buildWalkInReceiptEmailMessage keeps walk-in receipt copy inline and attached", () => {
  const raw = buildWalkInReceiptEmailMessage({
    sender,
    payload: {
      to: "ada@example.com",
      customerName: "Ada Lovelace",
      reservationNumber: "4821",
      showName: "Seatwise Live",
      scheduleLabel: "Apr 10, 2026, 7:00 PM - 9:00 PM",
      seatNumbers: ["A1", "A2"],
      totalAmount: "PHP 900.00",
      receiptImageUrl: "https://cdn.example.com/walk-in.png",
    },
    receiptAttachment: {
      filename: "walk-in-receipt-4821.png",
      contentType: "image/png",
      content: Buffer.from("walk-in"),
    },
  });

  assert.match(raw, /Subject: Seatwise Walk-In Receipt - Seatwise Live/);
  assert.match(raw, /Walk-in \/ bought in person/);
  assert.match(raw, /https:\/\/cdn\.example\.com\/walk-in\.png/);
  assert.match(raw, /Content-Disposition: attachment; filename="walk-in-receipt-4821\.png"/);
});
