# Queue Components

This subtree contains the reservation queue and reserve-flow UI.

## Focus

- reserve button and time-slot modal
- queue state display
- reservation-room entry flow

## Working rules

- Keep queue-status labels aligned with `lib/shows/` and `app/api/queue/`.
- Preserve the user journey from show detail to queue join to reservation room.
- Use existing dialog, card, label, radio, badge, and button primitives.

## Key file

- `ReserveNowButton.tsx`

## Notes

- The `Select Time Slot` step is rendered inside `ReserveNowButton.tsx`.
- Layout tweaks here often need both responsive and mobile-first validation.
