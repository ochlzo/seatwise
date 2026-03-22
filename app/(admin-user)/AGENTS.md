# Admin Routes

This subtree holds the admin dashboard experience.

## Focus

- show management
- reservations review and status changes
- seatmap and schedule administration

## Working rules

- Keep status transitions aligned with `lib/shows/`.
- Verify admin-only authorization paths before changing handlers or actions.
- Reuse existing dashboard components and forms before introducing new patterns.

## Before editing

- Check whether the change is a server action, a route handler, or a dashboard component concern.
- Confirm the update will not bypass reservation or queue invariants.
