# Seatwise Agent Handoff (Current State, 2026-03-05)

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
- Invite endpoint currently sends email only via Gmail API.
- Email sender helper:
- `lib/email/sendAdminInviteEmail.ts`
- It does **not** currently:
- create an `Admin` record,
- persist invite token/state/expiry,
- provide acceptance/join-link flow,
- auto-assign invited account to team from an invite record.

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