import test from "node:test";
import assert from "node:assert/strict";

import { isSchedStatusReservable } from "./reservationEligibility.ts";

test("isSchedStatusReservable allows OPEN and ON_GOING schedules", () => {
  assert.equal(isSchedStatusReservable("OPEN"), true);
  assert.equal(isSchedStatusReservable("ON_GOING"), true);
});

test("isSchedStatusReservable blocks FULLY_BOOKED and CLOSED schedules", () => {
  assert.equal(isSchedStatusReservable("FULLY_BOOKED"), false);
  assert.equal(isSchedStatusReservable("CLOSED"), false);
});
