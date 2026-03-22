# API Routes

This subtree contains all HTTP route handlers.

## Working rules

- Keep handlers thin.
- Push business rules into `lib/` when possible.
- Use the matching auth context helpers for admin-only endpoints.
- Revalidate or refresh paths only where necessary.

## Common API areas

- `app/api/queue/`
- `app/api/reservations/`
- `app/api/shows/`

## Before editing

- Check the related `lib/` function first.
- Verify request validation, auth, and response shape against the current handler pattern.
