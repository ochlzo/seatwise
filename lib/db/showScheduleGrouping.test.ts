import test from "node:test";
import assert from "node:assert/strict";
import { groupSchedulesByCommonalities } from "./showScheduleGrouping.ts";

test("groups contiguous dates with identical time and set", () => {
  const grouped = groupSchedulesByCommonalities([
    {
      sched_date: "2026-02-16",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-02-17",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-02-18",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
  ]);

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].label, "Feb 16-18");
  assert.equal(grouped[0].items.length, 1);
  assert.equal(grouped[0].items[0].category_set_id, "set-a");
});

test("creates overlapping ranges when different slots have their own contiguous runs", () => {
  const grouped = groupSchedulesByCommonalities([
    // Set A run: Feb 16-20
    {
      sched_date: "2026-02-16",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-02-17",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-02-18",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-02-19",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-02-20",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    // Set B run: Feb 20-24
    {
      sched_date: "2026-02-20",
      sched_start_time: "13:00",
      sched_end_time: "15:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
    {
      sched_date: "2026-02-21",
      sched_start_time: "13:00",
      sched_end_time: "15:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
    {
      sched_date: "2026-02-22",
      sched_start_time: "13:00",
      sched_end_time: "15:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
    {
      sched_date: "2026-02-23",
      sched_start_time: "13:00",
      sched_end_time: "15:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
    {
      sched_date: "2026-02-24",
      sched_start_time: "13:00",
      sched_end_time: "15:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
  ]);

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].label, "Feb 16-20");
  assert.equal(grouped[1].label, "Feb 20-24");
});

test("does not merge non-contiguous dates into one range", () => {
  const grouped = groupSchedulesByCommonalities([
    {
      sched_date: "2026-03-01",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-03-03",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
  ]);

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].label, "Mar 1");
  assert.equal(grouped[1].label, "Mar 3");
});

test("merges multiple slots into one range group when they share exact same date range", () => {
  const grouped = groupSchedulesByCommonalities([
    {
      sched_date: "2026-04-10",
      sched_start_time: "10:00",
      sched_end_time: "12:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-04-11",
      sched_start_time: "10:00",
      sched_end_time: "12:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-04-10",
      sched_start_time: "14:00",
      sched_end_time: "16:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
    {
      sched_date: "2026-04-11",
      sched_start_time: "14:00",
      sched_end_time: "16:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
  ]);

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].label, "Apr 10-11");
  assert.equal(grouped[0].items.length, 2);
  assert.deepEqual(
    grouped[0].items.map((item) => item.category_set_id),
    ["set-a", "set-b"],
  );
});

test("prints grouped JSON sample output", () => {
  const grouped = groupSchedulesByCommonalities([
    // Set A contiguous run: Feb 16-20
    {
      sched_date: "2026-02-16",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-02-17",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-02-18",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-02-19",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-02-20",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    // Set B overlapping run: Feb 20-24
    {
      sched_date: "2026-02-20",
      sched_start_time: "13:00",
      sched_end_time: "15:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
    {
      sched_date: "2026-02-21",
      sched_start_time: "13:00",
      sched_end_time: "15:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
    {
      sched_date: "2026-02-22",
      sched_start_time: "13:00",
      sched_end_time: "15:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
    {
      sched_date: "2026-02-23",
      sched_start_time: "13:00",
      sched_end_time: "15:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
    {
      sched_date: "2026-02-24",
      sched_start_time: "13:00",
      sched_end_time: "15:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
    // Set C and Set D share the same date range and should merge into one group
    {
      sched_date: "2026-03-01",
      sched_start_time: "10:00",
      sched_end_time: "12:00",
      category_set_id: "set-c",
      set_name: "Set C",
    },
    {
      sched_date: "2026-03-02",
      sched_start_time: "10:00",
      sched_end_time: "12:00",
      category_set_id: "set-c",
      set_name: "Set C",
    },
    {
      sched_date: "2026-03-01",
      sched_start_time: "14:00",
      sched_end_time: "16:00",
      category_set_id: "set-d",
      set_name: "Set D",
    },
    {
      sched_date: "2026-03-02",
      sched_start_time: "14:00",
      sched_end_time: "16:00",
      category_set_id: "set-d",
      set_name: "Set D",
    },
    // Non-contiguous same signature should split into two single-day groups
    {
      sched_date: "2026-03-05",
      sched_start_time: "18:00",
      sched_end_time: "20:00",
      category_set_id: "set-e",
      set_name: "Set E",
    },
    {
      sched_date: "2026-03-07",
      sched_start_time: "18:00",
      sched_end_time: "20:00",
      category_set_id: "set-e",
      set_name: "Set E",
    },
  ]);

  console.log(
    "\nGrouped schedules JSON sample:\n",
    JSON.stringify(grouped, null, 2),
  );
  assert.ok(Array.isArray(grouped));
});

test("single-day group includes complete schedule for that day", () => {
  const grouped = groupSchedulesByCommonalities([
    // Long run for Set A
    {
      sched_date: "2026-05-10",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-05-11",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    {
      sched_date: "2026-05-12",
      sched_start_time: "19:00",
      sched_end_time: "21:00",
      category_set_id: "set-a",
      set_name: "Set A",
    },
    // Unique single-day slot on May 11 creates a one-day group
    {
      sched_date: "2026-05-11",
      sched_start_time: "13:00",
      sched_end_time: "15:00",
      category_set_id: "set-b",
      set_name: "Set B",
    },
  ]);

  const may11Group = grouped.find(
    (group) => group.start_date === "2026-05-11" && group.end_date === "2026-05-11",
  );

  assert.ok(may11Group);
  assert.deepEqual(
    may11Group.items.map((item) => item.category_set_id),
    ["set-b", "set-a"],
  );
});
