import assert from "node:assert/strict";

import {
  buildReservationScheduleFilterOptions,
  filterReservationShowsBySchedule,
  isReservationScheduleFilterDisabled,
} from "./reservationScheduleFilters.ts";

const reservationShows = [
  {
    showId: "show-1",
    reservations: [
      {
        reservationId: "reservation-1",
        seatAssignments: [
          {
            sched: {
              sched_id: "sched-1",
              sched_date: "2026-04-15T00:00:00.000Z",
              sched_start_time: "2026-04-15T09:00:00.000Z",
              sched_end_time: "2026-04-15T11:00:00.000Z",
            },
          },
        ],
      },
      {
        reservationId: "reservation-2",
        seatAssignments: [
          {
            sched: {
              sched_id: "sched-1",
              sched_date: "2026-04-15T00:00:00.000Z",
              sched_start_time: "2026-04-15T09:00:00.000Z",
              sched_end_time: "2026-04-15T11:00:00.000Z",
            },
          },
        ],
      },
      {
        reservationId: "reservation-3",
        seatAssignments: [
          {
            sched: {
              sched_id: "sched-2",
              sched_date: "2026-04-16T00:00:00.000Z",
              sched_start_time: "2026-04-16T13:30:00.000Z",
              sched_end_time: "2026-04-16T15:00:00.000Z",
            },
          },
        ],
      },
    ],
  },
  {
    showId: "show-2",
    reservations: [
      {
        reservationId: "reservation-4",
        seatAssignments: [
          {
            sched: {
              sched_id: "sched-3",
              sched_date: "2026-04-17T00:00:00.000Z",
              sched_start_time: "2026-04-17T18:00:00.000Z",
              sched_end_time: "2026-04-17T20:00:00.000Z",
            },
          },
        ],
      },
    ],
  },
];

assert.equal(isReservationScheduleFilterDisabled("all"), true);
assert.equal(isReservationScheduleFilterDisabled("show-1"), false);

assert.deepEqual(buildReservationScheduleFilterOptions(reservationShows, "all"), []);

assert.deepEqual(buildReservationScheduleFilterOptions(reservationShows, "show-1"), [
  {
    id: "sched-1",
    label: "Apr 15, 2026, 5:00 PM - 7:00 PM",
  },
  {
    id: "sched-2",
    label: "Apr 16, 2026, 9:30 PM - 11:00 PM",
  },
]);

assert.deepEqual(
  filterReservationShowsBySchedule(reservationShows, "show-1", "sched-2"),
  [
    {
      showId: "show-1",
      reservations: [
        {
          reservationId: "reservation-3",
          seatAssignments: [
            {
              sched: {
                sched_id: "sched-2",
                sched_date: "2026-04-16T00:00:00.000Z",
                sched_start_time: "2026-04-16T13:30:00.000Z",
                sched_end_time: "2026-04-16T15:00:00.000Z",
              },
            },
          ],
        },
      ],
    },
  ],
);

assert.deepEqual(
  filterReservationShowsBySchedule(reservationShows, "all", "sched-2"),
  reservationShows,
);

console.log("reservationScheduleFilters.test.ts passed");
