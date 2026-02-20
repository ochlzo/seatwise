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

## Environment variables used by queue features
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `ABLY_API_KEY`
- Auth/session cookie + Firebase admin config are required for queue APIs.
