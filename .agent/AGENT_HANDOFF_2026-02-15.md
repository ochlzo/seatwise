# Seatwise Agent Handoff (Current State, 2026-03-06)

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
- Mobile keeps compact stacked cards and tighter spacing.
- Desktop (`md+`) uses a table for Team Admins with columns:
- `Name`, `Username`, `Email`, `Status`.
- Team Admin status badges are positioned top-right on mobile row cards.

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
- If email already belongs to an existing Admin, returns success without sending a duplicate invite.

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
- Added dedicated endpoint:
- `POST /api/admin/access/invite/superadmin`
- File: `app/api/admin/access/invite/superadmin/route.ts`
- Permissions:
- Only existing superadmin can call this route.
- Behavior:
- If target email is an existing Admin record, user is promoted immediately:
- `is_superadmin=true`
- `team_id=null`
- If target email is not an existing Admin record, creates a secure onboarding invite with role target `SUPERADMIN`.
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

### Security Note Recorded
- `app/api/auth/admin-email/route.ts` still exposes username/email enumeration risk:
- Returns distinguishable results for existing vs non-existing admin usernames.
- Not fixed in this session; recommended follow-up:
- generic responses + rate-limiting/throttling + abuse logging.
