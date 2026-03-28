import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTicketVerificationUrl,
  createSignedQrPayload,
  normalizeScannedTicketToken,
  verifySignedQrPayload,
} from "./qrPayload.ts";

test("createSignedQrPayload signs a token that can be verified", () => {
  const token = createSignedQrPayload(
    {
      reservationId: "reservation-123",
      reservationNumber: "SW-2026-0001",
    },
    {
      secret: "seatwise-ticket-secret",
    },
  );

  const verified = verifySignedQrPayload(token, {
    secret: "seatwise-ticket-secret",
  });

  assert.deepEqual(verified, {
    reservationId: "reservation-123",
    reservationNumber: "SW-2026-0001",
  });
});

test("verifySignedQrPayload rejects tampered tokens", () => {
  const token = createSignedQrPayload(
    {
      reservationId: "reservation-123",
      reservationNumber: "SW-2026-0001",
    },
    {
      secret: "seatwise-ticket-secret",
    },
  );

  const parts = token.split(".");
  const tamperedPayload = Buffer.from(
    JSON.stringify({
      reservationId: "reservation-999",
      reservationNumber: "SW-2026-0001",
    }),
    "utf8",
  ).toString("base64url");
  const tamperedToken = [parts[0], tamperedPayload, parts[2]].join(".");

  assert.equal(
    verifySignedQrPayload(tamperedToken, {
      secret: "seatwise-ticket-secret",
    }),
    null,
  );
});

test("buildTicketVerificationUrl appends the signed token to the public route", () => {
  const token = createSignedQrPayload(
    {
      reservationId: "reservation-123",
      reservationNumber: "SW-2026-0001",
    },
    {
      secret: "seatwise-ticket-secret",
    },
  );

  const url = buildTicketVerificationUrl(token, {
    baseUrl: "https://seatwise.test",
  });

  assert.equal(url, `https://seatwise.test/ticket/verify/${token}`);
});

test("normalizeScannedTicketToken extracts the signed token from a verification URL", () => {
  const token = createSignedQrPayload(
    {
      reservationId: "reservation-123",
      reservationNumber: "SW-2026-0001",
    },
    {
      secret: "seatwise-ticket-secret",
    },
  );

  const url = buildTicketVerificationUrl(token, {
    baseUrl: "https://seatwise.test",
  });

  assert.equal(normalizeScannedTicketToken(url), token);
});
