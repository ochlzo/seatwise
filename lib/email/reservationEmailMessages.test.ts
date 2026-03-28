import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReservationStatusUpdateEmailMessage,
  buildReservationSubmittedEmailMessage,
  buildTeamLeaderReservationNotificationEmailMessage,
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

test("buildReservationStatusUpdateEmailMessage keeps confirmed status emails attachment-free", () => {
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
  });

  assert.match(raw, /Subject: Seatwise Reservation Confirmed/);
  assert.doesNotMatch(raw, /receipt image/i);
  assert.doesNotMatch(raw, /reservation receipt/i);
  assert.doesNotMatch(raw, /Content-Disposition: attachment;/);
  assert.doesNotMatch(raw, /https?:\/\/[^\s"]+/i);
});

test("buildTeamLeaderReservationNotificationEmailMessage includes guest details and proof attachment", () => {
  const raw = buildTeamLeaderReservationNotificationEmailMessage({
    sender,
    payload: {
      to: "leader@example.com",
      leaderName: "Team Lead",
      reservationNumber: "6001",
      showName: "Seatwise Live",
      venue: "Main Hall",
      scheduleLabel: "Apr 11, 2026, 7:00 PM - 9:00 PM",
      seatNumbers: ["B1", "B2"],
      totalAmount: "PHP 1200.00",
      guestName: "Ada Lovelace",
      guestEmail: "ada@example.com",
      guestPhone: "09171234567",
      guestAddress: "123 Main Street",
      proofImageUrl: "https://cdn.example.com/proof-team.png",
    },
    proofAttachment: {
      filename: "gcash-proof-6001.png",
      contentType: "image/png",
      content: Buffer.from("proof"),
    },
  });

  assert.match(raw, /Subject: Seatwise Reservation Alert - Seatwise Live/);
  assert.match(raw, /Guest details/);
  assert.match(raw, /ada@example.com/);
  assert.match(raw, /09171234567/);
  assert.match(raw, /Content-Disposition: attachment; filename="gcash-proof-6001\.png"/);
});
