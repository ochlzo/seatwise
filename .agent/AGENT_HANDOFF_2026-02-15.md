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
- Mobile/desktop spacing was recently tuned in:
- `ReserveSeatClient.tsx`
- `GcashUploadPanel.tsx`

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
- Latest UI/action changes were type-checked with:
- `npx tsc --noEmit` (pass)
