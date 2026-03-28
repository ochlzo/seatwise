# Ticket Template Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Invoke any other relevant skills that apply to the specific task you are executing before making changes. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-managed ticket template system with a fixed-size editor, immutable template versions, server-side ticket rendering/PDF email delivery, and QR-based admin ticket consumption with public verification.

**Architecture:** Reuse the existing admin/editor patterns already used by seatmaps: a dedicated admin builder route, Prisma-backed template storage, Cloudinary-hosted assets, and small service modules in `lib/`. Ticket templates will be assigned per show, every save will create an immutable template version, reservation records will store the exact version used, and QR scans will branch into an admin-only consume flow versus a public verification page. Consuming a ticket will mark its seat assignments as `CONSUMED` and reuse the current inactive gray seat visual in the seatmap preview.

**Tech Stack:** Next.js App Router, React, Redux Toolkit, react-konva, Prisma/PostgreSQL, Cloudinary uploads, `pdf-lib`, `qrcode`, `sharp`, `qr-scanner`, existing Gmail raw-message sender

---

## Repo Findings

- `app/(admin-user)/seat-builder/page.tsx`, `components/seatmap/SeatmapFileMenu.tsx`, and `lib/actions/saveSeatmapTemplate.ts` already provide the closest existing pattern for a builder-style admin editor, template persistence, and list/detail routing.
- `app/api/uploads/cloudinary/sign/route.ts` already signs direct image uploads and should be extended instead of introducing a second upload mechanism.
- `app/api/queue/complete/route.ts` is the current reservation-completion boundary. It creates the reservation/payment, uploads payment assets, and already sends post-completion email for both online and walk-in modes.
- `app/api/reservations/verify/route.ts` is the current online-confirmation boundary. It changes `Reservation.status` to `CONFIRMED` and sends the confirmation email.
- `lib/email/gmailClient.ts` and `lib/email/reservationEmailMessages.ts` already support MIME attachments and should be reused for PDF ticket delivery.
- `app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx` already owns the seatmap-oriented admin surface, so the scanner launcher should start there instead of being attached to the ticket builder.
- `components/seatmap/SeatmapPreview.tsx` already renders non-open seats with `public/seat-taken.svg`, which is the inactive gray seat visual the consume flow should reuse.
- `prisma/schema.prisma` currently has no ticket-template or issued-ticket models, and `Show` has no ticket-template assignment field.

## Scanner Tool Decision

- **Primary choice:** `qr-scanner`
- **Why:** the official README emphasizes webcam scanning, single-image scanning, `BarcodeDetector` usage when available, and WebWorker-backed decoding, which is a good fit for a custom admin scanner page in a Next.js app.
- **Mobile expectation:** treat the scanner as mobile-first for admin door/release use, prefer the rear camera (`environment`) by default, and degrade gracefully when camera access is denied or unavailable.
- **Rejected as primary:** `html5-qrcode`
- **Why not primary:** it offers very quick turnkey UI and low-level APIs, but the official README also says the project is in maintenance mode. That makes it a weaker default choice for a new admin flow even though it remains a viable fallback if we later want a bundled scanner UI with file-scan support.

## Exact Integration Decisions

1. **Assign templates per show**
   - Add `ticket_template_id` on `Show`.
   - Surface that selector in both show create and show edit flows alongside the existing seatmap-oriented configuration.

2. **Version at save time, not edit-in-place**
   - Add `TicketTemplate` as the stable identity.
   - Add `TicketTemplateVersion` as the immutable saved editor payload.
   - The editor always loads the latest version by default; each save creates `version_number + 1`.

3. **Persist issued-ticket linkage and consume state on the reservation**
   - Add `ticket_template_version_id` on `Reservation`.
   - Add `ticket_issued_at`, `ticket_consumed_at`, `ticket_consumed_by_admin_id`, and `ticket_delivery_error` on `Reservation` to support support/debug visibility without storing duplicate template state.
   - Extend `SeatStatus` with `CONSUMED` so consumed seats can be represented directly in seat-assignment records.

4. **Use a signed QR payload that resolves differently for admin and public scans**
   - The QR should encode a signed Seatwise URL or token, not raw reservation data.
   - Public scans should land on a simple verification result page.
   - Admin scans should hit an admin-only consume flow that marks the ticket and seat assignment(s) as consumed.

5. **Issue tickets only when the reservation is actually confirmed**
   - `walk_in` reservations are already `CONFIRMED` inside `app/api/queue/complete/route.ts`, so issue there.
   - Online reservations are only confirmed in `app/api/reservations/verify/route.ts`, so issue there, not at initial queue completion.

6. **Keep the admin scanner next to the show seatmap workflow**
   - Add a scanner nav button in `ShowDetailForm.tsx`.
   - Have that button open a dedicated admin scanner page/route instead of embedding camera lifecycle code directly inside the already-large form component.
   - The scanner page should show consume results and a seatmap preview that updates the affected seat(s) immediately.
   - The scanner page should be mobile-first, default to the rear camera, and provide a fallback state when live camera scanning cannot start.

7. **Keep design assets separate from fields**
   - Asset nodes may be reordered freely.
   - Reservation field nodes must render in a dedicated top layer and never drop below uploaded assets, even if selected/repositioned.

8. **Render consumed seats with the same inactive gray seat asset already used in reservation flows**
   - Reuse `public/seat-taken.svg` by treating `CONSUMED` as inactive in `SeatmapPreview.tsx` and any other seat-status overlays.
   - A second admin scan of the same ticket must return an "already consumed" invalid state without changing data again.

9. **Render server-side at fixed export coordinates**
   - Always render a white ticket at `2550 x 825` pixels.
   - Use `qrcode` to create a PNG buffer.
   - Use `sharp` to composite the white background, uploaded PNG assets, QR image, and SVG-based text overlays.
   - Use `pdf-lib` to embed the rendered PNG into a single-page `8.5in x 2.75in` PDF.

## Assumptions To Validate During Execution

- A show uses exactly one ticket template at issuance time.
- A consumed scan marks all seat assignments linked to the reservation, not just one seat, because one ticket may represent multiple seats.
- PNG is the only supported uploaded design-asset format in v1.
- Reissuing a ticket should reuse the stored `ticket_template_version_id` rather than the show's latest template assignment.
- The existing Gmail sender remains the active provider. The new email sender should isolate provider-specific code so a later swap to Nodemailer/Resend/SendGrid/Postmark is localized.

## File Structure Map

**Schema and persistence**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_ticket_templates/*`
- Create: `lib/db/TicketTemplates.ts`
- Create: `lib/actions/saveTicketTemplate.ts`
- Create: `lib/actions/deleteTicketTemplate.ts` if the existing table/list UX requires deletion

**Admin routes and pages**
- Create: `app/(admin-user)/(dashboard)/admin/ticket-templates/page.tsx`
- Create: `app/(admin-user)/(dashboard)/admin/ticket-templates/TicketTemplateTable.tsx`
- Create: `app/(admin-user)/ticket-builder/page.tsx`
- Create: `components/ticket-template/TicketBuilderPageClient.tsx`
- Create: `app/(admin-user)/(dashboard)/admin/shows/[showId]/scanner/page.tsx`
- Create: `app/ticket/verify/[token]/page.tsx`
- Create: `app/api/ticket-templates/route.ts`
- Create: `app/api/ticket-templates/[ticketTemplateId]/route.ts`

**Editor UI/state**
- Create: `components/ticket-template/ticket-template-page-header.tsx`
- Create: `components/ticket-template/ticket-template-sidebar.tsx`
- Create: `components/ticket-template/TicketTemplateCanvas.tsx`
- Create: `components/ticket-template/TicketTemplateFileMenu.tsx`
- Create: `components/ticket-template/TicketTemplateInspector.tsx`
- Create: `components/ticket-template/TicketTemplateLayerPanel.tsx`
- Create: `components/ticket-template/TicketFieldPalette.tsx`
- Create: `lib/features/ticketTemplate/ticketTemplateSlice.ts`
- Modify: `lib/store.ts`

**Rendering and issuance**
- Create: `lib/tickets/constants.ts`
- Create: `lib/tickets/types.ts`
- Create: `lib/tickets/fieldCatalog.ts`
- Create: `lib/tickets/templateSchema.ts`
- Create: `lib/tickets/qrPayload.ts`
- Create: `lib/tickets/interpolateTicketFields.ts`
- Create: `lib/tickets/renderTicketPng.ts`
- Create: `lib/tickets/buildTicketPdf.ts`
- Create: `lib/tickets/issueReservationTicket.ts`
- Create: `lib/tickets/verifyIssuedTicket.ts`
- Create: `lib/tickets/consumeIssuedTicket.ts`

**Email and uploads**
- Modify: `app/api/uploads/cloudinary/sign/route.ts`
- Create: `lib/email/sendIssuedTicketEmail.ts`
- Create: `lib/email/ticketEmailMessages.ts`
- Modify: `lib/email/gmailClient.ts` only if attachment helpers need a generic PDF-friendly helper

**Scanner UI**
- Create: `components/tickets/AdminTicketScanner.tsx`
- Create: `components/tickets/TicketVerificationResult.tsx`
- Modify: `app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx`
- Modify: `components/seatmap/SeatmapPreview.tsx`
- Modify: `app/(app-user)/(events)/reserve/[showId]/[schedId]/page.tsx`
- Modify: `app/(admin-user)/(dashboard)/admin/walk-in/[showId]/[schedId]/room/page.tsx`
- Create: `app/api/tickets/verify/[token]/route.ts`
- Create: `app/api/tickets/consume/route.ts`

**Show assignment and reservation integration**
- Modify: `lib/actions/createShow.ts`
- Modify: `lib/actions/updateShow.ts`
- Modify: `lib/actions/showValidation.ts`
- Modify: `app/(admin-user)/(dashboard)/admin/shows/create/CreateShowForm.tsx`
- Modify: `app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx`
- Modify: `app/api/queue/complete/route.ts`
- Modify: `app/api/reservations/verify/route.ts`

**Tests**
- Create: `lib/tickets/templateSchema.test.ts`
- Create: `lib/tickets/qrPayload.test.ts`
- Create: `lib/tickets/interpolateTicketFields.test.ts`
- Create: `lib/tickets/renderTicketPng.test.ts`
- Create: `lib/tickets/buildTicketPdf.test.ts`
- Create: `lib/tickets/issueReservationTicket.test.ts`
- Create: `lib/tickets/verifyIssuedTicket.test.ts`
- Create: `lib/tickets/consumeIssuedTicket.test.ts`
- Create: `lib/email/ticketEmailMessages.test.ts`
- Modify: `package.json`

### Task 1: Add the ticket-template data model and fixed-canvas schema helpers

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_ticket_templates/*`
- Create: `lib/tickets/constants.ts`
- Create: `lib/tickets/types.ts`
- Create: `lib/tickets/templateSchema.ts`
- Test: `lib/tickets/templateSchema.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing schema tests**
  - Cover fixed canvas dimensions (`2550 x 825`), allowed node kinds (`asset`, `field`, `qr`), and the rule that field nodes are always normalized above asset nodes.
  - Run: `node --experimental-strip-types lib/tickets/templateSchema.test.ts`
  - Expected: FAIL because the schema helpers do not exist yet.

- [ ] **Step 2: Add the new Prisma models and relations**
  - Add `TicketTemplate` and `TicketTemplateVersion`.
  - Add `ticket_template_id` to `Show`.
  - Add `ticket_template_version_id`, `ticket_issued_at`, `ticket_consumed_at`, `ticket_consumed_by_admin_id`, and `ticket_delivery_error` to `Reservation`.
  - Extend `SeatStatus` to include `CONSUMED`.
  - Ensure template ownership is team-scoped with `team_id`.

- [ ] **Step 3: Generate the Prisma migration and client**
  - Run: `npx prisma migrate dev --name add_ticket_templates`
  - Expected: migration created and Prisma client regenerated without schema errors.

- [ ] **Step 4: Implement the shared ticket-template constants and schema helpers**
  - `lib/tickets/constants.ts` should export the inch and pixel dimensions.
  - `lib/tickets/templateSchema.ts` should provide normalization helpers such as `createEmptyTicketTemplate()` and `normalizeTemplateVersion()`.

- [ ] **Step 5: Update the test script**
  - Append the new ticket unit tests to the existing `npm test` chain in `package.json` using the current `node --experimental-strip-types` pattern.

- [ ] **Step 6: Re-run the schema tests**
  - Run: `node --experimental-strip-types lib/tickets/templateSchema.test.ts`
  - Expected: PASS

- [ ] **Step 7: Commit**
  - Run:
    ```bash
    git add prisma/schema.prisma prisma/migrations package.json lib/tickets/constants.ts lib/tickets/types.ts lib/tickets/templateSchema.ts lib/tickets/templateSchema.test.ts
    git commit -m "feat: add ticket template schema and versioning models"
    ```

### Task 2: Build the query, save, and versioning layer

**Files:**
- Create: `lib/db/TicketTemplates.ts`
- Create: `lib/actions/saveTicketTemplate.ts`
- Create: `app/api/ticket-templates/route.ts`
- Create: `app/api/ticket-templates/[ticketTemplateId]/route.ts`
- Test: `lib/tickets/issueReservationTicket.test.ts` (version lookup portions can start here)

- [ ] **Step 1: Write the failing persistence tests**
  - Cover "saving a template creates version 1", "saving again creates version 2", and "loading a template returns latest version plus historical versions".
  - Run: `node --experimental-strip-types lib/tickets/issueReservationTicket.test.ts`
  - Expected: FAIL because the version-lookup helpers are missing.

- [ ] **Step 2: Implement the team-scoped query helpers**
  - Add list/detail helpers in `lib/db/TicketTemplates.ts`.
  - Mirror the style used by `lib/db/Seatmaps.ts`.

- [ ] **Step 3: Implement the save action**
  - `saveTicketTemplate.ts` should:
    - assert admin context
    - create the template shell if needed
    - create a new immutable `TicketTemplateVersion`
    - store the normalized editor schema JSON with Cloudinary asset references

- [ ] **Step 4: Add list/detail API routes**
  - `GET /api/ticket-templates` for admin lists and show selectors.
  - `GET /api/ticket-templates/:ticketTemplateId` for builder load.
  - Keep auth checks aligned with `getCurrentAdminContext()`.

- [ ] **Step 5: Re-run the persistence/version test**
  - Run: `node --experimental-strip-types lib/tickets/issueReservationTicket.test.ts`
  - Expected: PASS for the lookup/version pieces added so far.

- [ ] **Step 6: Commit**
  - Run:
    ```bash
    git add lib/db/TicketTemplates.ts lib/actions/saveTicketTemplate.ts app/api/ticket-templates
    git commit -m "feat: add ticket template persistence and version routes"
    ```

### Task 3: Add admin list pages, show-level ticket-template assignment, and the scanner launcher

**Files:**
- Create: `app/(admin-user)/(dashboard)/admin/ticket-templates/page.tsx`
- Create: `app/(admin-user)/(dashboard)/admin/ticket-templates/TicketTemplateTable.tsx`
- Create: `app/(admin-user)/(dashboard)/admin/shows/[showId]/scanner/page.tsx`
- Modify: `lib/actions/createShow.ts`
- Modify: `lib/actions/updateShow.ts`
- Modify: `lib/actions/showValidation.ts`
- Modify: `app/(admin-user)/(dashboard)/admin/shows/create/CreateShowForm.tsx`
- Modify: `app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx`

- [ ] **Step 1: Add the failing selector/UI acceptance checks**
  - Document manual checks for:
    - ticket templates list loads in admin
    - create show form can select a template
    - edit show form can change the assigned template
    - show detail page exposes a scanner launcher next to the seatmap-oriented actions
  - Expected initial result: no list page and no selector fields exist.

- [ ] **Step 2: Create the admin ticket-template list page**
  - Follow the existing `admin/templates` pattern for page header, loading, and table actions.
  - Include actions to create/open a template in `/ticket-builder`.

- [ ] **Step 3: Add `ticket_template_id` to show create/update payloads**
  - Thread the new field through `createShowAction`, `updateShowAction`, and validation.
  - Reuse the same server-action style already used for `seatmap_id`.

- [ ] **Step 4: Add the selector to the admin show forms**
  - Place it near the seatmap selection fields because both are show-level presentation configuration.
  - Reuse the existing combobox/list filtering pattern instead of inventing new selector UI.

- [ ] **Step 5: Add the scanner launcher**
  - Add a nav/button entry inside `ShowDetailForm.tsx` that routes to the dedicated admin scanner page for the current show.
  - Keep camera lifecycle out of the form itself.

- [ ] **Step 6: Validate with lint**
  - Run: `npx eslint "app/(admin-user)/(dashboard)/admin/ticket-templates/page.tsx" "app/(admin-user)/(dashboard)/admin/ticket-templates/TicketTemplateTable.tsx" "app/(admin-user)/(dashboard)/admin/shows/[showId]/scanner/page.tsx" "app/(admin-user)/(dashboard)/admin/shows/create/CreateShowForm.tsx" "app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx" "lib/actions/createShow.ts" "lib/actions/updateShow.ts" "lib/actions/showValidation.ts"`
  - Expected: PASS

- [ ] **Step 7: Commit**
  - Run:
    ```bash
    git add "app/(admin-user)/(dashboard)/admin/ticket-templates" "app/(admin-user)/(dashboard)/admin/shows/[showId]/scanner/page.tsx" lib/actions/createShow.ts lib/actions/updateShow.ts lib/actions/showValidation.ts "app/(admin-user)/(dashboard)/admin/shows/create/CreateShowForm.tsx" "app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx"
    git commit -m "feat: add ticket template admin pages and scanner launcher"
    ```

### Task 4: Replace the placeholder builder with a fixed-size ticket editor

**Files:**
- Create: `app/(admin-user)/ticket-builder/page.tsx`
- Create: `components/ticket-template/TicketBuilderPageClient.tsx`
- Create: `components/ticket-template/ticket-template-page-header.tsx`
- Create: `components/ticket-template/ticket-template-sidebar.tsx`
- Create: `components/ticket-template/TicketTemplateCanvas.tsx`
- Create: `components/ticket-template/TicketTemplateFileMenu.tsx`
- Create: `components/ticket-template/TicketTemplateInspector.tsx`
- Create: `components/ticket-template/TicketTemplateLayerPanel.tsx`
- Create: `components/ticket-template/TicketFieldPalette.tsx`
- Create: `lib/features/ticketTemplate/ticketTemplateSlice.ts`
- Modify: `lib/store.ts`

- [ ] **Step 1: Write the failing editor behavior tests**
  - Add reducer-level tests for:
    - creating an empty fixed canvas
    - preventing canvas resize mutations
    - sorting field nodes above all asset nodes
  - Run: `node --experimental-strip-types lib/tickets/templateSchema.test.ts`
  - Expected: FAIL on the new editor-state expectations.

- [ ] **Step 2: Scaffold the ticket-template Redux slice**
  - Mirror the `seatmapSlice` style for title, nodes, selection, history, and dirty-state tracking.
  - Do not reuse the seatmap slice directly; the ticket editor needs different node constraints and no canvas resizing.

- [ ] **Step 3: Build the editor shell**
  - Use the same top-level structure as `seat-builder`: sidebar, page header, canvas area, file menu.
  - The stage background must always render as a white `2550 x 825` ticket.

- [ ] **Step 4: Add asset-node editing**
  - PNG upload
  - drag/move
  - resize
  - opacity controls
  - layer reorder within the asset layer only

- [ ] **Step 5: Add field-node editing**
  - Seat, row, section, date, time, venue, booking ref, customer name, QR, and similar fields should be placeable and styleable.
  - These nodes must live in a dedicated top layer that is not reorderable below asset layers.

- [ ] **Step 6: Load existing templates into the builder**
  - Support `'ticketTemplateId=<id>` in `/ticket-builder`.
  - Default to `createEmptyTicketTemplate()` when no template is requested.

- [ ] **Step 7: Validate**
  - Run: `npx eslint "app/(admin-user)/ticket-builder/page.tsx" components/ticket-template/*.tsx lib/features/ticketTemplate/ticketTemplateSlice.ts lib/store.ts`
  - Expected: PASS

- [ ] **Step 8: Commit**
  - Run:
    ```bash
    git add "app/(admin-user)/ticket-builder/page.tsx" components/ticket-template lib/features/ticketTemplate/ticketTemplateSlice.ts lib/store.ts
    git commit -m "feat: add fixed-size ticket template editor"
    ```

### Task 5: Add asset uploads and save-to-version flow from the editor

**Files:**
- Modify: `app/api/uploads/cloudinary/sign/route.ts`
- Modify: `components/ticket-template/TicketTemplateFileMenu.tsx`
- Modify: `components/ticket-template/TicketTemplateCanvas.tsx`
- Modify: `components/ticket-template/TicketTemplateInspector.tsx`
- Modify: `lib/actions/saveTicketTemplate.ts`

- [ ] **Step 1: Add the failing asset-save tests**
  - Cover:
    - uploaded asset refs are preserved in version JSON
    - saving a template emits the next version number
    - asset order in saved schema matches the visible layer panel
  - Run: `node --experimental-strip-types lib/tickets/issueReservationTicket.test.ts`
  - Expected: FAIL

- [ ] **Step 2: Extend the signed-upload route**
  - Add a `ticket-template-asset` purpose with admin-only access.
  - Store assets under a ticket-template-specific Cloudinary folder.

- [ ] **Step 3: Wire save-time uploads into the builder**
  - Reuse the current signed-upload flow used elsewhere in the app.
  - Restrict uploads to PNG.
  - Keep uploaded assets local in the editor first and only upload them to Cloudinary during Save.

- [ ] **Step 4: Implement "Save Template"**
  - Serialize the normalized editor schema.
  - Resolve local asset previews into Cloudinary refs during the save flow.
  - Call the save action.
  - Handle "new template" vs "new version of existing template".

- [ ] **Step 5: Validate**
  - Run: `npx eslint app/api/uploads/cloudinary/sign/route.ts components/ticket-template/*.tsx lib/actions/saveTicketTemplate.ts`
  - Expected: PASS

- [ ] **Step 6: Commit**
  - Run:
    ```bash
    git add app/api/uploads/cloudinary/sign/route.ts components/ticket-template lib/actions/saveTicketTemplate.ts
    git commit -m "feat: add ticket template asset uploads and save flow"
    ```

### Task 6: Build the server-side QR, PNG, and PDF rendering pipeline

**Files:**
- Create: `lib/tickets/qrPayload.ts`
- Create: `lib/tickets/fieldCatalog.ts`
- Create: `lib/tickets/interpolateTicketFields.ts`
- Create: `lib/tickets/renderTicketPng.ts`
- Create: `lib/tickets/buildTicketPdf.ts`
- Test: `lib/tickets/qrPayload.test.ts`
- Test: `lib/tickets/interpolateTicketFields.test.ts`
- Test: `lib/tickets/renderTicketPng.test.ts`
- Test: `lib/tickets/buildTicketPdf.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install the rendering dependencies**
  - Run: `npm install pdf-lib qrcode sharp qr-scanner`
  - Keep versions current at implementation time; do not hardcode stale versions into the plan execution without checking.

- [ ] **Step 2: Write the failing renderer tests**
  - `qrPayload.test.ts`: signed payloads can be generated and verified, and tampered payloads fail verification.
  - `interpolateTicketFields.test.ts`: reservation data maps correctly into field placeholders.
  - `renderTicketPng.test.ts`: output dimensions are exactly `2550 x 825`.
  - `buildTicketPdf.test.ts`: generated PDF bytes are non-empty and represent a single page.

- [ ] **Step 3: Implement signed QR payload creation**
  - Add `lib/tickets/qrPayload.ts` to build and verify a signed public token or verification URL.
  - The payload should be safe to expose publicly and must not require embedding raw customer data in the QR itself.

- [ ] **Step 4: Implement field interpolation**
  - Build a single payload shape that includes reservation number, seat labels, schedule info, venue, customer name, and the signed QR verification URL/token.

- [ ] **Step 5: Implement QR + PNG rendering**
  - Generate a QR PNG buffer with `qrcode`.
  - Use `sharp` to composite:
    - white base canvas
    - uploaded asset PNG buffers in saved z-order
    - QR image
    - SVG text overlay for field nodes

- [ ] **Step 6: Implement PDF export**
  - Use `pdf-lib` to embed the rendered PNG into an `8.5 x 2.75` inch page.

- [ ] **Step 7: Re-run the renderer tests**
  - Run:
    ```bash
    node --experimental-strip-types lib/tickets/qrPayload.test.ts
    node --experimental-strip-types lib/tickets/interpolateTicketFields.test.ts
    node --experimental-strip-types lib/tickets/renderTicketPng.test.ts
    node --experimental-strip-types lib/tickets/buildTicketPdf.test.ts
    ```
  - Expected: PASS

- [ ] **Step 8: Commit**
  - Run:
    ```bash
    git add package.json package-lock.json lib/tickets/qrPayload.ts lib/tickets/fieldCatalog.ts lib/tickets/interpolateTicketFields.ts lib/tickets/renderTicketPng.ts lib/tickets/buildTicketPdf.ts lib/tickets/qrPayload.test.ts lib/tickets/interpolateTicketFields.test.ts lib/tickets/renderTicketPng.test.ts lib/tickets/buildTicketPdf.test.ts
    git commit -m "feat: add signed qr payloads and ticket rendering"
    ```

### Task 7: Add the admin scanner consume flow and the public verification page

**Files:**
- Create: `components/tickets/AdminTicketScanner.tsx`
- Create: `components/tickets/TicketVerificationResult.tsx`
- Create: `app/(admin-user)/(dashboard)/admin/shows/[showId]/scanner/page.tsx`
- Create: `app/ticket/verify/[token]/page.tsx`
- Create: `app/api/tickets/verify/[token]/route.ts`
- Create: `app/api/tickets/consume/route.ts`
- Create: `lib/tickets/verifyIssuedTicket.ts`
- Create: `lib/tickets/consumeIssuedTicket.ts`
- Modify: `components/seatmap/SeatmapPreview.tsx`
- Modify: `app/(app-user)/(events)/reserve/[showId]/[schedId]/page.tsx`
- Modify: `app/(admin-user)/(dashboard)/admin/walk-in/[showId]/[schedId]/room/page.tsx`
- Test: `lib/tickets/verifyIssuedTicket.test.ts`
- Test: `lib/tickets/consumeIssuedTicket.test.ts`

- [ ] **Step 1: Write the failing scanner/verify tests**
  - Cover:
    - admin consume marks the reservation ticket consumed
    - all seat assignments for the reservation move to `CONSUMED`
    - a second admin consume attempt returns an already-consumed invalid result
    - public verify still resolves the ticket but reports status `CONSUMED`
  - Run:
    ```bash
    node --experimental-strip-types lib/tickets/verifyIssuedTicket.test.ts
    node --experimental-strip-types lib/tickets/consumeIssuedTicket.test.ts
    ```
  - Expected: FAIL

- [ ] **Step 2: Implement the verification and consume services**
  - `verifyIssuedTicket.ts` should resolve the QR token into a public-safe result payload.
  - `consumeIssuedTicket.ts` should require admin context, atomically set `ticket_consumed_at`, `ticket_consumed_by_admin_id`, and update linked `SeatAssignment` rows to `CONSUMED`.

- [ ] **Step 3: Add the API routes**
  - `GET /api/tickets/verify/[token]` for public-safe verification results.
  - `POST /api/tickets/consume` for admin-only consumption.

- [ ] **Step 4: Build the admin scanner page**
  - Use `qr-scanner` in a dedicated client component.
  - Start the device camera, prefer the rear camera on mobile, decode the QR, call the consume API, and show success/error feedback.
  - Support scanning the same code again and show an explicit already-consumed invalid state.
  - Add graceful fallback UI for denied permissions, unavailable cameras, and unsupported browser/device cases.

- [ ] **Step 5: Build the public verification page**
  - Use the verify API to show a simple result view.
  - When a ticket has already been consumed, the page should still resolve but show status `CONSUMED`.

- [ ] **Step 6: Update seatmap status rendering**
  - Extend `SeatmapPreview.tsx` and the current seat-status data loaders to accept `CONSUMED`.
  - Render `CONSUMED` seats with the same inactive gray `seat-taken.svg` asset already used for unavailable seats.

- [ ] **Step 7: Re-run the scanner/verify tests**
  - Run:
    ```bash
    node --experimental-strip-types lib/tickets/verifyIssuedTicket.test.ts
    node --experimental-strip-types lib/tickets/consumeIssuedTicket.test.ts
    ```
  - Expected: PASS

- [ ] **Step 8: Commit**
  - Run:
    ```bash
    git add components/tickets "app/(admin-user)/(dashboard)/admin/shows/[showId]/scanner/page.tsx" "app/ticket/verify/[token]/page.tsx" app/api/tickets lib/tickets/verifyIssuedTicket.ts lib/tickets/consumeIssuedTicket.ts components/seatmap/SeatmapPreview.tsx "app/(app-user)/(events)/reserve/[showId]/[schedId]/page.tsx" "app/(admin-user)/(dashboard)/admin/walk-in/[showId]/[schedId]/room/page.tsx" lib/tickets/verifyIssuedTicket.test.ts lib/tickets/consumeIssuedTicket.test.ts
    git commit -m "feat: add admin ticket scanner and public verification flow"
    ```

### Task 8: Integrate ticket issuance and PDF email delivery into reservation flows

**Files:**
- Create: `lib/tickets/issueReservationTicket.ts`
- Create: `lib/email/ticketEmailMessages.ts`
- Create: `lib/email/sendIssuedTicketEmail.ts`
- Modify: `app/api/queue/complete/route.ts`
- Modify: `app/api/reservations/verify/route.ts`
- Test: `lib/tickets/issueReservationTicket.test.ts`
- Test: `lib/email/ticketEmailMessages.test.ts`

- [ ] **Step 1: Write the failing issuance/email tests**
  - Cover:
    - walk-in issuance uses the show's current template
    - online verification uses the show's current template
    - reservation stores the exact `ticket_template_version_id`
    - email attaches a PDF with the expected filename
  - Run:
    ```bash
    node --experimental-strip-types lib/tickets/issueReservationTicket.test.ts
    node --experimental-strip-types lib/email/ticketEmailMessages.test.ts
    ```
  - Expected: FAIL

- [ ] **Step 2: Implement the issuance service**
  - `issueReservationTicket.ts` should:
    - load reservation + show + assigned template
    - resolve the latest template version for first issue
    - render PNG + PDF
    - update reservation with `ticket_template_version_id` and `ticket_issued_at`

- [ ] **Step 3: Implement the PDF email sender**
  - Reuse `lib/email/gmailClient.ts` to send a raw MIME message with a PDF attachment.
  - Keep provider-specific code isolated in `sendIssuedTicketEmail.ts`.

- [ ] **Step 4: Hook walk-in issuance into `/api/queue/complete`**
  - After the reservation transaction succeeds, issue the ticket immediately for `walk_in`.
  - If ticket delivery fails, return a warning without rolling back the reservation.

- [ ] **Step 5: Hook online issuance into `/api/reservations/verify`**
  - After confirmation succeeds, issue the ticket and send the PDF.
  - Preserve the existing confirmation email semantics only if they are still needed; otherwise replace them with the issued-ticket email for confirmed reservations.

- [ ] **Step 6: Re-run the issuance/email tests**
  - Run:
    ```bash
    node --experimental-strip-types lib/tickets/issueReservationTicket.test.ts
    node --experimental-strip-types lib/email/ticketEmailMessages.test.ts
    ```
  - Expected: PASS

- [ ] **Step 7: Commit**
  - Run:
    ```bash
    git add lib/tickets/issueReservationTicket.ts lib/email/ticketEmailMessages.ts lib/email/sendIssuedTicketEmail.ts app/api/queue/complete/route.ts app/api/reservations/verify/route.ts lib/tickets/issueReservationTicket.test.ts lib/email/ticketEmailMessages.test.ts
    git commit -m "feat: issue and email versioned reservation tickets"
    ```

### Task 9: Final verification, QA checklist, and rollout notes

**Files:**
- Modify: `package.json` if any test command cleanup remains
- Optional: `README.md` or internal admin notes if the team wants operator instructions

- [ ] **Step 1: Run focused automated checks**
  - Run:
    ```bash
    npm test
    npx eslint .
    ```
  - Expected: PASS

- [ ] **Step 2: Run critical manual flows**
  - Admin creates a ticket template from a blank editor.
  - Admin adds PNG assets locally in the editor, reorders them, and saves version 1.
  - Admin edits the template and saves version 2.
  - Admin assigns the template to a show.
  - Admin opens the scanner from `ShowDetailForm.tsx`, scans a fresh ticket, and sees the seat update to the inactive gray state in the seatmap.
  - Admin scans the same QR again and gets an already-consumed invalid result.
  - Admin can perform the scan flow on mobile with the rear camera selected by default.
  - If camera access is unavailable, the scanner page shows a clear fallback state instead of a broken camera surface.
  - A non-admin scan still opens the public verification page and shows status `CONSUMED` after the admin consume action.
  - Walk-in reservation completes and emails a PDF ticket.
  - Online reservation stays pending on `/api/queue/complete`, then issues the PDF ticket after `/api/reservations/verify`.

- [ ] **Step 3: Validate version immutability**
  - Confirm a reservation issued on version 1 still references version 1 after the template is later saved as version 2.

- [ ] **Step 4: Capture rollout assumptions**
  - Required env vars for Gmail and Cloudinary.
  - Cloudinary folder naming for ticket assets.
  - Whether old confirmation-email copy should be retired or coexist with ticket emails.

- [ ] **Step 5: Commit**
  - Run:
    ```bash
    git add .
    git commit -m "chore: verify ticket template editor and issuance flow"
    ```

## Expected Changed Surface Summary

- **Schema changes:** new `TicketTemplate` and `TicketTemplateVersion` models; `Show.ticket_template_id`; `Reservation.ticket_template_version_id`, `Reservation.ticket_issued_at`, `Reservation.ticket_consumed_at`, `Reservation.ticket_consumed_by_admin_id`, `Reservation.ticket_delivery_error`; `SeatStatus.CONSUMED`
- **Admin UI:** new `/admin/ticket-templates` list page, real `/ticket-builder` editor, show-form ticket-template selector, scanner launcher in `ShowDetailForm.tsx`, dedicated admin scanner page
- **APIs:** new ticket-template list/detail routes; extended Cloudinary upload-signing purpose; new public verify and admin consume ticket routes; reservation issuance hooks in existing completion/verify routes
- **Server services:** template normalization, signed QR payloads, version lookup, field interpolation, QR generation, PNG renderer, PDF builder, ticket verification service, ticket consume service, issuance service, issued-ticket email sender
- **Tests:** new `lib/tickets/*`, scanner/verify tests, and `lib/email/ticketEmailMessages.test.ts`, plus `package.json` test-chain updates

## Implementation Notes For The Executor

- Use the relevant skills for the task at hand before implementation work begins. Examples: `writing-plans` only for plan updates, `ui-system-enforcer` for admin/editor UI work, `context7` when choosing or verifying third-party libraries, `systematic-debugging` for failures, and `verification-before-completion` before claiming a task is done.
- Keep the ticket editor intentionally narrower than the seatmap editor. Do not add canvas resize, arbitrary page sizes, or non-PNG asset support in v1.
- Favor immutable template versions over "draft/publish" complexity unless a real requirement emerges during implementation.
- Do not block reservation creation on email delivery. Ticket delivery failures should be persisted as warnings/errors for admin follow-up.
- Reuse the current admin auth, page header, upload signing, and email transport patterns before introducing new abstractions.
