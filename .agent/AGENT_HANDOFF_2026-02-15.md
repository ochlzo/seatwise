# Seatwise Agent Handoff (Current State, 2026-03-15)

## Purpose

This handoff is intentionally trimmed to active behavior only. Legacy/rolled-back notes were removed.

## Stack

- Next.js App Router + React + TypeScript
- Prisma + PostgreSQL (Neon)
- Queue infra: Upstash Redis + Ably
- UI: Radix/custom UI components, `next-themes`

## Core App Areas

- Public show detail: `app/(app-user)/(events)/[showId]/page.tsx`
- Queue page: `app/(app-user)/(events)/queue/[showId]/[schedId]/page.tsx`
- Reserve page: `app/(app-user)/(events)/reserve/[showId]/[schedId]/page.tsx`
- Admin show creation: `app/(admin-user)/(dashboard)/admin/shows/create/CreateShowForm.tsx`
- Admin reservations: `app/(admin-user)/(dashboard)/admin/reservations/page.tsx`
- Admin access: `app/(admin-user)/(dashboard)/admin/access/page.tsx`
- Seat builder: `app/(admin-user)/seat-builder/page.tsx`

## Auth and Routing (Current)

- Login redirect is admin-focused:
- `/admin` and `/admin/*` require admin session and redirect to `/login` when missing.
- Non-admin pages are not globally forced to login.
- Public show listing endpoint supports guest visibility:
- `GET /api/shows/search?visibility=user` is accessible for guest-facing pages.

## Profile/Account Routes

- Admin-scoped routes:
- `/admin/profile`
- `/admin/account`
- User dropdown navigation points to these admin routes.

## Team Tenancy + Superadmin (New)

- Added team-scoped admin tenancy in Prisma:
- `Team` model (`team_id`, `name`, timestamps)
- `Admin.team_id String?`
- `Admin.is_superadmin Boolean @default(false)`
- `Show.team_id String` (required)
- Reservation scope is derived through `Reservation -> Show.team_id` (no direct reservation team field).
- New shared auth helper:
- `lib/auth/adminContext.ts`
- `getCurrentAdminContext()` returns `{ userId, firebaseUid, teamId, teamName, isSuperadmin }`
- Throws typed `401/403` errors via `AdminContextError`.

## Migrations Added (Team Tenancy)

- `prisma/migrations/20260305110000_add_team_tenancy/migration.sql`
- Creates `Team`, adds `Admin.team_id`, `Admin.is_superadmin`, `Show.team_id`
- Seeds `default-team`
- Backfills existing `Admin` and `Show` rows to `default-team`
- Adds FKs/indexes.
- `prisma/migrations/20260305111000_enforce_show_team_required/migration.sql`
- Enforces `Show.team_id NOT NULL`.

## Show + Reservation Team Scoping (New)

- Show creation now writes team:
- `lib/actions/createShow.ts`
- Uses `getCurrentAdminContext()` and sets `show.team_id` from admin team.
- Non-superadmin with no team is blocked.
- Admin show listing now scoped by team unless superadmin:
- `lib/db/Shows.ts`
- `app/api/shows/search/route.ts`
- Admin reservations list now scoped by team unless superadmin:
- `app/api/reservations/route.ts`
- Admin reservation mutations (`verify`, `reject`) now enforce team ownership:
- `app/api/reservations/verify/route.ts`
- `app/api/reservations/reject/route.ts`
- Cross-team action returns `403` unless superadmin.

## Auth Payload Enrichment (New)

- `GET /api/auth/me` and `POST /api/auth/login` now include:
- `isSuperadmin`
- `teamId`
- `teamName`
- Related user mapping updated in:
- `lib/db/Users.ts`

## Admin Access Feature (New)

- New page and client:
- `app/(admin-user)/(dashboard)/admin/access/page.tsx`
- `app/(admin-user)/(dashboard)/admin/access/AdminAccessClient.tsx`
- New APIs:
- `GET/POST /api/admin/access/teams`
- `PATCH /api/admin/access/teams/[teamId]`
- `POST /api/admin/access/invite`
- Permissions:
- Superadmin can create teams, rename/manage any team, invite for any team, view all teams/admins.
- Regular admin can rename/manage own team, invite only to own team, view only own team.

## Admin Invite Behavior (Current)

- Invite flow is now token/session-based with OTP onboarding and completion APIs.
- Shared helper and key logic:
- `lib/invite/adminInvite.ts`
- Invite email sender:
- `lib/email/sendAdminInviteEmail.ts`
- Team-admin invite sender route:
- `POST /api/admin/access/invite`
- Existing admin email behavior on team invite:
- Returns success without sending a new invite (non-enumerating response).

## Admin Access UI Notes (Current)

- Mobile and desktop are intentionally different in `AdminAccessClient.tsx`:
- Mobile: compact stacked cards, visible `Rename` button per team card, separators between sections (`my-2`).
- Desktop (`md+`): `table-fixed` table for the teams list. Columns: `Team`, `Admins`, `Action`. Rows use `py-3` spacing.
- Inline rename is available directly in the teams list (both mobile and desktop):
  - Clicking "Rename" makes the team name field editable in-place.
  - Save via button or Enter key; Cancel via button or Escape.
  - Uses `inlineEditTeamId` + `inlineEditDraft` state.
  - Calls `PATCH /api/admin/access/teams/[teamId]` on save.
- Team Admin status badges are positioned top-right on mobile row cards.
- `TeamAccessDetail.tsx` shows manage card (rename/invite) and admins card separated by `<Separator className="my-2 md:hidden" />` on mobile.

## Queue/Reservation Flow (Current)

- Queue endpoints:
- `POST /api/queue/join`
- `GET /api/queue/status`
- `POST /api/queue/active`
- `POST /api/queue/leave`
- `POST /api/queue/terminate`
- `POST /api/queue/complete`
- Reserve flow includes:
- seat selection
- contact details
- payment screenshot upload
- confirm reservation
- Reservation complete stores screenshot payload and creates reservation/payment records.

## Reservation Payment UI/Data (Current)

- Payment panel component: `components/queue/GcashUploadPanel.tsx`
- Uses show-configured GCash fields from DB:
- `Show.gcash_qr_image_key`
- `Show.gcash_number`
- `Show.gcash_account_name`
- QR image displayed from Cloudinary URL (`gcash_qr_image_key`), with:
- fullscreen preview
- download action
- GCash details shown inline:
- `GCash Number: ...`
- `Account Name: ...`
- Each line includes copy-to-clipboard action with toast feedback.

## Show Model: GCash Fields

In `prisma/schema.prisma`, `Show` includes:

- `gcash_qr_image_key String?`
- `gcash_number String?`
- `gcash_account_name String?`

## Show Create Flow: Payment Config

- Create form includes:
- show poster upload
- GCash QR upload
- GCash number
- GCash account name
- Validation requires all GCash fields for show creation.
- GCash QR upload flow:
- read file as base64 on client
- submit base64 to server action
- server uploads to Cloudinary folder `seatwise/gcash_qr_codes`
- saved URL is stored in `Show.gcash_qr_image_key`

## Reusable Upload UI

- Shared uploader component:
- `components/ui/image-upload-dropzone.tsx`
- Used by:
- `components/queue/GcashUploadPanel.tsx`
- `app/(admin-user)/(dashboard)/admin/shows/create/CreateShowForm.tsx`

## Known Operational Note

- Prisma client generation can fail with Windows DLL lock if dev server is running.
- If needed, stop dev server first, then run:
- `npx prisma generate`
- `npx prisma migrate dev`

## Validation Status

- Latest schema/API/UI changes were type-checked with:
- `npx tsc --noEmit` (pass)

## Recent Session Changes (Kanban -> Show Status Guard)

### Admin Reservations Kanban

- Stage header/color styling updated in:
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`
- Stage colors include:
- `PENDING` = yellow (header text forced white)
- `REJECTED` = red
- Dark-mode divider/line visibility improved.
- Added subtle stage tint on Kanban columns.
- Added light/pale card tinting for grouped-show visual separation.
- Drag/drop "stick/proximity" behavior adjusted to use dragged card position instead of mouse pointer position.

### Reservation Verify/Reject Behavior

- Confirmed/rejected flows continue to use reservation admin endpoints:
- `POST /api/reservations/verify`
- `POST /api/reservations/reject`
- Team ownership checks enforced (superadmin bypass).

### Reservation Expiration

- No auto-expiration/timeout logic was added for long-pending reservations in this session.

### Payment Method/Status Model Adjustments

- `PaymentMethod` enum reduced to:
- `GCASH`
- `WALK_IN`
- Removed other payment method enum values and aligned app usage.
- Rejection flow behavior reviewed: reservation status transitions to rejected/cancelled path while payment handling remains server-route controlled.

### Show Status Enum Adjustments

- `ShowStatus.POSTPONED` removed from:
- `prisma/schema.prisma`
- Admin form options:
- `app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx`
- Dashboard filtering/listing updated to include `ON_GOING` in status lists/filters.

### Show Detail: GCash Config + Editable QR

- `ShowDetailForm.tsx` expanded to edit:
- `gcash_qr_image_key`
- `gcash_number`
- `gcash_account_name`
- QR replacement now overwrites existing Cloudinary asset (instead of always creating new one) via server action updates in:
- `lib/actions/updateShow.ts`

### Image Uploader UX

- Delete affordance changed from "X" to trash icon.
- Visibility behavior enforced:
- Desktop: delete icon visible on hover
- Mobile: delete icon always visible
- In `ShowDetailForm.tsx`, delete icon hidden when `isEditing=false`; normal behavior when `isEditing=true`.

### Validation UX (No Error Lists)

- Shifted from aggregated error list to direct element highlighting (red borders).
- Field-level highlighting prioritized; parent container highlighting removed except schedule-card cases.
- Applied in:
- `app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx`
- `app/(admin-user)/(dashboard)/admin/shows/create/CreateShowForm.tsx`
- Server-side validation payloads aligned in:
- `lib/actions/createShow.ts`

### Schedule Validation Improvements (Create Show)

- In `CreateShowForm.tsx`:
- Schedules card is flagged when:
- date(s) in show range have no schedules
- overlapping schedule times exist
- Red warning text is rendered where the old "No schedules yet..." helper text appears.

### Seatmap Preview/Assignment UX

- Unassigned/error seat visualization:
- Use `public/seat-error.svg` when seat is unassigned or has no category.
- Added "Unassigned" legend behavior in seatmap preview:
- Only in SeatmapPreview context (not reservation room overlay)
- Only shown when at least one unassigned seat exists
- Desktop-only visibility
- Final position: bottom-right of canvas, no card container
- Category assignment side panel overlay anchored to top-right of canvas.
- Control bar size reduced.
- "Clear" option in category selection panel styled red.

### Seatmap Editing Guide

- Added desktop-only helper under SeatmapPreview (no card container):
- "Use Shift or Ctrl to multiselect"
- Uses `public/shift.svg` and `public/control.svg`
- Icon size increased slightly after initial addition.
- Applied to both:
- `ShowDetailForm.tsx`
- `CreateShowForm.tsx`

### Show Status Change Confirmation Modals

- Added status-change confirmation modals (warning style, yellow icon) using:
- `components/ui/dialog.tsx`
- Implemented in:
- `CreateShowForm.tsx`
- `ShowDetailForm.tsx`
- Triggered when selecting:
- `UPCOMING`: pre-launch, visible but booking disabled
- `OPEN`: launch and enable booking
- Messaging updated for consistency and clarity.

### Show Detail: Block Status Change If Reservations Exist

- Added hard guard in `ShowDetailForm.tsx`:
- If show already has reservation records, status change is blocked.
- Shows error modal (`Dialog`) with red error icon and explanatory message.
- Backend data support added in:
- `lib/db/Shows.ts` (`getShowById` now includes `_count.reservations`).

## Latest Session Updates (2026-03-06)

### Admin Access IA Restructure (Implemented)

- `app/(admin-user)/(dashboard)/admin/access/AdminAccessClient.tsx` now supports:
- Superadmin root (`/admin/access`): team directory list/table with search.
- Team click navigates to `/admin/access/[teamId]`.
- Non-superadmin root: only own team detail + own team admins list (with admin search).
- Added shared detail UI component:
- `app/(admin-user)/(dashboard)/admin/access/components/TeamAccessDetail.tsx`
- Added team detail route:
- `app/(admin-user)/(dashboard)/admin/access/[teamId]/page.tsx`
- Added API for single team fetch:
- `GET /api/admin/access/teams/[teamId]`
- File: `app/api/admin/access/teams/[teamId]/route.ts`

### Admin Role Endpoint + Team Unlink Rule (Implemented)

- Added backend-only role mutation endpoint:
- `PATCH /api/admin/access/admins/[userId]/role`
- File: `app/api/admin/access/admins/[userId]/role/route.ts`
- Rules:
- Only superadmin can call.
- Promoting to superadmin forces `team_id = null`.
- Demoting requires explicit valid `teamId`.

### Global Header Badge Update (Implemented)

- `components/AdminShield.tsx` now shows:
- `SUPERADMIN` if superadmin.
- Uppercased team name if not superadmin.
- Falls back to uppercased `teamId` when `teamName` is unavailable.
- `UNASSIGNED` fallback if no team.
- Auth typing extended in:
- `lib/features/auth/authSlice.ts`
- Added optional fields: `isSuperadmin`, `teamId`, `teamName`.
- Login auth mapping was aligned to preserve these fields in Redux state:
- `hooks/useEmail&Pass.ts`

### Admin Team Delete Action + Guard Modal (Implemented)

- Updated teams table in `AdminAccessClient.tsx`:
- Replaced placeholder action with real delete button.
- Added delete confirmation warning modal (`Dialog`).
- Added backend delete endpoint:
- `DELETE /api/admin/access/teams/[teamId]`
- File: `app/api/admin/access/teams/[teamId]/route.ts`
- Delete safety checks:
- Blocks if team has existing shows.
- Blocks if team still has assigned admins.

### Superadmin Create-Show Team Assignment Guard (Implemented)

- In `app/(admin-user)/(dashboard)/admin/shows/ShowsClient.tsx`:
- Superadmin clicking `New Show` opens modal requiring team assignment.
- Modal has typeable/searchable team picklist (`Combobox`).
- Continue routes to `/admin/shows/create?teamId=...`.
- `app/(admin-user)/(dashboard)/admin/shows/create/page.tsx` reads `teamId` query and passes it to form.
- `CreateShowForm.tsx` accepts `teamId` prop and forwards `team_id` to server action.
- `lib/actions/createShow.ts` updated:
- Superadmin must pass valid `team_id`.
- Team existence is verified server-side before create.
- Non-superadmin behavior remains scoped to own `adminContext.teamId`.

### Secure Admin Invite Onboarding (Implemented)

- Replaced plain login-link invite flow with signed token + Redis state + OTP flow.

#### New shared invite security helper

- `lib/invite/adminInvite.ts`
- Provides:
- HMAC signed token (`ADMIN_INVITE_SIGNING_SECRET`)
- Redis key helpers/session helpers
- OTP generation/hash (`ADMIN_OTP_PEPPER`)
- TTL/cooldown/attempt config constants

#### Invite sender route updated

- `app/api/admin/access/invite/route.ts`
- Now:
- Creates Redis invite session.
- Generates signed invite token.
- Sends `/login?invite=<token>` link.
- Pre-flight GET endpoint added: `GET /api/admin/access/invite?teamId=&email=`
  - Returns `{ exists, isTeamMember }`.
  - Used by client before sending the invite to validate the email is not already on the team.
  - Returns `isTeamMember: true` if email already belongs to that team.
- If email already belongs to an existing Admin on the same team: client shows inline field error "This email is already a member of this team."
- If email belongs to an existing Admin on a different team or not at all: invite proceeds normally.

#### New invite onboarding APIs

- `POST /api/admin/access/invite/validate`
- File: `app/api/admin/access/invite/validate/route.ts`
- `POST /api/admin/access/invite/send-otp`
- File: `app/api/admin/access/invite/send-otp/route.ts`
- `POST /api/admin/access/invite/verify-otp`
- File: `app/api/admin/access/invite/verify-otp/route.ts`
- `POST /api/admin/access/invite/complete`
- File: `app/api/admin/access/invite/complete/route.ts`

#### Invite completion behavior

- Requires validated token + OTP verified session.
- Creates Firebase Auth user via Admin SDK.
- Creates Admin DB row with:
- For `TEAM_ADMIN` invites: `team_id` from invite session and `is_superadmin=false`
- For `SUPERADMIN` invites: `team_id=null` and `is_superadmin=true`
- On success: deletes invite session/otp/email-lock keys from Redis.
- On failure: best-effort Firebase rollback and invite state recovery.

#### Login UI integration

- `app/login/page.tsx` now branches:
- If `invite` query param exists -> render onboarding UI.
- Else -> render normal `LoginForm`.
- New component:
- `components/admin-invite-onboarding.tsx`
- Step flow:
- Invite validation (email locked)
- Send OTP
- Verify OTP
- Complete profile (`firstName`, `lastName`, `username`, `password`)
- Auto sign-in + call existing `/api/auth/login`
- Invite-unavailable state no longer shows a "Back to login" button.

### Invite Security Hardening (Implemented)

- Claim-bound invite flow added:
- On validate, invite claim cookie is issued and bound to Redis claim key.
- OTP send/verify/complete require matching claimant context.
- Added in:
- `lib/invite/adminInvite.ts`
- `app/api/admin/access/invite/validate/route.ts`
- `app/api/admin/access/invite/send-otp/route.ts`
- `app/api/admin/access/invite/verify-otp/route.ts`
- `app/api/admin/access/invite/complete/route.ts`
- OTP state mutation race-window reduced:
- Added per-invite short Redis lock wrapper used by send-otp and verify-otp.
- External error responses were generalized in invite onboarding routes to reduce state leakage/enumeration.
- Security config parsing hardened:
- Invite/OTP TTL and limits now require bounded integer env values in `lib/invite/adminInvite.ts`.

### Superadmin Invite Flow (Implemented)

- Added dedicated endpoints:
- `POST /api/admin/access/invite/superadmin`
- `GET /api/admin/access/invite/superadmin?email=`
- File: `app/api/admin/access/invite/superadmin/route.ts`
- Permissions:
- Only existing superadmin can call these routes.
- GET behavior:
- Returns `{ exists: false }` if email has no admin account.
- Returns `{ exists: true, isSuperadmin: true }` if email is already a superadmin.
- Returns `{ exists: true, isTeamAdmin: true, teamName }` if email is an existing team admin.
- Used by client as pre-flight check before showing the confirm modal.
- POST behavior:
- If target email is already a superadmin (with no team): returns `400` error — "This email is already registered as a superadmin."
- If target email is an existing team admin: promotes immediately (`is_superadmin=true`, `team_id=null`), returns `{ success: true, promotedExistingAdmin: true }`.
- If target email is not an existing Admin record: creates a secure onboarding invite with role target `SUPERADMIN`.
- Shared invite payload/session now includes role target:
- `targetRole = TEAM_ADMIN | SUPERADMIN`
- Role-aware checks enforced through invite routes via `doesInviteMatchSession()`.

### Admin Access UI Polishing (Implemented)

- Superadmin root page (`/admin/access`) now includes a dedicated "Invite Superadmin" card.
- Superadmin invite card was positioned above "Create Team" card.
- File: `app/(admin-user)/(dashboard)/admin/access/AdminAccessClient.tsx`

### Email Sending Hardening + Test Script Updates

- Updated invite email sender:
- `lib/email/sendAdminInviteEmail.ts`
- Added `inviteLink` payload and onboarding-focused email body.
- Added OTP email sender:
- `lib/email/sendAdminInviteOtpEmail.ts`
- Added sender alignment guard:
- `lib/email/gmailSenderGuard.ts`
- Validates `GMAIL_SENDER_EMAIL` aligns with OAuth mailbox or allowed alias list.
- New optional env:
- `GMAIL_ALLOWED_SENDER_ALIASES` (comma-separated).
- Updated test script:
- `scripts/send-test-gmail.mjs`
- Added mailbox/sender alignment diagnostics and richer error output (`cause`/stack).

### Local Env Additions Used By Invite/OTP Flow

- Added to local `.env`:
- `ADMIN_INVITE_SIGNING_SECRET`
- `ADMIN_OTP_PEPPER`
- `ADMIN_INVITE_TTL_HOURS=48`
- `ADMIN_OTP_TTL_MINUTES=10`
- `ADMIN_OTP_MAX_ATTEMPTS=5`
- `ADMIN_OTP_RESEND_COOLDOWN_SECONDS=60`
- `ADMIN_OTP_MAX_RESENDS=5`
- Note: these are local environment values and must be mirrored in deployment env config.

### Admin Login Identifier Hardening (Implemented)

- Removed public username-to-email lookup endpoint:
- Deleted `app/api/auth/admin-email/route.ts`
- `components/login-form.tsx` now uses email-only admin login and password reset.
- `middleware.ts` no longer exposes `/api/auth/admin-email` as a public API route.
- Result:
- Eliminates the public admin username/email enumeration path previously noted in handoff.

## Post-Handoff Updates (After Last Handoff Edit)

### Admin Dashboard Welcome Popup Removal (Implemented)

- Removed the `/admin` welcome popup mount from:
- `app/(admin-user)/(dashboard)/admin/page.tsx`
- Deleted the unused popup component file:
- `components/welcome-admin-dialog.tsx`
- Result:
- `/admin` now loads directly without the "Welcome Admin" dialog.

### Toaster Standardization + Styling (Implemented)

- Standardized app toast usage around the shared wrapper:
- `components/ui/sonner.tsx`
- Wrapper now exposes semantic variants for app use:
- `toast.error`
- `toast.success`
- `toast.notification`
- `toast.warning`
- Global toast color mapping now uses:
- error = red
- success = green
- notification = default surface
- warning = yellow
- Updated direct `sonner` imports across app code to use the shared wrapper.

### Reservations Kanban: Invalid Move Messaging (Implemented)

- In `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`:
- Moving a `REJECTED` card to `CONFIRMED` now shows:
- `Cannot move 'Rejected' payments to 'Confirmed'.`
- Existing generic invalid-move guidance remains for unsupported drag targets.

### Reservations Search Fix + Debounce (Implemented)

- Fixed `/admin/reservations` search crash in:
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`
- Root cause:
- Search filter referenced `reservation.seatAssignment.sched.show.show_name`, but that nested `sched.show` object is not present in the API response shape used by the page.
- Updated search to use grouped show data already available on the client:
- `show.showName`
- `show.venue`
- Added debounced search input handling:
- `searchInput` updates immediately
- `searchQuery` applies after a short delay (250ms)
- Empty-state message now keys off the raw input state.

### Reservations Kanban: Stage-Change Confirmation Modal (Implemented)

- Added confirmation modal before executing allowed drag/drop stage changes in:
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`
- Covered transitions:
- `PENDING -> CONFIRMED`
- `any card -> REJECTED`
- Modal behavior:
- explicit `Cancel` / `Move to ...` actions only
- outside click does not dismiss
- blur/pointer outside does not dismiss
- escape key does not dismiss
- Result:
- Allowed moves now require explicit admin confirmation before reservation mutation routes run.

### Reservations Kanban: Stage Rules + Preview UX (Updated This Session)

- File updated:
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`
- Allowed drag/drop transitions are now limited to:
- `PENDING -> CONFIRMED`
- `PENDING -> REJECTED`
- Explicitly blocked transitions now include:
- `CONFIRMED -> REJECTED`
- `REJECTED -> CONFIRMED`
- Invalid move feedback now uses warning toasts aligned to the shared toast wrapper.
- Stage-change confirmation dialog was restyled as a warning modal with:
- warning icon
- destructive confirm button
- irreversible-action copy (`This action cannot be undone or changed.`)
- Cross-column drag is intentionally not sortable.
- When dragging a pending card over an allowed destination column, a sticky gray preview/shadow is shown only at the top of that destination list.
- On drop to an allowed destination, the card stays visually in the destination column while the confirmation modal is open.
- On confirm, the moved card is always inserted at the very top of the destination column.
- On cancel, the card now animates back toward the source column using a rollback ghost animation.
- Rollback animation duration is currently `360ms`.

## Latest Session Updates (2026-03-13 to 2026-03-14)

### Reservation Number Tracking (Implemented)

- Added `Reservation.reservation_number` as a required 4-digit string unique per show:
- Prisma schema:
- `@@unique([show_id, reservation_number])`
- `@@index([reservation_number])`
- Migration added:
- `prisma/migrations/20260313120000_add_reservation_number_per_show/migration.sql`
- Backfill behavior:
- Existing reservations are assigned unique 4-digit values per `show_id` before `NOT NULL` is enforced.
- Reservation complete flow now generates random `0000-9999` values with retry on unique conflict in:
- `app/api/queue/complete/route.ts`
- Reservation submission response now includes:
- `reservationNumber`
- Success UI now shows reservation number in:
- `components/queue/ReservationSuccessPanel.tsx`
- Submitted and status-update reservation emails now include reservation number in:
- `lib/email/sendReservationSubmittedEmail.ts`
- `lib/email/sendReservationStatusUpdateEmail.ts`
- Admin reservations API/UI now include and surface reservation number in:
- `app/api/reservations/route.ts`
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`

### Reservation Submission Storage + Performance (Updated)

- Payment submission screenshots are no longer stored as base64 in the database.
- Current flow:
- Client keeps screenshot as base64 in local component state until final submit.
- On final submit, server uploads the image to Cloudinary folder:
- `seatwise/settings/payment_submissions`
- `Payment.screenshot_url` stores the Cloudinary `secure_url`.
- Upload and reservation completion behavior implemented in:
- `app/api/queue/complete/route.ts`
- GCash upload panel still stages image locally in:
- `components/queue/GcashUploadPanel.tsx`
- Client-side screenshot preprocessing was added:
- image is compressed/resized before submission payload is stored/sent
- max dimension currently `1280`
- output quality currently `0.78`
- Reservation submit response time was reduced by:
- moving seat reads/calculations outside the interactive Prisma transaction
- setting explicit transaction timeout (`15000ms`)
- sending reservation-submitted email asynchronously after API response path

### Reservation Flow UX + Copy Updates (Updated)

- In reservation room payment step:
- Primary submit button text changed from `Confirm Reservation` to `Submit Reservation`
- Added lightweight confirmation modal before final submit
- Modal closes immediately after action and does not stay open for loading state
- Mobile modal footer uses small inline buttons at bottom-right
- Success state copy updated:
- `Reservation Confirmed` -> `Reservation Submitted`
- success message now reflects verification/review instead of final confirmation
- Files updated:
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/ReserveSeatClient.tsx`
- `components/queue/ReservationSuccessPanel.tsx`

### Admin Reservations: Same-Customer Payment Separation + Multi-Seat Fix (Implemented)

- Admin reservations cards are no longer grouped by customer identity (`email + phone`).
- Each reservation/payment now renders as a separate Kanban card keyed by:
- `payment_id` fallback `reservation_id`
- This prevents same-customer multiple payments from collapsing into one card.
- File updated:
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`
- Multi-seat reservation display bug fixed:
- `/api/reservations` now returns all seat assignments for a reservation instead of only the first seat
- Kanban seat counts, search, and reservation details modal now reflect all seats reserved under the same reservation
- Files updated:
- `app/api/reservations/route.ts`
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`

### Queue and Reservation Navigation Responsiveness (Updated)

- Navigation actions were changed to avoid waiting on cleanup requests before route changes.
- Reserve page updates:
- leaving reservation room now navigates immediately and sends `/api/queue/leave` in background (`sendBeacon`/keepalive best effort)
- external guarded navigation from reservation room now sends `/api/queue/terminate` in background and routes immediately
- queue and show routes are prefetched from reservation room
- Queue page updates:
- `Maybe later`, `Back to show`, and guarded leave navigation now route immediately and run `/api/queue/terminate` in background
- reserve/show routes are prefetched from queue page
- Files updated:
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/ReserveSeatClient.tsx`
- `app/(app-user)/(events)/queue/[showId]/[schedId]/QueueWaitingClient.tsx`

### Queue Waiting UI + Back-Button Guard (Updated)

- Queue waiting rank display changed:
- label `Current rank` -> `You're in`
- displayed rank now accounts for one active user already in reservation room (`rank + 2` display logic)
- Mobile/tablet queue layout updated:
- rank and estimated wait cards display inline
- `Proceed to seat reservation` and `Maybe later` display inline and left-aligned
- Browser back-button guard added while user has a terminable queue ticket:
- pressing browser Back triggers `window.alert("Leaving this page will remove you from the queue.")`
- current history state is immediately pushed again to keep user on queue page
- File updated:
- `app/(app-user)/(events)/queue/[showId]/[schedId]/QueueWaitingClient.tsx`

### Public Show Detail Header (Updated)

- On the public show detail route (`/<showId>`):
- mobile/tablet header now replaces breadcrumb/title with a back button using `ArrowLeft`
- back button routes to `/dashboard`
- desktop keeps normal breadcrumb behavior
- File updated:
- `components/page-header.tsx`

### Booking-Domain Cleanup Script (Added)

- Added destructive script to clear the booking-related domain tables/models:
- `scripts/clear-booking-domain.ts`
- Added npm script:
- `npm run bookings:clear -- --dry-run`
- `npm run bookings:clear -- --yes`
- Requested delete scope currently includes:
- `reservation`
- `reservedseat` (`reserved_seats`)
- `categoryset`
- `categorysetitem`
- `payment`
- `sched`
- `seatassignment`
- `seatcategory`
- `set`
- `show`

### Team Assignment Modal for Superadmin Create-Show (Polished)

- Existing superadmin create-show team assignment modal in:
- `app/(admin-user)/(dashboard)/admin/shows/ShowsClient.tsx`
- Current state:
- still uses `Combobox`
- team list defaults to first 10 teams when query is empty
- selecting via combobox sets `team_id` and routes to `/admin/shows/create?teamId=...`
- dropdown popup is rendered into a container inside the dialog to keep it interactive
- dropdown is forced to open downward for this modal instance:
- `side="bottom"`
- `align="start"`
- collision avoidance disabled for this instance
- dropdown list height increased (`max-h-80`)
- dialog content for this modal allows visible overflow (`overflow-visible`)
- empty message now only renders when no teams match or no teams exist, not at the bottom of a non-empty list
- shared combobox wrapper updates in:
- `components/ui/combobox.tsx`
- portal `container` prop support added to `ComboboxContent`
- combobox portal positioner z-index raised above dialog layer (`z-[10010]`)
- trigger mouse-down now prevents focus-steal to avoid the `aria-hidden`/focused-descendant warning when used inside inertized dialog structures

### Misc Operational Notes From This Session

- Prisma client generation still hit Windows DLL lock in local workflow when dev server/process held the engine binary.
- `npx prisma generate` may fail with `EPERM` until the locking process is stopped.
- Type checks performed after the above changes:
- `npx tsc --noEmit` (pass)

## Session Updates (2026-03-12)

### Public Show Seatmap Access Fix (Implemented)

- Public show detail seatmap preview was failing in deployed environments with `Failed to load seatmap`.
- Root cause:
- `components/seatmap/SeatmapPreview.tsx` fetches `GET /api/seatmaps/[seatmapId]`
- `middleware.ts` and `app/api/seatmaps/[seatmapId]/route.ts` previously treated that endpoint as admin-only.
- Fix applied:
- `middleware.ts` now allows unauthenticated `GET /api/seatmaps/[seatmapId]`
- `app/api/seatmaps/[seatmapId]/route.ts` now allows guest access only when the seatmap is attached to at least one user-visible show.
- Admin access remains unrestricted for the same endpoint.

### Gmail Invite Flow Diagnostics + Scope Fix Support (Implemented)

- Investigated production invite-email failures.
- Determined two distinct failure modes:
- refresh token missing Gmail profile-readable scope for sender validation
- sender email mismatch between `GMAIL_SENDER_EMAIL` and OAuth mailbox
- Updated helper script:
- `scripts/get-google-refresh-token.mjs`
- Script now requests both:
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.readonly`
- Updated sender-alignment guard:
- `lib/email/gmailSenderGuard.ts`
- Missing-scope failures now surface a direct actionable error message instead of raw Gmail API JSON.
- Current production requirement:
- `GMAIL_SENDER_EMAIL` must match the OAuth mailbox, or be configured as a verified alias and listed in `GMAIL_ALLOWED_SENDER_ALIASES`.

### Invite Email Link Origin Fix (Implemented)

- Invite emails in production were sometimes generating `localhost:3000` links.
- Root cause:
- invite sender routes hard-fell back to `http://localhost:3000` when `NEXT_PUBLIC_BASE_URL` was unset.
- Fixed in:
- `app/api/admin/access/invite/route.ts`
- `app/api/admin/access/invite/superadmin/route.ts`
- New origin resolution order:
- `NEXT_PUBLIC_BASE_URL`
- `request.nextUrl.origin`
- `http://localhost:3000` only as local fallback
- Result:
- deployed invite emails now use the deployed host even if `NEXT_PUBLIC_BASE_URL` is missing.

### Reservations Kanban: Cancel Rollback Ghost Reliability (Adjusted)

- File updated:
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`
- Investigated why the cancel rollback ghost animation only appeared intermittently.
- Main issue:
- source rollback anchor was visibly participating in layout before the flying ghost settled, making most cancels read like a local source-card lift instead of a return-flight animation.
- Adjustments made:
- rollback anchor placeholder is now visually invisible while still preserving layout space
- rollback ghost setup now runs in `useLayoutEffect` instead of `useEffect`
- Result:
- cancel animation should read more consistently as a card moving back from destination to source.

### Admin Invite Onboarding: Validation UX Upgrade (Implemented)

- Main file updated:
- `components/admin-invite-onboarding.tsx`
- Added direct field-level validation UI for onboarding profile step.
- Validation rules now enforced in UI:
- first name must not be empty
- last name must not be empty
- username must not be empty
- username must be 2-20 characters
- username must be unique
- password must not be empty
- password must be at least 8 characters and include letters and numbers
- Validation UI behavior:
- invalid fields now show red borders
- inline field error messages now render directly below inputs
- removed reliance on generic onboarding failure messaging for field mistakes
- Added debounced username uniqueness check in new route:
- `POST /api/admin/access/invite/check-username`
- File:
- `app/api/admin/access/invite/check-username/route.ts`
- Added password visibility toggle with eye icon in onboarding form.
- Updated completion API:
- `app/api/admin/access/invite/complete/route.ts`
- It now returns specific field-relevant error messages for common validation failures instead of the old generic `Unable to complete onboarding with the provided details.` message.

## Session Updates (2026-03-13)

### Reservations Kanban: Payment Record Full-Screen Portal (Implemented)

- Main file updated:
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`
- Clicking a payment record now opens a full-screen portal view instead of a popup modal.
- Portal layout:
- left column = customer details + reservation details
- right column = proof-of-payment screenshot
- Minimal styling direction:
- removed unnecessary card containers inside the portal
- relies mostly on spacing, separators, and typography
- Added smooth open/close transition for the portal.
- Added body scroll lock while portal is open.
- Delayed portal pane scrolling during transition to avoid scrollbar flash.

### Reservations Kanban: Payment Portal Content/Behavior (Implemented)

- Portal now shows:
- customer name, email, phone, address
- show name and venue
- total amount
- reserved seats and per-reservation line items
- Removed reservation ID display from the reserved-seat breakdown list.
- Added status badge display in the proof-of-payment header for:
- `CONFIRMED`
- `REJECTED`
- Status badge placement is now on the right side of the `Proof Of Payment` header.
- Added guarded date/time formatting in the portal:
- invalid schedule/date values no longer crash the page
- malformed time values now fall back safely instead of throwing `Invalid time value`

### Reservations Kanban: Payment Screenshot UX (Implemented)

- Screenshot in the portal now opens into a dedicated full-screen image overlay when clicked.
- No separate expand button remains in the base portal view.
- Expanded-image overlay behavior:
- clicking the screenshot opens fullscreen on both mobile and desktop
- download icon (`ArrowDownToLine`) added to expanded view
- mobile: download icon stays upper-left, close stays upper-right
- desktop: download and close controls align on the right
- Close button styling in expanded image view was made more obvious.

### Reservations Kanban: Portal Actions + Stage Confirmation Integration (Implemented)

- Added `Accept` and `Reject` actions inside the full-screen payment portal for pending records.
- Action styling:
- `Accept` = green
- `Reject` = red
- Portal actions reuse the same stage-change confirmation modal already used by kanban drag/drop.
- Important behavior:
- Portal-origin actions no longer close the full-screen portal before showing confirmation.
- Portal-origin actions no longer trigger the rollback ghost animation.
- Added source tracking to pending move state:
- `drag`
- `portal`
- `Check payment first?` link added to confirmation modal copy:
- opens the same full-screen payment portal for the target record
- closes the confirmation modal before opening the portal
- Confirmation modal confirm button styling updated:
- `Move to Confirmed` uses yellow styling
- rejected action remains destructive/red

### Reservations Kanban: Click Targets + Responsive Interaction (Implemented)

- Large screens:
- only the show name and customer name trigger the full-screen payment portal
- both lines share grouped hover styling
- hovering either line applies link-like styling to both
- pointer cursor now appears over both trigger lines
- Mobile and medium screens:
- the card content area opens the full-screen payment portal
- desktop text-only trigger behavior is preserved
- Drag handle cursor behavior improved:
- hover = `grab`
- active drag = `grabbing`

### Reservations Kanban: Portal Action Placement + Mobile Typography (Implemented)

- Desktop:
- portal `Accept` / `Reject` actions are fixed under the proof-of-payment area and do not scroll away
- Mobile:
- portal `Accept` / `Reject` actions stay near the top below the header area, inline, and fill available width evenly
- Portal typography was reduced on mobile for a denser/smaller presentation without changing desktop sizing.

### Reservation Room UX + Validation (Implemented, This Session)

- Main file updated:
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/ReserveSeatClient.tsx`
- Upload/preview overlay cleanup:
- Removed visible card container shell from the reservation seatmap categories overlay (chips remain visible).
- Countdown toast behavior/styling:
- Existing countdown messages are:
- `1 minute left`
- `Hurry! 20 seconds left!`
- Updated toast variants:
- `1 minute left` now uses warning/yellow.
- `Hurry! 20 seconds left!` now uses error/red.
- Step navigation fixes:
- Contact step back button now correctly returns to seatmap (`seats` step).
- Payment step back button now correctly returns to contact details (`contact` step).
- Header step cue:
- Added `Pick a Seat` capsule beside timer during the seatmap step.
- Contact-details validation upgrade (onboarding-style field validation):
- Added field-level invalid state + inline field errors for:
- first name
- last name
- address
- email
- phone number
- All fields are required before proceeding to payment.
- Email now enforces valid email format.
- Phone now enforces Philippine mobile format: must start with `09` and be exactly 11 digits.
- Phone input now accepts digits only and limits input length to 11.
- Server-side validation aligned in:
- `app/api/queue/complete/route.ts`
- Added matching backend regex checks for email and `09` + 11-digit phone.
- Seat-step action placement changes:
- Mobile: `Leave Reservation Room` sits directly under `Proceed to Contact Details`, full width.
- Desktop: `Leave Reservation Room` is anchored at the bottom-right of the full seat-step container (spanning the two-column parent row).
- Leave confirmation flow:
- Added confirmation modal before leaving reservation room.
- Leave action now executes only after explicit confirm.
- Modal action layout tweak:
- On mobile, modal buttons are smaller and right-aligned in one row.
- `Cancel` is on the left, `Leave Reservation Room` on the right.

### Upload Error Messaging UX (Implemented, This Session)

- Shared uploader file updated:
- `components/ui/image-upload-dropzone.tsx`
- Improved non-technical error copy:
- `file-too-large` now shows readable KB/MB notation (using `formatBytes`) instead of raw byte counts.
- Added clearer fallback messages for common rejections (invalid type, too many files).
- Retry UX tweak:
- Clicking the upload area again now clears the current error message.

### Superadmin Create-Show Team Picker Modal (Updated, This Session)

- Files updated:
- `app/(admin-user)/(dashboard)/admin/shows/ShowsClient.tsx`
- `components/ui/combobox.tsx`
- Current team assignment modal behavior:
- still uses `Combobox` for superadmin team selection before show creation
- empty query now defaults to showing the first 10 teams
- typing filters team names from the full loaded team list
- dropdown is forced to open below the field for this modal instance:
- `side="bottom"`
- `align="start"`
- collision avoidance disabled for that instance
- dropdown list height increased (`max-h-80`)
- dialog content now allows visible overflow so the dropdown is not clipped by the modal bounds
- empty state text (`No teams found.`) now renders only when there are no matching teams or no teams in the DB, not at the bottom of a non-empty list
- Interactivity/stacking fixes:
- combobox popup is portaled into a container inside the dialog instead of the document body for this modal use case
- shared combobox portal now supports custom `container`
- shared combobox positioner z-index is above dialog layer (`z-[10010]`)
- shared trigger prevents focus-steal on mouse down to avoid the `aria-hidden` warning seen inside inertized modal structures

### Create Show Submission Performance (Updated, This Session)

- Files updated:
- `lib/actions/createShow.ts`
- `app/(admin-user)/(dashboard)/admin/shows/create/CreateShowForm.tsx`
- Create-show flow improvements:
- loading state now starts immediately on submit in `CreateShowForm.tsx`, including the poster upload wait time
- removed redundant `show.findUnique()` check inside the transaction in favor of handling the unique constraint error (`P2002`) for `show_name`
- some normalization work is now done before entering the Prisma transaction:
- normalized category set names
- flattened unique category set/category key map
- schedule creation inside the transaction is now parallelized with `Promise.all`
- queue initialization after commit is now parallelized with `Promise.allSettled` instead of awaiting each schedule queue serially
- Current remaining latency notes:
- poster upload is still awaited on the client before `createShowAction`
- GCash QR upload still happens server-side inside `createShowAction`
- large seat-assignment/category-set payloads can still make show creation slow for complex seatmaps

## Session Updates (2026-03-14)

### Superadmin Create-Show Team Picker Load Timing + Dropdown Loading State (Implemented)

- File updated:
- `app/(admin-user)/(dashboard)/admin/shows/ShowsClient.tsx`
- Superadmin `New Show` flow now opens the assign-team modal immediately, then fetches teams only after the modal is open.
- Team loading is no longer awaited before opening the dialog.
- Added `hasLoadedTeams` state so a successful empty-team response is treated as loaded and does not refetch on every dialog render.
- While the fetch is pending, the combobox dropdown now shows an inline spinner (`Loader2`) beside `Loading teams...` inside the dropdown menu.

### Show Status Guard Narrowing + Queue Redis Cleanup (Implemented)

- Files updated:
- `lib/shows/showStatusLifecycle.ts`
- `lib/actions/updateShow.ts`
- `lib/actions/updateShowStatus.ts`
- `lib/db/Shows.ts`
- `app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx`
- Closing/cancelling a show is now guarded on the server by blocking reservation stages only:
- `PENDING`
- `CONFIRMED`
- Old blanket "any reservation record blocks status change" behavior was removed.
- New shared server helper:
- `assertShowCanMoveToRestrictedStatus()`
- Used by both full show update flow and status-only update flow.
- Restricted status moves now include:
- `DRAFT`
- `UPCOMING`
- `CLOSED`
- `CANCELLED`
- Result:
- if the show has blocking reservations in `PENDING` / `CONFIRMED`, it cannot be moved backward to `DRAFT` / `UPCOMING` and cannot be moved to `CLOSED` / `CANCELLED`
- When a show transitions to `CLOSED` or `CANCELLED`, queue cleanup now runs through shared lifecycle logic for every related schedule scope.
- Important nuance for full show edits:
- `updateShowAction` deletes/recreates schedules during save, so queue cleanup now uses both:
- previous schedule IDs from the existing show
- newly created schedule IDs from the current save
- This avoids leaving stale Redis keys behind after a close/cancel save.
- Queue lifecycle helper now centralizes OPEN / close-like transitions in:
- `runShowQueueStatusTransition()`
- Frontend guard still exists, but now matches the backend rule:
- `ShowDetailForm.tsx` blocks selecting:
- `DRAFT`
- `UPCOMING`
- `CLOSED`
- `CANCELLED`
- when the show has blocking reservations in `PENDING` / `CONFIRMED`
- `getShowById()` now returns:
- `blockingReservationCount`
- This is computed server-side and used for the frontend modal copy / guard.

### Show Edit Structural Lock After Reservation History (Implemented)

- Files updated:
- `lib/actions/updateShow.ts`
- `app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx`
- Root issue discovered:
- full show edit still used destructive rebuild behavior for:
- schedules
- category sets
- set rows
- seat assignments
- This caused FK errors once reservation history existed, because `reserved_seats` still references `seat_assignments`.
- Observed failure:
- `prisma.seatAssignment.deleteMany()` failed on:
- `reserved_seats_seat_assignment_id_fkey`
- Server-side fix:
- `updateShowAction` now builds a normalized structural snapshot of:
- `seatmap_id`
- GCash QR image key
- GCash number
- GCash account name
- schedules
- category sets
- seat assignments
- It also builds the equivalent snapshot from the current DB state.
- If the show has reservation history and the structural snapshot changes, the save is blocked with a clear error instead of attempting destructive deletes.
- Non-structural edits still remain allowed:
- show name
- description
- venue
- address
- status (subject to the restricted-status guard above)
- Frontend alignment:
- `ShowDetailForm.tsx` now visibly locks structural-edit controls when the show has reservation history.
- Locked UI areas now include:
- GCash QR upload/remove
- GCash number
- GCash account name
- seatmap selection
- schedule add/remove
- category set add/remove/edit
- category add/remove/edit
- seat assignment changes in seatmap preview
- Inline warning copy was updated to explain that these areas are locked because reservation history already exists.
- Important implementation detail:
- when structural edits are locked but a save is still allowed, `updateShowAction` preserves existing schedule IDs for queue lifecycle handling so status-related queue cleanup/init still works.

### Schedule-Aware Show/Schedule Status Refactor (Implemented)

- Files added/updated:
- `prisma/schema.prisma`
- `prisma/migrations/20260314183000_add_sched_status/migration.sql`
- `lib/shows/effectiveStatus.ts`
- `lib/shows/showStatusLifecycle.ts`
- `lib/db/Shows.ts`
- `lib/actions/updateShow.ts`
- `lib/actions/updateShowStatus.ts`
- `app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx`
- `app/(app-user)/(events)/[showId]/page.tsx`
- `components/queue/ReserveNowButton.tsx`
- `app/api/queue/join/route.ts`
- `app/api/queue/status/route.ts`
- `app/api/queue/active/route.ts`
- `app/api/queue/complete/route.ts`
- `app/api/reservations/reject/route.ts`
- `app/api/reservations/stage/route.ts`

#### Prisma/Data Model

- Added new enum in Prisma:
- `SchedStatus`
- Values:
- `ON_GOING`
- `FULLY_BOOKED`
- `CLOSED`
- Added nullable `Sched.status`.
- Migration added:
- `20260314183000_add_sched_status`
- Current intended persistence model:
- `FULLY_BOOKED` is persisted on `Sched.status`
- `ON_GOING` and time-based `CLOSED` are derived on read using Manila time

#### Shared Effective Status Helper

- New helper:
- `lib/shows/effectiveStatus.ts`
- Provides:
- `getEffectiveSchedStatus()`
- returns:
- `OPEN`
- `ON_GOING`
- `FULLY_BOOKED`
- `CLOSED`
- precedence:
- past end time => `CLOSED`
- current Manila time within schedule window => `ON_GOING`
- persisted `Sched.status === FULLY_BOOKED` => `FULLY_BOOKED`
- otherwise => `OPEN`
- `getEffectiveShowStatus()`
- current behavior:
- if stored `show.show_status` is not `OPEN`, it remains authoritative
- if stored status is `OPEN` and any schedule is on-going => effective show status becomes `ON_GOING`
- if stored status is `OPEN` and all schedules are past end time => effective show status becomes `CLOSED`
- otherwise => `OPEN`
- `countBlockingReservations()`
- server-side count for `PENDING` + `CONFIRMED` reservations only
- `hasShowReachedFinalScheduleEnd()`
- checks last-schedule-end condition in Manila time
- `syncScheduleCapacityStatuses()`
- event-driven schedule capacity sync:
- if a schedule has zero open seat assignments => persist `Sched.status = FULLY_BOOKED`
- if open seats become available again => clear persisted status back to `null`

#### Show Edit Flow Status Copy + Manual Status Restrictions

- `ShowDetailForm.tsx` blocked-status modal copy now varies by target status for the requested `OPEN -> ...` cases:
- `DRAFT`
- `You cannot change this OPEN production back to DRAFT because it already has <count> active reservations (only pending / confirmed)`
- `UPCOMING`
- `You cannot change this OPEN production back to UPCOMING because it already has <count> active reservations (only pending / confirmed)`
- `CANCELLED`
- `You cannot change this OPEN production to CANCELLED because it already has <count> active reservations (only pending / confirmed)`
- `CLOSED`
- `You cannot change this OPEN production to CLOSED before the show even starts.`
- Manual show-status options in the edit form now exclude:
- `ON_GOING`
- `CLOSED`
- These statuses are now treated as derived/automatic after launch rather than manually selectable in the frontend.

#### Backend Restricted Status Validation

- `assertShowCanMoveToRestrictedStatus()` in `lib/shows/showStatusLifecycle.ts` now accepts:
- current status
- next status
- show ID
- Behavior:
- `DRAFT`
- `UPCOMING`
- `CANCELLED`
- blocked server-side when the show has `PENDING` / `CONFIRMED` reservations
- `CLOSED`
- blocked server-side until the show has actually passed the end of its final schedule in Manila time
- The frontend guard still exists for UX, but backend enforcement is authoritative.

#### Derived Show Status on Read

- `lib/db/Shows.ts` now derives show status in read/query shaping instead of relying only on stored `show.show_status`.
- `getShows()`:
- fetches schedule timing/status data
- derives effective show status per row
- applies status filtering after deriving the status
- `getShowById()`:
- returns derived `show_status`
- returns each schedule with `effective_status`
- continues to return `blockingReservationCount` for frontend validation

#### Public Event Page + Reserve Entry Rules

- `app/(app-user)/(events)/[showId]/page.tsx` now serializes schedule `effective_status`.
- Reserve button visibility is now based on whether the show has at least one reservable schedule (`effective_status === OPEN`), not only on stored `show_status === OPEN`.
- Result:
- a show can be effectively `ON_GOING` and still remain bookable overall if there are future schedules that are still open

#### Schedule Picker UI Behavior

- `components/queue/ReserveNowButton.tsx` now supports per-schedule effective status.
- Schedule cards now:
- show badge in the upper-right for:
- `ON_GOING`
- `FULLY_BOOKED`
- `CLOSED`
- disable click/selection for:
- `ON_GOING`
- `FULLY_BOOKED`
- `CLOSED`
- Only schedules with effective status `OPEN` remain selectable.

#### Queue/Reservation Backend Enforcement

- Updated queue/reserve-related routes to use effective schedule/show status instead of relying only on stored `show.show_status`:
- `POST /api/queue/join`
- `GET /api/queue/status`
- `POST /api/queue/active`
- `POST /api/queue/complete`
- Current enforcement:
- queue join / active validation / completion now reject schedules unless `getEffectiveSchedStatus(...) === OPEN`
- queue endpoints also treat effective show statuses `OPEN` and `ON_GOING` as reservable at the show level
- This preserves the ability to reserve future schedules while another schedule in the same show is currently on-going

#### Fully Booked Triggering/Clearing

- `FULLY_BOOKED` is now maintained in event-driven seat mutation paths.
- After reservation completion:
- `app/api/queue/complete/route.ts`
- runs `syncScheduleCapacityStatuses()` after seats are reserved
- After reopening seats on rejection/cancellation flows:
- `app/api/reservations/reject/route.ts`
- `app/api/reservations/stage/route.ts`
- runs `syncScheduleCapacityStatuses()` so `FULLY_BOOKED` can clear automatically when seats become available again
- No cron/poller was added for this behavior.

#### Verification Status / Current Gaps

- Verified:
- `npx prisma generate` (pass)
- `npx tsc --noEmit` (pass)
- Repo-defined test command currently fails, but due to a pre-existing/broken test import path rather than this refactor:
- `npm.cmd test`
- failure:
- `lib/db/showScheduleGrouping.test.ts` cannot resolve `lib/db/showScheduleGrouping`
- No end-to-end DB/Redis-backed flow was run during this session.

## Validation Rules

- Always implement validation in both places when a form mutates server state:
- client-side for immediate UX
- server-side as the source of truth
- The backend rule must be authoritative. Frontend validation may guide or pre-block, but server logic must independently enforce the same rule.
- Do not use broad proxy checks when the real business rule is narrower.
- Example learned here:
- do not block show close/cancel just because any reservation exists
- only block when reservations are in the blocking stages (`PENDING`, `CONFIRMED`)
- Prefer server-provided derived validation inputs for frontend guards.
- Example:
- `blockingReservationCount` is computed in `lib/db/Shows.ts` and passed to the form, rather than re-deriving a looser rule in the client.
- Validation UI should be field-level or action-level, not generic aggregated error lists, unless the workflow truly needs a summary.
- Error copy should describe the exact blocking condition in business terms, not implementation terms.
- If a transition/action has side effects beyond the DB write, validate first, then run side effects after persistence.
- For this repo, queue/Redis lifecycle cleanup should run after the show status write succeeds.
- If an edit flow destroys/recreates related records, any cleanup keyed by the old records must still consider the previous identifiers.
- Example:
- show close/cancel queue cleanup must include old schedule IDs, not only newly recreated schedule IDs.
- Before implementing or changing any edit action, explicitly check whether the edit path can affect relationship structure in the database.
- This includes cases where the UI seems like a normal "edit" but the backend actually:
- deletes and recreates children
- rebinds foreign keys
- swaps referenced templates/configuration
- rebuilds join-table rows
- If the edit path can affect relationship structure, check for downstream records that may already reference those rows.
- Example learned here:
- deleting/rebuilding `seat_assignments` is not safe once `reserved_seats` exists
- because reservation history still holds FK references to those seat assignments
- For relationship-sensitive edit flows, decide the behavior up front:
- either use incremental/in-place updates
- or block structural edits once dependent records/history exist
- Do not assume a save action is safe just because validation passes at the form level.
- Also verify whether a successful edit would invalidate historical/payment/reservation records or any queue/Redis lifecycle state.
- When a feature uses derived status/state in the UI, enforce the same derived-state rules in backend mutation/read paths.
- Example learned here:
- a schedule disabled in the reserve picker because it is `ON_GOING`, `FULLY_BOOKED`, or `CLOSED`
- must also be rejected by queue join / active / complete server routes
- Prefer event-driven synchronization for derived persistence flags that depend on DB mutations.
- Example learned here:
- `Sched.status = FULLY_BOOKED` should be updated when seat assignments change
- not by background polling
- If time-based state is derived from business-local time, centralize the timezone logic in one shared helper and reuse it across:
- list/detail reads
- frontend serialization
- backend guards
- queue/reservation validation
- For statuses that become automatic after launch, remove them from manual frontend controls first, then derive them in query/API shaping before attempting any background persistence approach.

## Session Updates (2026-03-15)

### Admin Access Page: Mobile UI Improvements (Implemented)

- File: `app/(admin-user)/(dashboard)/admin/access/AdminAccessClient.tsx`
- Added `<Separator className="my-2 md:hidden" />` between each major section on mobile:
  - After the page header description block.
  - Between "Invite Superadmin" and "Create Team" cards.
  - Between "Create Team" and "Teams" cards.
- Added `pt-2` top padding on the Teams card header on mobile (preserving `md:pt-6` for desktop).
- Reduced bottom padding on Teams card header to `pb-0` on mobile (`md:pb-3` desktop) to tighten spacing between the header row and the team list.
- Teams table switched to `table-fixed` for even column distribution across Team / Admins / Action.
- Table row padding increased from `py-2` to `py-3` for more comfortable row height.
- File: `app/(admin-user)/(dashboard)/admin/access/components/TeamAccessDetail.tsx`
- Added `<Separator className="my-2 md:hidden" />` between the manage card (rename/invite) and the "Team admins" card on mobile.

### Admin Access: Inline Team Rename in Teams List (Implemented)

- File: `app/(admin-user)/(dashboard)/admin/access/AdminAccessClient.tsx`
- Added inline rename action directly on the teams list (both mobile cards and desktop table rows).
- State added:
  - `inlineEditTeamId: string | null` — which team row is in edit mode.
  - `inlineEditDraft: string` — live input value.
- Mobile behavior:
  - Each team card has a "Rename" button (ghost, icon + label).
  - Clicking opens an inline `<Input>` + Save/Cancel buttons in place of the card's name display.
  - Save: Enter key or Save button. Cancel: Cancel button or Escape key.
- Desktop behavior:
  - Team column shows clickable team name (underline on hover, routes to team detail).
  - Action cell gains "Rename" button alongside Delete when not editing.
  - When editing: Team column shows inline `<Input>`, Action cell shows Save / Cancel buttons.
- Uses existing `PATCH /api/admin/access/teams/[teamId]` endpoint.
- New handler: `inlineRenameTeam(targetTeamId)` — validates, calls PATCH, clears edit state on success.
- Icons imported: `Pencil`, `Check`, `X`.

### Admin Access: Superadmin Invite Field Validation + Confirm Modal (Implemented)

- File: `app/(admin-user)/(dashboard)/admin/access/AdminAccessClient.tsx`
- Added inline field validation for the "Invite Superadmin" email field:
  - State: `superadminInviteEmailError: string`.
  - Validates: required, valid email format (regex).
  - Error renders as red border on the input + error message below.
  - Error clears on input change.
  - Enter key triggers validation.
- Added pre-flight admin status check before opening the confirm modal:
  - Calls `GET /api/admin/access/invite/superadmin?email=` (new endpoint).
  - If already a superadmin → sets field error inline, no modal shown.
  - If existing team admin → opens confirm modal with promotion copy.
  - If new email → opens confirm modal with standard invite copy.
- Added confirmation modal (`showSuperadminConfirm`):
  - No loading state on the modal itself — purely confirmatory.
  - State: `superadminConfirmIsPromotion: boolean`, `superadminConfirmTeamName: string | null`.
  - Promotion copy: "X is currently a team admin of Y. Proceeding will promote them to superadmin and remove them from their team."
  - Invite copy: "An invite will be sent to X. Please confirm the email is correct before proceeding."
  - Confirm button label: "Confirm & Promote" (promotion) or "Confirm & Send" (invite).
  - Closing the modal does not trigger the invite.
- Error handling after POST:
  - `400` responses set `superadminInviteEmailError` inline (field-level error).
  - Non-400 errors fall through to toast.

### Admin Access: Superadmin Invite — Already-Superadmin Guard (Implemented)

- File: `app/api/admin/access/invite/superadmin/route.ts`
- POST now explicitly rejects emails that already belong to a superadmin with no team:
  - Returns `400` with error: `"This email is already registered as a superadmin."`
  - Previously this case silently no-oped (the `!is_superadmin || team_id` condition allowed re-promotion of an already-clean superadmin).
- GET pre-flight endpoint added (see Superadmin Invite Flow section above).

### Admin Access: Team Invite Field Validation + Same-Team Member Check (Implemented)

- File: `app/(admin-user)/(dashboard)/admin/access/AdminAccessClient.tsx`
- Added `inviteEmailError: Record<string, string>` state for per-team inline field errors on the invite field.
- `sendInvite(targetTeamId)` now:
  1. Validates required + email format; sets field error inline on failure.
  2. Calls `GET /api/admin/access/invite?teamId=&email=` (new pre-flight endpoint).
  3. If `isTeamMember: true` → sets field error: `"This email is already a member of this team."`
  4. If check passes → proceeds with `POST /api/admin/access/invite`.
  5. POST errors still surface as toasts.
- File: `app/(admin-user)/(dashboard)/admin/access/components/TeamAccessDetail.tsx`
- Added props: `inviteError: string`, `onInviteErrorChange: (value: string) => void`.
- Invite email `<Input>` now shows red border when `inviteError` is set.
- Error message renders below the input.
- Error clears on any input change via `onInviteErrorChange("")`.
- File: `app/api/admin/access/invite/route.ts`
- New `GET` handler: `GET /api/admin/access/invite?teamId=&email=`
  - Auth: same team-scoping rules as POST.
  - Returns `{ exists: false }` if email has no admin account.
  - Returns `{ exists: true, isTeamMember: true }` if email's `team_id` matches the queried `teamId`.
  - Returns `{ exists: true, isTeamMember: false }` if email exists but belongs to a different team.

## TODOs

1. Send emails to customers when their reservation stage changes.
2. Create a customizable ticket design builder (drag/drop components like Canva).
3. Wire in the `walk in` mode on the admin side.
4. The email field in reservation room should have strict checking such as "@gmail.com". and should have confirmation modal ensuring the email and phone number is correct.
5. add fields in teams model: contact number, email, facebook_account.
6. Overall UI polishing.
