import assert from "node:assert/strict";
import test from "node:test";

import { interpolateTicketFields } from "./interpolateTicketFields.ts";

test("interpolateTicketFields maps reservation, seat, and schedule data into ticket fields", () => {
  const interpolated = interpolateTicketFields({
    reservation: {
      reservationId: "reservation-123",
      reservationNumber: "SW-2026-0001",
      firstName: "Alex",
      lastName: "Rivera",
    },
    show: {
      showName: "Seatwise Live",
      venue: "Seatwise Theater",
    },
    schedule: {
      schedDate: "2026-04-10T00:00:00.000Z",
      schedStartTime: "1970-01-01T11:30:00.000Z",
    },
    seats: [
      {
        seatCategory: "VIP",
        seat: "12",
      },
      {
        seatCategory: "VIP",
        seat: "13",
      },
    ],
    qrToken: "signed-token",
    verificationUrl: "https://seatwise.test/ticket/verify/signed-token",
  });

  assert.deepEqual(interpolated.seatLabels, ["12", "13"]);
  assert.equal(interpolated.qrToken, "signed-token");
  assert.equal(
    interpolated.verificationUrl,
    "https://seatwise.test/ticket/verify/signed-token",
  );
  assert.deepEqual(interpolated.fields, {
    show_name: "Seatwise Live",
    venue: "Seatwise Theater",
    show_date: "Apr 10, 2026",
    show_time: "7:30 PM",
    seat_category: "VIP",
    seat: "12, 13",
    reservation_number: "SW-2026-0001",
    customer_name: "Alex Rivera",
  });
});
