# Queue Logic

This subtree contains Redis queue lifecycle and queue-status helpers.

## Working rules

- Treat `showId:schedId` as the queue scope.
- Keep queue rank, session promotion, expiration, and average service time logic consistent.
- Preserve the distinction between read-only queue status and lifecycle-changing queue operations.

## Key behaviors

- queue join happens through `joinQueue`
- queue promotion happens through `promoteNextInQueue`
- reservation completion closes the active session and may promote the next guest
- queue status endpoints should not mutate schedule status directly

## Before editing

- Check how status is derived in `lib/shows/effectiveStatus.ts`.
- Verify any Redis key naming changes against the rest of the queue helpers.
