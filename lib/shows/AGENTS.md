# Show Status Logic

This subtree contains show and schedule status rules.

## Working rules

- Keep schedule status, show status, and reservation blocking semantics centralized.
- `FULLY_BOOKED` is a persisted schedule status.
- Capacity changes should flow through the shared sync helper.

## Important helpers

- `effectiveStatus.ts`
- `showStatusLifecycle.ts`

## Current behavior to remember

- `syncScheduleCapacityStatuses` flips a schedule to `FULLY_BOOKED` only when all seat assignments are reserved.
- Reservation stage/reject and queue completion call that helper.
- Queue status and queue join routes only read schedule status.

## Before editing

- Check whether the change is a display-only effective status or a persisted database status transition.
