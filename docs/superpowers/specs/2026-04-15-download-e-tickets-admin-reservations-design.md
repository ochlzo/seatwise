# Download E-Tickets in Admin Reservations

## Goal

Add a download control to the reservation payment record portal in `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`.
The control should live in the same action cluster as the existing resend-email buttons and work for both walk-in and non-walk-in reservation records.

## User-Facing Behavior

- If the selected reservation contains exactly 1 seat, the primary action downloads a single PDF e-ticket.
- If the selected reservation contains 2 or more seats, the primary action downloads a ZIP archive containing all e-ticket PDFs.
- For multi-seat reservations, a dropdown submenu exposes individual seat ticket downloads, one PDF per seat.
- The control should be visible wherever the admin can already resend the reservation email or e-ticket, so the download capability is colocated with existing communication actions.

## Scope

In scope:

- Admin reservations portal detail view
- Walk-in and non-walk-in reservations
- Single PDF downloads
- Multi-PDF ZIP downloads
- Dropdown menu for individual seat downloads

Out of scope:

- Changing ticket generation content or ticket layout
- Reworking the reservation model
- Adding a new public-facing download flow
- Changing resend-email behavior

## Existing Source of Truth

The repo already has a ticket generation pipeline in `lib/tickets/issueReservationTicket.ts`.
That function already returns one generated PDF per seat, which makes it the right source for both the ZIP archive and the individual PDF downloads.

The existing admin reservation portal already exposes a button row for:

- resend payment copy
- resend e-ticket

The new download control should be inserted into that same row, not as a separate section.

## Proposed UI

Use a button group or split-button pattern:

- Primary button label: `Download e-tickets`
- Secondary caret opens a dropdown menu

For a 1-seat reservation:

- The primary button downloads the PDF directly
- The dropdown can be omitted or reduced to a single `Download PDF` item if needed

For a 2+ seat reservation:

- The primary button downloads a ZIP archive
- The dropdown menu lists one item per seat, each downloading the corresponding PDF

The menu text should be seat-oriented and readable, for example:

- `Download all as ZIP`
- `Seat A1 PDF`
- `Seat A2 PDF`

## Backend Contract

Add a reservation download endpoint that:

- authenticates as an admin-protected route
- loads the reservation and its seats from Prisma
- reuses `issueReservationTicket(...)` to generate the PDFs
- returns either:
  - `application/pdf` for a single-seat download
  - `application/zip` for multi-seat downloads

The route should accept enough identifiers to uniquely target the reservation record already selected in the portal.
It should not depend on the walk-in flag for behavior.

## ZIP Handling

The implementation should use a minimal ZIP strategy:

- build the PDFs server-side
- package them into one archive when seat count is 2 or more
- fall back to a ZIP response if the reservation unexpectedly has more than 10 seats

Because the app already tries to keep reservation seat counts at 10 or less, the ZIP branch is primarily a safety net.

## Individual Downloads

The submenu should expose direct downloads for each generated PDF.
Those downloads should be available for the same selected reservation regardless of whether the reservation was walk-in or not.

This submenu is meant for admins who want one specific seat ticket without downloading the full ZIP archive.

## Error Handling

If ticket generation fails:

- show a toast error in the portal
- do not close the selected reservation panel
- preserve the existing resend button behavior

If the reservation cannot be found or no seats are attached:

- return a server error with a clear message
- the UI should surface the error through the existing admin toast pattern

## Accessibility and UI Constraints

- Reuse the repo’s existing button, dropdown, and menu primitives.
- Keep the action row compact and aligned with the resend buttons.
- Ensure the dropdown is keyboard accessible.
- Keep button labels short enough to fit the selected-card panel.

## Testing

Add coverage for:

- single-seat reservations returning a PDF response
- multi-seat reservations returning a ZIP response
- submenu items mapping to the correct individual seat PDF
- admin reservations portal rendering the new button in the expected action row

## Implementation Notes

- Prefer reuse of `issueReservationTicket(...)` over creating a separate ticket-generation path.
- Keep the new download flow scoped to the reservations admin portal, but make it work for both walk-in and non-walk-in records.
- Avoid introducing a second source of truth for seat labels or ticket filenames.
