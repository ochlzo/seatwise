# Server Actions

This subtree contains server actions that mutate Seatwise data.

## Working rules

- Keep actions transactional when they change multiple related records.
- Validate authorization before writes.
- Reuse shared helpers for schedule, queue, and reservation logic.

## Before editing

- Check whether a matching API route already exists.
- Confirm the action does not duplicate logic that should live in `lib/queue/` or `lib/shows/`.
