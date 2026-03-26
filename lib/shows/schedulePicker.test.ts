import test from "node:test";
import assert from "node:assert/strict";

import {
  hasSelectableSchedules,
  serializeSchedulesForPicker,
  type SchedulePickerSource,
} from "./schedulePicker.ts";

const sampleSchedules: SchedulePickerSource[] = [
  {
    sched_id: "sched-open",
    sched_date: "2026-04-10T00:00:00.000Z",
    sched_start_time: "1970-01-01T11:00:00.000Z",
    sched_end_time: "1970-01-01T13:00:00.000Z",
    effective_status: "OPEN",
    seatAssignments: [
      {
        set: {
          seatCategory: {
            category_name: "VIP",
            price: { toString: () => "450.00" },
          },
        },
      },
      {
        set: {
          seatCategory: {
            category_name: "VIP",
            price: { toString: () => "450.00" },
          },
        },
      },
      {
        set: {
          seatCategory: {
            category_name: "Regular",
            price: { toString: () => "250.00" },
          },
        },
      },
    ],
  },
  {
    sched_id: "sched-closed",
    sched_date: "2026-04-11T00:00:00.000Z",
    sched_start_time: "1970-01-01T09:00:00.000Z",
    sched_end_time: "1970-01-01T11:00:00.000Z",
    effective_status: "CLOSED",
    seatAssignments: [],
  },
];

test("serializeSchedulesForPicker keeps Manila wall-clock values and de-duplicates categories", () => {
  const serialized = serializeSchedulesForPicker(sampleSchedules);

  assert.equal(serialized.length, 2);
  assert.equal(serialized[0].sched_id, "sched-open");
  assert.equal(serialized[0].sched_date, "2026-04-10");
  assert.equal(serialized[0].sched_start_time, "19:00");
  assert.equal(serialized[0].sched_end_time, "21:00");
  assert.equal(serialized[0].effective_status, "OPEN");
  assert.deepEqual(serialized[0].categories, [
    { name: "VIP", price: "450.00" },
    { name: "Regular", price: "250.00" },
  ]);
});

test("hasSelectableSchedules only returns true when at least one OPEN schedule exists", () => {
  const serialized = serializeSchedulesForPicker(sampleSchedules);

  assert.equal(hasSelectableSchedules(serialized), true);
  assert.equal(
    hasSelectableSchedules(serialized.filter((schedule) => schedule.effective_status !== "OPEN")),
    false,
  );
});

test("hasSelectableSchedules treats ON_GOING schedules as selectable", () => {
  const serialized = serializeSchedulesForPicker([
    {
      ...sampleSchedules[1],
      sched_id: "sched-ongoing",
      effective_status: "ON_GOING",
    },
  ]);

  assert.equal(hasSelectableSchedules(serialized), true);
});
