# Seatwise Agent Handoff (2026-02-15)

## Scope of this handoff
This file summarizes the current repository context and the recent implementation changes so a new agent can continue work without a full repo scan.

## Tech stack and runtime
- Next.js App Router (`app/`) with React 19, TypeScript, Turbopack in dev.
- UI stack: Radix UI + custom components under `components/ui`.
- State: Redux Toolkit (`lib/features/...`) for seatmap editor.
- DB: Prisma (`prisma/`) + Neon/Postgres.
- Queue infra: Upstash Redis (`@upstash/redis`) + Ably REST.
- Theme: `next-themes`, app has light/dark support in both admin and app-user flows.

## Key app areas
- Admin seatmap builder: `app/(admin-user)/seat-builder/page.tsx`
- Public show detail: `app/(app-user)/(events)/[showId]/page.tsx`
- Queue waiting page: `app/(app-user)/(events)/queue/[showId]/[schedId]/page.tsx`
- Reserve seat page: `app/(app-user)/(events)/reserve/[showId]/[schedId]/page.tsx`

## Important current state
- Portal modal integration for queue/reserve was rolled back by user.
- There is no `app/(app-user)/(events)/@modal` route tree currently.
- Queue/reserve are currently normal pages with header + sidebar layout context.

## Queue system (implemented)
Design source:
- `QUEUE_SYSTEM_DESIGN.md`

Core queue libs:
- `lib/queue/joinQueue.ts`
- `lib/queue/getQueueStatus.ts`
- `lib/queue/queueLifecycle.ts`
- `lib/queue/validateActiveSession.ts`
- `lib/queue/initializeQueue.ts`
- `lib/queue/closeQueue.ts`

Redis/Ably clients:
- `lib/clients/redis.ts`
- `lib/clients/ably.ts`

API routes:
- `app/api/queue/join/route.ts`
- `app/api/queue/status/route.ts`
- `app/api/queue/active/route.ts`
- `app/api/queue/complete/route.ts`

Current queue behavior:
- `POST /api/queue/join` validates auth + show status, joins queue, and immediately attempts promotion.
- If promoted immediately, response includes `status: "active"`, `activeToken`, `expiresAt`.
- If waiting, response includes rank and ETA.
- `GET /api/queue/status` polls user status and also runs promotion tick.
- `POST /api/queue/active` validates `ticketId + activeToken + userId + expiry`.
- `POST /api/queue/complete` ends active session, updates avg service metric, promotes next.

Client-side queue/reserve pages:
- `QueueWaitingClient` persists active session payload to `sessionStorage` when status becomes active.
- `ReserveSeatClient` validates active session on load and now renders a booking-style reserve UI with seatmap preview, category pricing, selected-seat summary, and queue session actions.

## Queue cleanup script
- Script: `scripts/cleanup-queue.ts`
- NPM command: `npm run queue:cleanup -- ...`
- Supports:
- `--all`
- `--showScopeId <showId:schedId>` (repeatable)
- `--dry-run`
- `--yes`
- Script now imports Redis client via file URL (`lib/clients/redis.ts`) to avoid ESM module resolution issues with extensionless import in Node strip-types mode.
- It deletes queue-related Redis keys and clears Ably channel history for public and discovered private channels.

## Public reserve flow changes
Main files:
- `components/queue/ReserveNowButton.tsx`
- `components/show/ShowDetailPublic.tsx`
- `app/(app-user)/(events)/[showId]/page.tsx`

Implemented UX changes:
- Reserve CTA is full width in desktop and mobile containers.
- Mobile reserve button wrapper padding was removed (`ShowDetailPublic` no longer has mobile `px-4` wrapper).
- Date selection no longer auto-advances; explicit confirm is required.
- Date step footer buttons are side-by-side, right-aligned (`Cancel` + `Confirm`).
- Schedule step footer buttons are side-by-side, right-aligned (`Cancel` + `Confirm & Join Queue`).
- Schedule cards show categories and prices directly (instead of summary text like `From PHP...`).
- Schedule card layout places time first, category chips below.
- Schedule card vertical padding was reduced.
- Clock icon in schedule card row was removed.
- Mobile text sizing in the modal was reduced for better fit.

Data loading fix:
- Show detail schedule/category and seatmap category-set content now render on first load without requiring tab interaction.

## Breadcrumb changes
- File: `components/page-header.tsx`
- Queue and reserve breadcrumbs include show name:
- Queue: `Home > Dashboard > Show_Name > Queue`
- Reserve: `Home > Dashboard > Show_Name > Reserve Seats`
- Dynamic IDs are not shown.

## Reserve flow updates in this session
Primary files:
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/page.tsx`
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/ReserveSeatClient.tsx`
- `components/page-header.tsx`
- `lib/queue/queueLifecycle.ts`
- `lib/queue/validateActiveSession.ts`
- `lib/types/queue.ts`
- `components/ui/sonner.tsx`

Implemented data and UI behavior:
- Reserve route now loads schedule-scoped seatmap data via Prisma (`show_id + sched_id`) and passes seatmap/category payload to client.
- Reserve client now renders `SeatmapPreview` for the schedule seatmap (instead of placeholder text).
- Category chips and booking summary now display category prices (PHP format).
- Selected-seat list shows seat numbers (from DB `seat.seat_number`) instead of seat IDs.
- Multi-seat flow added with capped selection at 10 seats:
- First tap selects initial seat.
- `Add Seat` arms add mode; label switches to `Select a seat` and button appears disabled until user picks a seat.
- Individual remove and clear-all actions remain available in summary.
- Parent reserve card is visually removed on mobile while preserved on `sm+` screens.
- Right-column Session Controls card was removed; only action buttons remain.
- Top timer badge is color-coded:
- Default active state is green.
- Turns red at 20s remaining.
- Countdown warnings use Sonner default styling (`components/ui/sonner.tsx`):
- `1 minute left`
- `Hurry! 20 seconds left!`

Expired-window and rejoin behavior:
- Expired message UX changed to:
- `Uh oh! Your time ran out. Rejoin the queue?`
- `Yes` rejoins via `POST /api/queue/join` and routes to queue page.
- `No` routes back to public show detail page (`/${showId}`).
- Queue expiry cleanup now publishes `SESSION_EXPIRED` on private Ably channel and cleans Redis ticket/session keys.
- Added `QueueSessionExpiredEvent` type in `lib/types/queue.ts`.
- Fixed race condition during rapid rejoin:
- cleanup now only removes `seatwise:user_ticket` mapping if it still points to the same expiring ticket, preventing accidental deletion of a newly rejoined ticket mapping.

## Admin hydration fix
- File: `app/(admin-user)/(dashboard)/layout.tsx`
- Uses `AdminSidebarClient` wrapper in server layout to avoid Radix ID mismatch/hydration warnings seen previously in sidebar collapsibles and menu trigger IDs.

## Seatmap editor changes (major)
Primary files:
- `app/(admin-user)/seat-builder/page.tsx`
- `components/seatmap/seatmap-sidebar.tsx`
- `components/seatmap/seatmap-page-header.tsx`
- `components/seatmap/SeatmapCanvas.tsx`
- `components/seatmap/SeatLayer.tsx`
- `components/seatmap/SectionLayer.tsx`
- `components/seatmap/SeatmapPreview.tsx`
- `components/seatmap/UIOverlays.tsx`
- `lib/features/seatmap/seatmapSlice.ts`

Theme and visuals:
- Seat sidebar seat icon now uses dark asset in dark mode: `public/seat-default-darkmode.svg`.
- Theme switcher added to seatmap builder header.
- Seat numbers/labels were made theme-adaptive in editor and preview.
- Export to PNG now forces light rendering background/seat visuals regardless of active app theme.

Shape/seating interactions:
- Sidebar items are draggable; drag image preview is icon-only (not whole card).
- Dropped shapes default to black stroke and no fill.
- Shape insertion from sidebar does not auto-switch draw mode.
- Exception: clicking line/guide path tools switches to draw mode.
- Holding `Ctrl` temporarily switches to select mode and reverts on keyup/blur.
- Arrow keys nudge selected objects by fixed step.
- Inline text editing for text shapes implemented via double-click/double-tap overlay textarea.

Snap/alignment behavior:
- Multi-seat and multi-shape dragging uses grouped drag state.
- During multi-drag, intra-selection spacing snap is disabled to prevent selected items snapping against each other.
- Multi-drag uses axis alignment snapping (horizontal/vertical), not symmetry computation.
- Alignment behavior applies to seats and shapes for single and multi-selection moves.

Undo/redo grouping:
- History grouping support added via `historyGroupId`.
- Grouped transforms/multi-drags commit as one undo step rather than per-object.
- Structured clone crash fixed by switching snapshot cloning to JSON clone in reducer context.
- Group rotation updates now participate in grouped history.

Selection panel:
- Black color option exists in shape color palette.
- Bulk seat labeling and text editing controls remain in panel.

## Current known limitations / watchlist
- Reserve seat page is no longer a placeholder; seatmap preview + client-side selection UX are integrated, but actual seat hold/commit booking API integration is still pending.
- Queue/reseve portal overlay behavior is not active because modal route integration was reverted.
- `ThemeSwithcer` component/file name is misspelled but consistently referenced; no functional break.
- There are a few encoding artifacts in some UI strings (for example peso symbol rendering in one file).
- `middleware.ts` deprecation warning from Next 16 still appears (`proxy` migration not yet done).

## Fast verification checklist
- Queue flow:
- Open show detail page and join queue via modal.
- Confirm first user can get immediate active session and route to reserve page.
- Confirm `Done reserving (simulate)` promotes next waiting user.
- Seatmap:
- Drag seats/shapes from sidebar and verify icon-only drag preview.
- Drop shape and confirm default black stroke + transparent fill.
- Multi-select drag should align to others but not self-snap spacing.
- Undo after grouped drag/rotate should revert as single step.
- Double-click text shape and confirm inline edit works.
- Export PNG while in dark mode and confirm light-background output.

## Session updates (2026-03-01)
Primary files touched:
- `app/api/queue/leave/route.ts`
- `app/api/queue/terminate/route.ts`
- `app/(app-user)/(events)/queue/[showId]/[schedId]/QueueWaitingClient.tsx`
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/ReserveSeatClient.tsx`
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/page.tsx`
- `components/seatmap/SeatmapPreview.tsx`
- `components/queue/GcashUploadPanel.tsx`
- `components/queue/ReserveNowButton.tsx`
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`
- `app/api/reservations/route.ts`
- `app/api/queue/complete/route.ts`
- `prisma/schema.prisma`
- `scripts/clear-reservations.ts`
- `package.json`

Queue / session lifecycle:
- Added `POST /api/queue/leave` for explicit active-session exit from reservation room.
- Added `POST /api/queue/terminate` to terminate either waiting or active tickets for a user/scope, clean Redis artifacts, publish queue move when needed, and promote next.
- Queue waiting page now has navigation guards:
- Browser leave confirmation (`beforeunload`) while in queue/active state.
- On confirmed leave/pagehide, ticket termination is attempted (`sendBeacon`/`fetch keepalive`).
- Added `Maybe later` action when status is `active`; it terminates user ticket/session and redirects to show page.
- Reservation room now also has leave guards with confirmation and termination-on-leave behavior.

Reserve UX changes:
- Replaced old add-seat arm flow with pending-seat flow:
- Tap seat -> show `Seat <seat-number>` add button -> seat enters cart only on button click.
- `Leave Reservation Room` action now exits queue session and routes back to show page.
- Removed outer seatmap wrapper card in reserve layout.
- Moved category capsules inside `SeatmapPreview` (reservation-only overlay, upper-right).
- Added compact legend in the same overlay using seat SVG icons (`selected`, `taken`), removed `open` legend entry.
- Seat availability now uses schedule `SeatAssignment.seat_status`:
- Non-open seats are non-selectable.
- Non-open seats render with `public/seat-taken.svg`.
- Cart seats render with `public/seat-selected.svg`.
- Taken-seat label text color forced to black.

Reserve/payment upload changes:
- Payment screenshot upload no longer immediately uploads to Cloudinary.
- Screenshot is read and stored as base64 client-side, then submitted with confirm payload.
- Removed "Back to seat selection" button from payment upload panel in reservation flow.
- Added QR utility actions in payment panel:
- `View full screen` portal dialog (mobile-friendly).
- `Download` QR image to device.
- Fullscreen dialog close `X` color adjusted to white.

Join queue modal feedback:
- `Confirm & Join Queue` now tracks multi-phase loading states:
- Joining queue
- Processing response
- Saving active session payload
- Redirecting
- Modal close/back actions are blocked while join is in progress.

Admin reservations page:
- Reservations list now renders rows per user under each show (aggregated seats/categories/schedules/amount) instead of one row per seat reservation.
- Verify action supports verifying multiple pending reservations for a user row.
- Stats now reflect grouped user rows.

Schema / data model refactor in progress:
- `Reservation` refactored to reference `show_id` and `sched_id`.
- Direct `Reservation -> SeatAssignment` link removed from schema.
- Seat linkage is now intended to be canonical via `ReservedSeat`.
- `app/api/queue/complete` updated to create reservations with `show_id`/`sched_id` and link seats via `ReservedSeat`.
- `app/api/reservations` updated to fetch seat details through `reservedSeats.seatAssignment`.
- Important: schema migration still needs to be applied in DB (`prisma migrate dev`) and Prisma client should be regenerated normally after stopping dev server (`npx prisma generate`).

Ops / maintenance:
- Added reservations cleanup script:
- Script: `scripts/clear-reservations.ts`
- NPM command: `npm run reservations:clear -- ...`
- Supports:
- `--dry-run`
- `--yes`
- Deletes `Payment`, `ReservedSeat`, `Reservation` rows and resets `SeatAssignment.seat_status` from `RESERVED` to `OPEN`.

## Environment variables used by queue features
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ABLY_API_KEY`
- Auth/session cookie + Firebase admin config are required for queue APIs.

## Session updates (2026-03-02)
Primary files touched:
- `app/privacy-policy/page.tsx`
- `app/terms-of-service/page.tsx`
- `app/page.tsx`
- `scripts/get-google-refresh-token.mjs`
- `scripts/send-test-gmail.mjs`
- `package.json`

Legal/compliance pages:
- Added public legal routes:
- `/privacy-policy`
- `/terms-of-service`
- Homepage footer links now point to those routes (instead of placeholder `#` links).
- These routes are intended to satisfy OAuth consent branding checks on production domain.

Google OAuth/Gmail tooling:
- Added refresh token helper script:
- `npm run oauth:refresh-token`
- File: `scripts/get-google-refresh-token.mjs`
- Starts local callback server, uses `access_type=offline` + `prompt=consent`, exchanges auth code for tokens, and prints refresh token.
- Added Gmail send test script:
- `npm run email:test -- [to] [subject] [body]`
- File: `scripts/send-test-gmail.mjs`
- Uses OAuth refresh token flow to mint access token, then sends via Gmail API `users.messages.send`.

OAuth callback URI note:
- App sign-in uses Firebase popup auth (`signInWithPopup`) for Google login, not a custom app-defined `redirect_uri` in code.
- Expected OAuth callback for Firebase auth domain is:
- `https://seatwise-5a777.firebaseapp.com/__/auth/handler`

Operational/security notes:
- GitHub push protection blocked pushes when `.env` secrets were included in commit history.
- `.env` is ignored but can still be tracked if previously committed; remove from index with `git rm --cached .env` and rewrite offending local commits before push.
- Rotate any exposed Google OAuth client secrets/refresh tokens that were committed or pasted in logs/chat.

## Session updates (2026-03-02, later)
Primary files touched:
- `prisma/schema.prisma`
- `middleware.ts`
- `app/(app-user)/layout.tsx`
- `components/page-header.tsx`
- `lib/guest.ts`
- `app/api/queue/join/route.ts`
- `app/api/queue/status/route.ts`
- `app/api/queue/active/route.ts`
- `app/api/queue/leave/route.ts`
- `app/api/queue/terminate/route.ts`
- `app/api/queue/complete/route.ts`
- `app/(app-user)/(events)/queue/[showId]/[schedId]/QueueWaitingClient.tsx`
- `app/(app-user)/(events)/reserve/[showId]/[schedId]/ReserveSeatClient.tsx`
- `components/queue/ReserveNowButton.tsx`
- `components/queue/ReservationSuccessPanel.tsx`
- `lib/email/sendReservationSubmittedEmail.ts`
- `components/login-form.tsx`
- `app/api/auth/login/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/admin-email/route.ts`
- `app/api/reservations/route.ts`
- `app/api/reservations/verify/route.ts`
- `app/(admin-user)/(dashboard)/admin/reservations/ReservationsClient.tsx`
- `app/api/users/route.ts`
- `app/api/seatmaps/route.ts`
- `app/api/seatmaps/[seatmapId]/route.ts`
- `app/api/seatCategories/[seatmapId]/route.ts`
- `app/api/uploads/cloudinary/sign/route.ts`
- `lib/db/Users.ts`
- `lib/auth/admin.ts`
- `scripts/create-default-admin.ts`
- `package.json`

Guest-first public flow and routing:
- App-user layout no longer enforces session auth and no longer renders the app-user sidebar.
- Middleware now allows public access for guest flow routes (`/dashboard`, event detail, queue, reserve, legal pages).
- Middleware now returns JSON `401` for unauthorized protected API calls (instead of redirecting API requests to HTML login), to avoid `Unexpected token '<'` JSON parse errors.

Queue identity and API contract migration:
- Added browser guest identity utility: `lib/guest.ts` (`getOrCreateGuestId()` via `localStorage`).
- Queue client components now pass `guestId` in all queue calls.
- Queue API routes were migrated from session-derived `user_id` to guest payloads:
- `POST /api/queue/join` now expects `{ showId, schedId, guestId, displayName? }`.
- `GET /api/queue/status` now expects `guestId` query param.
- `POST /api/queue/active`, `/leave`, `/terminate`, `/complete` now require `guestId`.

Reservation flow and persistence:
- Reserve flow now includes contact step before payment:
- `seats -> contact details -> payment -> confirm`.
- `/api/queue/complete` now:
- validates queue active session using `guestId`.
- creates a single reservation per purchase.
- links all selected seats via `ReservedSeat`.
- creates one payment record for total amount.
- returns success without rolling back if email send fails.
- Reservation success view now:
- hides the top show-title header card.
- displays message that confirmation/review notice was sent to entered contact email.

Email integration:
- Added `lib/email/sendReservationSubmittedEmail.ts`.
- Uses Google OAuth refresh token env vars to mint access token and call Gmail API `users.messages.send`.
- Sends "under review / verification" purchase email to reservation contact email after successful reservation transaction.

Admin-only auth migration:
- Login UI simplified to admin-only email/username + password flow (Google sign-in and signup paths removed from login form).
- Added `GET /api/auth/admin-email?username=...` helper to resolve username to admin email before Firebase email/password sign-in.
- `/api/auth/login` now only permits users present in `Admin` table; rejects others with `403`.
- `/api/auth/me` now returns admin session user shape with admin role value for frontend compatibility.

Schema refactor (breaking, in-progress integration state):
- Replaced `User` model with `Admin` model.
- Removed role enum/column usage in runtime checks (admin presence now gates authorization).
- `Reservation` now stores guest contact fields directly:
- `guest_id`, `first_name`, `last_name`, `address`, `email`, `phone_number`.
- `Review` model removed from Prisma schema for guest-first scope.

Admin reservations page/API alignment:
- Admin reservations API now reads reservation contact details directly from `Reservation` (no reservation-user join).
- Admin reservations client grouping/searching now uses reservation contact fields (email/phone/name), not `user.user_id`.

Admin bootstrap script:
- Added script to create/update default first admin in Firebase Auth and Prisma `Admin` table:
- File: `scripts/create-default-admin.ts`
- NPM command: `npm run admin:create-default`
- Default seeded credentials in script:
- email: `johnbenedictkandelarya@gmail.com`
- password: `123456`
- Script now loads `.env` manually (no dotenv dependency) and uses direct `PrismaClient`.

Current known follow-ups:
- Prisma migration + client generation must be re-run cleanly after stopping any process locking Prisma engine DLL:
- `npx prisma migrate dev`
- `npx prisma generate`
- After migration reset, run `npm run admin:create-default` to seed the first admin.
- Existing `npm run test` currently fails due unrelated historical test import resolution (`lib/db/showScheduleGrouping` module path issue).

## Session updates (2026-03-04)
Primary files touched:
- `middleware.ts`
- `app/(admin-user)/layout.tsx`
- `app/(admin-user)/(dashboard)/layout.tsx`
- `app/api/shows/search/route.ts`
- `app/(admin-user)/(dashboard)/admin/shows/ShowsClient.tsx`
- `app/login/page.tsx`
- `components/login-form.tsx`
- `app/api/auth/login/route.ts`
- `components/ui/image-upload-dropzone.tsx`
- `components/queue/GcashUploadPanel.tsx`
- `app/(admin-user)/(dashboard)/admin/shows/create/CreateShowForm.tsx`

Routing/auth redirect behavior:
- Login redirect is now effectively admin-only for page routes:
- `/admin` and `/admin/*` still redirect unauthenticated users to `/login`.
- Non-admin routes no longer globally redirect to `/login`.
- Removed broad `verifyAdmin()` gates from:
- `app/(admin-user)/layout.tsx`
- `app/(admin-user)/(dashboard)/layout.tsx`
- Middleware admin path matching no longer includes `/seat-builder`; it matches `/admin` subtree.

Public dashboard unauthorized redirect loop fix:
- Root cause observed: `GET /api/shows/search?statusGroup=active&visibility=user` returned `401`, then frontend redirected to `/login`.
- `app/api/shows/search/route.ts` now allows guest/public access for `visibility=user`.
- Admin visibility queries remain protected by session verification.
- `ShowsClient` now redirects to `/login` on `401` only when `mode === "admin"`.

Login page/UI polish:
- Login container and card max width increased on desktop (`md:max-w-5xl`) while preserving mobile width.
- Login card received desktop min-height increase for stronger visual presence.
- Form content alignment adjusted to avoid top-heavy appearance in taller card.
- Added explicit spacing below login title/description group for cleaner field separation.

Admin avatar auto-assignment on login:
- In `/api/auth/login`, when an admin has `avatar_key = NULL`, backend now:
- fetches default avatars from Cloudinary folder `seatwise/avatars/default_avatars`,
- chooses one at random,
- persists it to `Admin.avatar_key` before returning user payload.
- Uses existing helper `lib/avatars/defaultAvatars.ts`.

Reusable upload UI refactor:
- Added reusable component: `components/ui/image-upload-dropzone.tsx`.
- Refactored reservation receipt upload UI (`GcashUploadPanel`) to use shared component while preserving:
- base64 file-read flow,
- processing overlay,
- success/error messages,
- remove/reset behavior.
- Refactored show poster upload UI in `CreateShowForm` to use the same shared component:
- drag/drop + click-to-browse,
- preview with remove,
- validation error rendering,
- optional helper text,
- existing upload-on-save behavior unchanged (`uploadImageToCloudinary` in `handleSave`).
- Added object URL cleanup in poster flow when replacing/removing previews.

Validation status:
- Type check passed after refactor: `npx tsc --noEmit`.
- Existing unrelated baseline test issue remains (`lib/db/showScheduleGrouping` import resolution).

Admin profile/account route move:
- Added admin-scoped routes:
- `/admin/profile`
- `/admin/account`
- Route files:
- `app/(admin-user)/(dashboard)/admin/profile/page.tsx`
- `app/(admin-user)/(dashboard)/admin/account/page.tsx`
- These currently re-export existing page implementations from:
- `app/(app-user)/profile/page.tsx`
- `app/(app-user)/account/page.tsx`
- Updated navigation targets in user dropdown (`components/nav-user.tsx`):
- Profile now pushes `/admin/profile`
- Account now pushes `/admin/account`
- Updated account page "Edit Details" button to route to `/admin/profile`.
- Updated header parent resolution for these pages in `components/seatmap/seatmap-page-header.tsx`:
- `/admin/profile` and `/admin/account` now resolve breadcrumb parent to `Admin Dashboard` (`/admin`).
- Updated cache invalidation in:
- `lib/actions/updateProfile.ts`
- `lib/actions/updateAvatar.ts`
- Both now revalidate `/admin/profile` (and still revalidate `/profile` for compatibility during transition).
- Type check after route move passed: `npx tsc --noEmit`.
