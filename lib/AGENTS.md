# Library Context

This folder holds the main business logic for Seatwise.

## Working rules

- Put reusable business logic here, not in routes or components.
- Keep queue, show status, reservation, and seatmap logic centralized.
- Prefer small focused modules over large multi-purpose files.

## Key subareas

- `lib/actions/` server actions
- `lib/auth/` auth helpers and contexts
- `lib/queue/` queue lifecycle and Redis integration
- `lib/shows/` schedule and show status helpers
- `lib/email/` email payloads and senders
- `lib/db/` pure data helpers and grouping logic

## Before editing

- Verify whether the behavior already exists in a nearby helper.
- Reuse the same status semantics across server actions, API routes, and UI consumers.
