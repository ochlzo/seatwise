# Ticket Template Frontend QA Guide (Tasks 1-5)

This checklist is for manual frontend verification of the ticket-template work completed through Tasks 1-5 in the current repo workspace.

Scope:
- Task 1: schema and fixed canvas behavior as surfaced in the UI
- Task 2: template persistence and version loading
- Task 3: admin ticket-template pages, show assignment UI, scanner launcher visibility
- Task 4: fixed-size editor shell
- Task 5: local asset staging plus save-to-version flow

Current frontend routes:
- Ticket template library: `/admin/ticket-templates`
- Ticket template editor: `/ticket-builder`
- Existing template editor: `/ticket-builder?ticketTemplateId=<id>`
- Show create form: `/admin/shows/create`
- Show detail form: `/admin/shows/<showId>`

Important current behavior:
- The editor is admin-only at the page level.
- The ticket-template library is admin-only at the page level.
- PNG assets are added locally first.
- PNG assets are uploaded to Cloudinary only when the user saves the template.
- Saving creates a new immutable template version.

## Preconditions

- [ ] You are logged in as an admin user.
- [ ] At least one admin team exists and your account belongs to it.
- [ ] The app is running locally.
- [ ] Cloudinary env vars are configured if you want to verify save-time asset upload.
- [ ] You have 1-2 PNG files available for upload tests.
- [ ] You have at least one existing show available for edit-form checks.

## Suggested Test Data

- Template name 1: `Frontend QA Template`
- Template name 2: `Frontend QA Template v2`
- PNG asset A: small logo or badge
- PNG asset B: larger background/banner

## Flow 1: Access Control

Goal: confirm the library and editor are protected from non-admin access.

1. Open `/admin/ticket-templates` while logged out or with a non-admin account.
2. Open `/ticket-builder` while logged out or with a non-admin account.
3. Repeat both routes while logged in as an admin.

Expected:
- [ ] Non-admin or logged-out access is blocked.
- [ ] Admin access succeeds.
- [ ] The editor shell is only usable for admins.

## Flow 2: Ticket Template Library

Goal: confirm the admin list page loads and routes correctly.

1. Open `/admin/ticket-templates`.
2. Verify the page header and table render.
3. Use the search box with a known template name.
4. Change sorting between newest and oldest.
5. Click `New Template`.

Expected:
- [ ] The library page loads without client errors.
- [ ] Search updates the list.
- [ ] Sort updates the list order.
- [ ] `New Template` opens `/ticket-builder`.

## Flow 3: New Blank Template Editor

Goal: confirm the editor shell and fixed canvas behavior.

1. Open `/ticket-builder`.
2. Verify the canvas renders.
3. Verify the top/header navigation and sidebar render.
4. Confirm the canvas info shows the fixed export size.
5. Add one field node.
6. Add one QR node.

Expected:
- [ ] The editor opens on a white fixed-size ticket surface.
- [ ] The canvas size is fixed at `2550 x 825`.
- [ ] The editor loads with no existing template selected.
- [ ] The field and QR nodes appear on the canvas.
- [ ] Field/QR nodes appear above asset nodes in the layer stack.

## Flow 4: Local PNG Staging Before Save

Goal: confirm assets are not uploaded immediately when selected.

1. Open browser DevTools Network tab.
2. Filter requests with `cloudinary` and `/api/uploads/cloudinary/sign`.
3. In `/ticket-builder`, upload a PNG asset.
4. Do not click Save yet.
5. Observe the editor canvas and layer panel.

Expected:
- [ ] The PNG appears in the editor immediately as a local preview.
- [ ] The PNG appears in the layer stack.
- [ ] No Cloudinary upload request is sent yet.
- [ ] No `/api/uploads/cloudinary/sign` request is sent yet.

## Flow 5: Save Version 1

Goal: confirm the first save uploads local assets and creates version 1.

1. While still in the editor, keep at least one staged PNG asset present.
2. Set a template title.
3. Click `File` -> `Save Template`.
4. Watch the Network tab during save.

Expected:
- [ ] Save triggers the signed upload flow.
- [ ] The PNG uploads to Cloudinary during save.
- [ ] The app stays on `/ticket-builder?ticketTemplateId=<id>` after save.
- [ ] A success toast appears for version 1.
- [ ] Refreshing the page reloads the saved template successfully.
- [ ] The saved PNG still renders after refresh.

## Flow 6: Reopen Existing Template From Library

Goal: confirm persisted versions can be reopened from the library.

1. Return to `/admin/ticket-templates`.
2. Find the template you just saved.
3. Click `Edit` or `Open`.

Expected:
- [ ] The editor opens at `/ticket-builder?ticketTemplateId=<id>`.
- [ ] The saved title loads correctly.
- [ ] The saved asset, field, and QR nodes load correctly.
- [ ] Layer order matches the previously saved visible order.

## Flow 7: Save Version 2

Goal: confirm subsequent saves create a new immutable version.

1. Open the existing template.
2. Move at least one node or add another field/asset.
3. Save again.
4. Return to the library page and reopen the same template.

Expected:
- [ ] Save succeeds.
- [ ] A success toast reports the next version number.
- [ ] Reopening the template loads the latest saved changes.
- [ ] The previously saved asset refs still resolve correctly.

## Flow 8: Asset Layer Ordering

Goal: confirm asset z-order stays aligned with the visible layer panel.

1. Add or keep at least two asset nodes.
2. Reorder them in the layer panel.
3. Save the template.
4. Refresh the editor or reopen from the library.

Expected:
- [ ] The visible layer order before save is preserved after reload.
- [ ] Asset nodes stay below fields and QR.
- [ ] Field and QR nodes never drop below asset layers.

## Flow 9: Create Show Form Assignment

Goal: confirm a ticket template can be assigned while creating a show.

1. Open `/admin/shows/create`.
2. Locate the ticket-template selector.
3. Search/select the template saved above.
4. Submit the form using valid show data.

Expected:
- [ ] The ticket-template selector loads available templates.
- [ ] The correct template can be selected.
- [ ] The form submits with the selected template.

## Flow 10: Show Detail Edit Assignment

Goal: confirm template assignment can be changed on an existing show.

1. Open `/admin/shows/<showId>` for an existing show.
2. Locate the ticket-template selector.
3. Change the assigned template.
4. Save the show.
5. Reload the page.

Expected:
- [ ] The selector loads available templates.
- [ ] The selected template persists after save and reload.

## Flow 11: Scanner Launcher Visibility

Goal: confirm the scanner launcher added in Task 3 is present in the show admin UI.

1. Open `/admin/shows/<showId>`.
2. Look for the scanner launcher/button in the show detail actions area.
3. Click it.

Expected:
- [ ] The scanner launcher is visible to admins.
- [ ] It routes to `/admin/shows/<showId>/scanner`.

## Frontend Regression Checklist

- [ ] `/admin/ticket-templates` is admin-only.
- [ ] `/ticket-builder` is admin-only.
- [ ] `New Template` routes to `/ticket-builder`.
- [ ] Opening an existing template routes to `/ticket-builder?ticketTemplateId=<id>`.
- [ ] The fixed canvas remains `2550 x 825`.
- [ ] Search and sort work on the library page.
- [ ] The editor can add field nodes.
- [ ] The editor can add a QR node.
- [ ] The editor can add PNG assets.
- [ ] PNG assets stay local before save.
- [ ] PNG assets upload only during save.
- [ ] First save creates version 1.
- [ ] Next save creates the next version number.
- [ ] Saved templates reload correctly.
- [ ] Asset layer ordering survives save/reload.
- [ ] Ticket-template selection works in show create.
- [ ] Ticket-template selection works in show edit.
- [ ] Scanner launcher is visible in show detail.

## Notes For Tester

- If save fails, check browser console, server logs, and Network requests to:
  - `/api/uploads/cloudinary/sign`
  - Cloudinary upload endpoint
  - `/api/ticket-templates/<id>`
- If an asset appears before save but disappears after reload, the likely failure point is the save-time upload or the persisted schema payload.
- If the editor route is accessible without admin access, treat that as a regression.
