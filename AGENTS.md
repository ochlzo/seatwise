# Seatwise Repo Agent Guide

This file is the repo-local source of context for Codex agents working in `seatwise_v2`.

## Core goal

- Build and maintain the Seatwise Next.js app with minimal guesswork.
- Prefer the current repo state over memory.
- Keep changes scoped and reversible.

## What matters most in this repo

- Frontend and app routing live under `app/`.
- Shared UI components live under `components/`.
- Shared business logic lives under `lib/`.
- Database schema is in `prisma/schema.prisma`.
- Utility scripts live under `scripts/`.

## Current project patterns

- The app uses Next.js App Router.
- The project uses Prisma with PostgreSQL.
- Many scripts are TypeScript files executed with:
  - `node --experimental-strip-types ...`
- Shared UI primitives exist in `components/ui/` and should be reused before creating new variants.
- Queue and reservation logic is split between:
  - `lib/queue/`
  - `lib/shows/`
  - `app/api/queue/`
  - `app/api/reservations/`

## Recent repo context

- A sched-scoped reservation seeding script exists at `scripts/seed-show-reservations.ts`.
- That script accepts `--sched-id <SCHED_ID>`.
- It seeds `openSeats - 1` reservations for one schedule so the app can trigger the final status flip.
- It intentionally does not flip `sched.status` itself.
- The schedule capacity flip is handled by `syncScheduleCapacityStatuses` in `lib/shows/effectiveStatus.ts`.
- `FULLY_BOOKED` is set by reservation/queue flows, not by queue status reads.
- The `Select Time Slot` modal is in `components/queue/ReserveNowButton.tsx`.
- The `DialogHeader` primitive centers text on mobile by default in `components/ui/dialog.tsx`.
- The `Label` primitive adds default gap spacing in `components/ui/label.tsx`.

## UI guidance

- Reuse shared primitives first.
- Prefer the existing theme and spacing scale.
- Avoid adding one-off UI abstractions unless they are clearly reusable.
- For dialog and modal layout tweaks, check shared primitives before patching local markup.

## Reservation / queue behavior

- `ReserveNowButton` opens the date/time selection modal.
- The time-slot step renders schedule cards with:
  - radio control
  - time/date
  - optional status badge
  - category price pills
- `FULLY_BOOKED`, `ON_GOING`, and `CLOSED` are the main non-open schedule states shown in that modal.
- `syncScheduleCapacityStatuses` is called from:
  - `app/api/reservations/stage/route.ts`
  - `app/api/reservations/reject/route.ts`
  - `app/api/queue/complete/route.ts`

## Helpful commands

- Check reservations cleanup:
  - `npm run reservations:clear -- --dry-run`
  - `npm run reservations:clear -- --yes`
- Seed one schedule:
  - `npm run reservations:seed-show -- --sched-id <SCHED_ID> --dry-run`
  - `npm run reservations:seed-show -- --sched-id <SCHED_ID> --yes`
- Run tests:
  - `npm test`

## Safety rules

- Do not revert user changes unless explicitly asked.
- Do not overwrite unrelated work.
- Verify against current files before making assumptions.
- If a change affects reservation state, status transitions, or payments, inspect the relevant API and schema first.

## Parent folders

- No parent-folder `AGENTS.md` was created because the writable workspace is limited to this repo.
