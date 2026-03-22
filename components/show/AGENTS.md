# Show Components

This subtree contains show detail and public show display components.

## Focus

- public show details
- schedule grouping
- reserve button placement

## Working rules

- Keep public show rendering consistent with the data passed from the route page.
- Reuse queue-related components for reservation entry.
- Keep schedule grouping and seatmap presentation in sync with `lib/db/` and `lib/shows/`.

## Key file

- `ShowDetailPublic.tsx`

## Before editing

- Check whether the desired UI change belongs in the public show component or in the reserve button/modal child component.
