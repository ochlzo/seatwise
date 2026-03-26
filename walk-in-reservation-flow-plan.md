# Plan: Walk-In Reservation Flow

**Generated**: 2026-03-23
**Estimated Complexity**: High

## Overview
Add an admin-driven walk-in sales flow that starts from the admin show detail page, reuses the existing date/schedule picker, integrates with the current queue/reservation-room model, skips GCash proof upload, supports booking during `ON_GOING`, creates `WALK_IN` payments, immediately marks walk-in sales as `Reservation.status = CONFIRMED` and `Payment.status = PAID`, generates a receipt image, uploads the receipt to Cloudinary, and emails the receipt with an explicit in-person purchase note.

Recommended implementation shape:
- Keep the public reservation flow and the admin walk-in flow on separate entry routes.
- Reuse shared UI and queue primitives where behavior is truly shared.
- Avoid weakening public queue/security rules to support admin behavior.
- Ship in small vertical slices so every sprint is manually testable.

## Repo Findings
- `prisma/schema.prisma` already includes `PaymentMethod.WALK_IN`.
- Public show pages only render `ReserveNowButton` when a schedule is effectively `OPEN`.
- `components/queue/ReserveNowButton.tsx` currently disables `ON_GOING`, `FULLY_BOOKED`, and `CLOSED`.
- `app/api/queue/join/route.ts`, `app/api/queue/status/route.ts`, and `app/api/queue/complete/route.ts` currently reject anything except effectively `OPEN` schedules.
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/ReserveSeatClient.tsx` hardcodes a GCash screenshot step.
- `app/api/queue/complete/route.ts` uploads the screenshot directly to Cloudinary, creates `Reservation` + `Payment`, then emails a plain-text “under review” message.
- Queue pausing already exists via `lib/queue/closeQueue.ts` and `lib/queue/queueLifecycle.ts`, but the message is generic and currently tied to postponed/closed behavior.
- Admin reservation review UI already reads payment method and image URL from `app/api/reservations/route.ts` and `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`.

## Prerequisites
- Admin auth must be enforced on all walk-in entry/completion APIs through `lib/auth/adminContext.ts`.
- Cloudinary credentials must be present for receipt-image upload.
- Gmail sender credentials must be present for receipt email delivery.
- Walk-in receipt images will reuse `Payment.screenshot_url`.

## Helpers To Use During Execution
- Maintain the plan as work progresses so completed tasks and deferred scope stay explicit.
- Make behavior changes in small increments and add focused test coverage before moving on to the next branch of logic.
- For queue, expiry, and race-condition work, verify the current server-side flow first and debug from observed state transitions instead of guessing.
- Preserve the existing admin/public UI conventions and responsive layout patterns when extracting shared components or adding walk-in-specific screens.
- Before changing Cloudinary upload behavior or Gmail/MIME formatting, verify the current library usage in the repo and check current official documentation if the local implementation is unclear.
- Before closing a sprint, run the relevant validation commands and manual checks listed under that sprint.

## Likely Files To Touch
- `prisma/schema.prisma`
- `prisma/migrations/*` for the walk-in schema change
- `app/(admin-user)/(dashboard)/admin/shows/[showId]/page.tsx`
- `app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx`
- `components/queue/ReserveNowButton.tsx`
- `app/(app-user)/(events)/[showId]/page.tsx`
- `app/(app-user)/(events)/queue/[showId]/[schedId]/QueueWaitingClient.tsx`
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/page.tsx`
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/ReserveSeatClient.tsx`
- `app/api/queue/join/route.ts`
- `app/api/queue/status/route.ts`
- `app/api/queue/complete/route.ts`
- `app/api/reservations/route.ts`
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`
- `lib/queue/closeQueue.ts`
- `lib/queue/getQueueStatus.ts`
- `lib/queue/queueLifecycle.ts`
- `lib/shows/effectiveStatus.ts`
- `lib/email/sendReservationSubmittedEmail.ts` or a new walk-in-specific email sender

Probable new files:
- `components/queue/ScheduleSelectionDialog.tsx`
- `app/api/admin/walk-in/prepare/route.ts`
- `app/(admin-user)/(dashboard)/admin/walk-in/[showId]/[schedId]/page.tsx`
- `lib/email/sendWalkInReceiptEmail.ts`
- `lib/walk-in/receipt.ts`

## Sprint 1: Admin Entry And Shared Schedule Selection
**Goal**: Admin can start a walk-in flow from the show detail page and pick a date/schedule using shared UI.
**Execution Notes**:
- Keep the admin launcher visually consistent with the existing show detail actions.
- Prefer extracting shared schedule-picker UI rather than duplicating modal logic.
- Review the current affected files directly before changing component boundaries.
**Demo/Validation**:
- Admin show detail page shows a new `Walk In` button.
- The admin can open the same date/schedule modal used by the public flow.
- The selected schedule can route into an admin-only walk-in page shell.

### Task 1.1: Extract Shared Schedule Picker
- **Location**: `components/queue/ReserveNowButton.tsx`, new `components/queue/ScheduleSelectionDialog.tsx`
- **Description**: Move the date/time selection modal into a reusable component so both public reserve and admin walk-in can use the same UI without duplicating state/rendering logic.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Public reserve behavior stays unchanged.
  - Shared component accepts mode-specific CTA label and submit handler.
- **Validation**:
  - Manual check on public show page.
  - `npm run lint`

### Task 1.2: Add Admin Walk-In CTA
- **Location**: `app/(admin-user)/(dashboard)/admin/shows/[showId]/page.tsx`, `app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx`
- **Description**: Pass a new admin-only walk-in launcher into `ShowDetailForm` using the existing `reserveButton` slot pattern.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - Button is only visible on the admin show detail page.
  - Button is hidden while editing the show, matching current reserve-button behavior.
- **Validation**:
  - Manual admin-page verification on mobile and desktop.

### Task 1.3: Create Admin Walk-In Route Shell
- **Location**: new `app/(admin-user)/(dashboard)/admin/walk-in/[showId]/[schedId]/page.tsx`
- **Description**: Add an admin-only route with server-side admin authentication and schedule loading. Start with a placeholder page that proves the launcher reaches the correct show/schedule.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - Non-admins cannot access the route.
  - Admins reach a page with validated `showId` and `schedId`.
- **Validation**:
  - Manual route access test with an admin session.

## Sprint 2: Queue Rules For Walk-In Admission
**Goal**: Admin walk-ins can coexist with the queue without corrupting active sessions.
**Execution Notes**:
- Treat queue admission as state-machine work: inspect the active-session, waiting-ticket, pause, and promotion paths before patching behavior.
- Make the pause semantics explicit in the queue contract instead of overloading existing closed/postponed behavior.
- Review the queue lifecycle and status files together so the admission rules stay internally consistent.
**Demo/Validation**:
- If another customer is already active in the reservation room, the admin is queued instead of bypassing them.
- If there is no active customer, or once the admin becomes active, the queue is paused and waiting users see the walk-in pause message.

### Task 2.1: Introduce Walk-In Queue Pause Semantics
- **Location**: `lib/queue/closeQueue.ts`, `lib/queue/getQueueStatus.ts`, `lib/queue/queueLifecycle.ts`, `lib/types/queue.ts`
- **Description**: Add a walk-in-specific pause reason/message instead of reusing the postponed copy. Preserve queue data while blocking new joins/promotions during walk-in service.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Paused state can distinguish “walk-in accommodation” from closed/postponed states.
  - Waiting users receive the message: `Please wait, we are currently accommodating walk ins`.
- **Validation**:
  - Add or extend queue unit tests for paused-state behavior.
  - Manual Redis/queue smoke test.

### Task 2.2: Add Admin Walk-In Preparation API
- **Location**: new `app/api/admin/walk-in/prepare/route.ts`
- **Description**: Create an admin-only API that decides whether the admin should wait in queue or can enter immediately and pause the queue.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Uses `getCurrentAdminContext`.
  - Returns one of: `queued`, `active_and_paused`, or an actionable error state.
  - Never bypasses an already-active customer session.
- **Validation**:
  - API contract test or targeted server-side test script.
  - Manual test with and without an active queue session.

### Task 2.3: Update Queue UI For Walk-In Pause Messaging
- **Location**: `app/(app-user)/(events)/queue/[showId]/[schedId]/QueueWaitingClient.tsx`, `app/api/queue/status/route.ts`
- **Description**: Surface walk-in pause messaging clearly to regular queued users and ensure queue status polling does not mislabel the schedule as fully closed.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Waiting users see the new walk-in pause message.
  - The UI remains recoverable once the pause is lifted.
- **Validation**:
  - Browser check with two sessions.

## Sprint 3: Walk-In Reservation Room And ON_GOING Booking
**Goal**: Admin can complete seat selection and contact entry in a walk-in mode, and current reservation rules allow `ON_GOING` bookings where intended.
**Execution Notes**:
- Keep the public reservation room and the admin walk-in room on separate entry paths while sharing only the UI and state that are truly common.
- Preserve the existing visual system and ensure the walk-in flow remains usable on mobile and desktop.
- Validate the room behavior in a real browser flow once the shared and mode-specific branches are wired together.
**Demo/Validation**:
- Admin can enter the reservation room in walk-in mode.
- Walk-in mode skips GCash upload and shows a POS-style total and selected seats.
- Public/current reservation flow can still book while a show/schedule is `ON_GOING` where allowed.

### Task 3.1: Add Walk-In Mode To Reservation Room
- **Location**: `app/(app-user)/(events)/reserve/[showId]/[schedId]/page.tsx`, `app/(app-user)/(events)/reserve/[showId]/[schedId]/ReserveSeatClient.tsx`
- **Description**: Refactor the reservation room to support mode-specific behavior. Use the plan's recommended dedicated admin-only walk-in route and keep the public `/reserve` flow separate. Recommended shape: shared seat/contact/order-summary UI with separate online vs walk-in payment/submit branches.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Walk-in mode hides GCash QR/upload UI.
  - Contact step leads to a POS-like order summary and payment-confirmation modals.
  - Online flow remains intact.
- **Validation**:
  - Manual walkthrough of both online and walk-in modes.
  - `npm run lint`

### Task 3.2: Permit `ON_GOING` Reservations In The Required Paths
- **Location**: `components/queue/ReserveNowButton.tsx`, `app/(app-user)/(events)/[showId]/page.tsx`, `app/api/queue/join/route.ts`, `app/api/queue/status/route.ts`, `app/api/queue/complete/route.ts`, `lib/shows/effectiveStatus.ts`
- **Description**: Update the gatekeeping rules so `ON_GOING` schedules are selectable/bookable where the requirement says they should be, without reopening `CLOSED` or `FULLY_BOOKED`.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - `ON_GOING` schedules are no longer blocked in the current reservation path.
  - `FULLY_BOOKED` and `CLOSED` remain blocked.
- **Validation**:
  - Add/extend tests around schedule-status gating.
  - Manual test with a seeded `ON_GOING` schedule.

### Task 3.3: Add Walk-In Confirmation Modals
- **Location**: `app/(app-user)/(events)/reserve/[showId]/[schedId]/ReserveSeatClient.tsx`
- **Description**: Replace screenshot submission with admin-assist confirmation dialogs such as “Payment received?” and “Finalize walk-in sale?”.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - Walk-in mode cannot finalize without explicit confirmation.
  - The UI presents total amount and selected seats before finalization.
- **Validation**:
  - Manual click-through and cancel/reopen checks.

## Sprint 4: Walk-In Completion, Receipt Generation, And Email
**Goal**: Finalizing a walk-in creates the right records and sends a usable receipt.
**Execution Notes**:
- Keep the walk-in completion branch separate from the online screenshot-submission branch.
- Verify the repo's current Cloudinary and email implementation details before changing upload, attachment, or MIME behavior.
- Add the receipt-generation work in a way that preserves a clear failure path if upload or email delivery breaks after persistence.
**Demo/Validation**:
- Completing a walk-in creates reservation/payment records, uploads a receipt image to Cloudinary, and sends an email with the receipt attached and “bought in person” messaging.

### Task 4.1: Finalize Walk-In Persistence Model
- **Location**: `prisma/schema.prisma`, new `prisma/migrations/*`
- **Description**: Confirm the schema works with the chosen design: walk-in receipts reuse `Payment.screenshot_url`, and no extra receipt column is added unless implementation exposes a hard blocker.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Prisma schema supports `WALK_IN` with receipt images stored in `Payment.screenshot_url`.
  - Migration work is skipped if no schema change is actually required.
  - Any required migration applies cleanly.
- **Validation**:
  - `npx prisma validate`
  - `npx prisma generate`

### Task 4.2: Extend Completion API For Walk-In
- **Location**: `app/api/queue/complete/route.ts` or new `app/api/admin/walk-in/complete/route.ts`
- **Description**: Support a walk-in completion branch that skips screenshot validation, writes `Payment.method = WALK_IN`, stores the generated receipt URL in `Payment.screenshot_url`, and immediately sets `Reservation.status = CONFIRMED` and `Payment.status = PAID`.
- **Dependencies**: Tasks 3.1, 4.1
- **Acceptance Criteria**:
  - Walk-in completion does not require `screenshotUrl`.
  - The reservation row is created directly as `CONFIRMED`.
  - The payment row is created directly as `PAID` with `method = WALK_IN`.
  - The generated receipt URL is persisted to `Payment.screenshot_url`.
  - Queue state is cleaned up and next user promotion still works.
- **Validation**:
  - Server-side happy-path and conflict-path tests.
  - Manual end-to-end completion.

### Task 4.3: Generate And Upload Receipt Image
- **Location**: new `lib/walk-in/receipt.ts`, completion route
- **Description**: Render a receipt image from the finalized reservation/payment data, upload it to Cloudinary, and persist the URL to `Payment.screenshot_url`.
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Receipt image includes seats, totals, reservation number, and walk-in wording.
  - Cloudinary URL is stored in `Payment.screenshot_url`.
- **Validation**:
  - Manual Cloudinary object check.
  - One saved sample receipt reviewed by admin.

### Task 4.4: Send Walk-In Receipt Email
- **Location**: `lib/email/sendReservationSubmittedEmail.ts` or new `lib/email/sendWalkInReceiptEmail.ts`
- **Description**: Send a distinct walk-in email that says the tickets were bought in person and attaches the receipt image.
- **Dependencies**: Task 4.3
- **Acceptance Criteria**:
  - Email copy clearly identifies the purchase as walk-in/in-person.
  - Receipt image is attached, not only linked.
  - Existing online reservation email behavior is preserved.
- **Validation**:
  - Run `npm run email:test` or a targeted walk-in email test.
  - Manual inbox inspection.

## Sprint 5: Admin Reservations View And Regression Hardening
**Goal**: Admin tools and existing online reservations both remain usable after the walk-in feature ships.
**Execution Notes**:
- Treat this sprint as regression hardening: verify the admin portal, queue flows, and the original online reservation path on the same build.
- Review the changed files as a set before closing the feature so walk-in labeling, receipt handling, queue cleanup, and the new email-image branches stay coherent.
- Finish with both automated checks and real browser validation of the happy paths listed below.
**Demo/Validation**:
- Admin reservations UI clearly distinguishes walk-in payments and shows the stored receipt image/URL.
- Online GCash reservations continue to work.
- Pending online emails show the uploaded GCash proof inline and as a downloadable attachment.
- Confirmed online emails show the generated receipt inline and as a downloadable attachment.
- Walk-in emails show the generated receipt inline and as a downloadable attachment.

### Task 5.1: Update Admin Reservations Portal For Walk-In Payments
- **Location**: `app/api/reservations/route.ts`, `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`
- **Description**: Adjust the payment portal copy and rendering so walk-in payments show receipt context instead of "Proof Of Payment", online reservations keep their proof-of-payment language, and kanban cards expose a distinct walk-in label/tag.
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - `WALK_IN` payments are visibly labeled.
  - Walk-in reservation cards in the kanban have a distinct visible tag/name.
  - Receipt image/URL is accessible from the admin portal.
  - GCash reservations still show their proof-of-payment UI.
- **Validation**:
  - Manual admin reservations review across mixed data.

### Task 5.2: Regression Coverage For Queue And Online Reservations
- **Location**: `lib/queue/*.test.ts`, any new targeted tests
- **Description**: Add focused tests for walk-in pause behavior, `ON_GOING` acceptance, completion branching, and online email non-regression across the pending and confirmed paths.
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Tests cover queue pause/resume and completion branching.
  - Tests cover the online pending branch preserving the GCash proof path.
  - Tests cover the confirmed branch generating or consuming the receipt path without regressing walk-in behavior.
  - Existing `npm test` remains green.
- **Validation**:
  - `npm test`
  - `npm run lint`

### Task 5.3: Browser Verification Checklist
- **Location**: no code change required; use during validation
- **Description**: Run a real browser pass for admin walk-in start, queued wait, paused queue message, seat selection, finalization, email delivery, and admin reservations review, then repeat the public online flow on the same build.
- **Dependencies**: Task 5.2
- **Acceptance Criteria**:
  - One verified happy path with no existing queue.
  - One verified happy path while another customer is already active.
  - One verified public online reservation shows the pending email with inline proof image plus attachment.
  - One verified admin confirmation of an online reservation shows the confirmed email with inline receipt image plus attachment.
  - One verified walk-in reservation shows the walk-in email with inline receipt image plus attachment.
  - The admin reservations portal correctly distinguishes proof-of-payment from walk-in receipt context on the same build.

## Testing Strategy
- Keep each sprint mergeable on its own.
- Prefer targeted unit/contract coverage for queue and completion rules.
- Use seeded schedules to explicitly test `OPEN`, `ON_GOING`, and `FULLY_BOOKED`.
- Perform every browser check with two sessions when queue coordination is involved.
- Re-run `npm test` and `npm run lint` after every sprint.

## Potential Risks & Gotchas
- `ON_GOING` is currently derived as a non-bookable state in multiple places, not just one UI button.
- Reusing the public `/reserve` route for admin walk-ins risks loosening public auth/session assumptions, so the implementation should stay on the dedicated admin-only walk-in route.
- Queue pause currently collapses into a generic "closed" status; that can confuse users if the messaging is not separated.
- Receipt and proof delivery now rely on HTML plus MIME multipart formatting, so regressions can surface separately in inline rendering and downloadable attachments.
- Reusing `Payment.screenshot_url` for a receipt image changes its meaning for walk-ins, so the admin payment portal and kanban card labeling must make that distinction explicit.
- If receipt generation fails after payment persistence, the completion route needs a clear compensation strategy.

## Rollback Plan
- Keep schema additions backward-compatible where possible.
- Guard admin walk-in entry behind a server-side check so the feature can be disabled by removing the CTA.
- Keep the online reservation completion branch separate from the new walk-in branch.
- If receipt generation proves unstable, ship walk-in persistence first behind a temporary no-email fallback, then layer receipt generation in the next sprint.
