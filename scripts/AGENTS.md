# Scripts

This subtree contains operational CLI scripts.

## Working rules

- Follow the existing pattern:
  - load `.env`
  - parse CLI args manually
  - use Prisma or the relevant client directly
  - exit cleanly with helpful usage text
- Keep destructive scripts guarded with `--yes`.
- Keep seed/cleanup scripts narrow and explicit.

## Current notable scripts

- `clear-reservations.ts`
- `clear-test-reservations.ts`
- `seed-test-reservations.ts`
- `seed-show-reservations.ts`

## Notes

- `seed-show-reservations.ts` is schedule-scoped and leaves the final status flip to the app.
- Scripts should be easy to run from `npm run ...` entries in `package.json`.
