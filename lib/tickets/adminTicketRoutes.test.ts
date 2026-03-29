import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");

function readRepoFile(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

test("ticket builder lives on /ticket-builder and enforces admin access", () => {
  const currentBuilderPath = "app/(admin-user)/ticket-builder/page.tsx";
  const removedAdminBuilderPath =
    "app/(admin-user)/(dashboard)/admin/ticket-builder/page.tsx";

  assert.equal(existsSync(resolve(repoRoot, currentBuilderPath)), true);
  assert.equal(existsSync(resolve(repoRoot, removedAdminBuilderPath)), false);

  const builderPage = readRepoFile(currentBuilderPath);
  assert.match(builderPage, /getCurrentAdminContext/);
  assert.match(builderPage, /notFound/);
  assert.doesNotMatch(builderPage, /callbackUrl/);
  assert.doesNotMatch(builderPage, /redirect/);
});

test("seat builder keeps explicit admin access enforcement", () => {
  const pageContents = readRepoFile("app/(admin-user)/seat-builder/page.tsx");

  assert.match(pageContents, /getCurrentAdminContext/);
  assert.match(pageContents, /notFound/);
  assert.doesNotMatch(pageContents, /callbackUrl/);
  assert.doesNotMatch(pageContents, /redirect/);
});

test("ticket template navigation points to /ticket-builder", () => {
  const files = [
    "components/admin-sidebar.tsx",
    "components/seatmap/seatmap-sidebar.tsx",
    "components/ticket-template/ticket-template-sidebar.tsx",
    "components/ticket-template/TicketTemplateFileMenu.tsx",
    "app/(admin-user)/(dashboard)/admin/ticket-templates/TicketTemplateTable.tsx",
  ];

  files.forEach((relativePath) => {
    const contents = readRepoFile(relativePath);
    assert.match(contents, /\/ticket-builder/);
    assert.doesNotMatch(contents, /\/admin\/ticket-builder/);
  });
});

test("ticket template file menu uses a stable trigger id for hydration", () => {
  const contents = readRepoFile(
    "components/ticket-template/TicketTemplateFileMenu.tsx",
  );

  assert.match(contents, /const triggerId = "ticket-template-file-menu-trigger"/);
  assert.match(contents, /<DropdownMenuTrigger asChild id=\{triggerId\}>/);
});

test("ticket templates page keeps explicit admin access enforcement", () => {
  const pageContents = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/ticket-templates/page.tsx",
  );

  assert.match(pageContents, /getCurrentAdminContext/);
});

test("scanner page removes readiness chrome and scanner copy that no longer matches the Figma layout", () => {
  const scannerPage = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/shows/[showId]/scanner/page.tsx",
  );
  const scannerComponent = readRepoFile("components/tickets/AdminTicketScanner.tsx");

  assert.doesNotMatch(scannerPage, /Readiness/);
  assert.doesNotMatch(scannerPage, /Manage Ticket Templates/);
  assert.doesNotMatch(
    scannerComponent,
    /ticket checks are door-staff scoped to this show/,
  );
  assert.doesNotMatch(
    scannerComponent,
    /Rear camera is active\. Point it at a Seatwise ticket QR code\./,
  );
  assert.doesNotMatch(scannerComponent, /Fallback Image Scan/);
  assert.doesNotMatch(
    scannerComponent,
    /Upload a QR screenshot or photo if camera access is unavailable\./,
  );
});

test("show detail opens a schedule-scoped ticket scanner flow instead of pushing directly to the unscoped scanner", () => {
  const showDetailForm = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx",
  );

  assert.match(showDetailForm, /Select Schedule/i);
  assert.match(showDetailForm, /Open scanner/i);
  assert.doesNotMatch(
    showDetailForm,
    /router\.push\(`\/admin\/shows\/\$\{show\.show_id\}\/scanner`\)/,
  );
});

test("scanner page is schedule scoped and keeps the mobile scanner controls aligned with the Figma layout", () => {
  const scannerPage = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/shows/[showId]/scanner/page.tsx",
  );
  const scannerComponent = readRepoFile("components/tickets/AdminTicketScanner.tsx");
  const consumeRoute = readRepoFile("app/api/tickets/consume/route.ts");
  const verifyRoute = readRepoFile("app/api/tickets/verify/route.ts");

  assert.match(scannerPage, /searchParams/);
  assert.match(consumeRoute, /schedId/);
  assert.match(verifyRoute, /schedId/);
  assert.match(scannerComponent, /Back To Show/);
  assert.match(scannerComponent, /View Seatmap Preview/);
  assert.match(scannerComponent, /View Ticket Manager/);
  assert.match(scannerComponent, /Ticket Manager/);
  assert.match(scannerComponent, /Preview/);
});

test("scanner flow pauses after scan, verifies first, and exposes consume or continue actions from the result card", () => {
  const scannerComponent = readRepoFile("components/tickets/AdminTicketScanner.tsx");

  assert.match(scannerComponent, /Consume E-Ticket/);
  assert.match(scannerComponent, /Continue/);
  assert.match(scannerComponent, /\/api\/tickets\/verify/);
  assert.match(scannerComponent, /pauseScanner/);
  assert.match(scannerComponent, /resumeScanner/);
});

test("ticket manager page is show scoped and keeps explicit admin access enforcement", () => {
  const pageContents = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/shows/[showId]/tickets/page.tsx",
  );

  assert.match(pageContents, /getCurrentAdminContext/);
  assert.match(pageContents, /notFound/);
  assert.match(pageContents, /TicketManagerPageClient/);
});

test("show detail exposes ticket manager navigation alongside the ticket scanner", () => {
  const showDetailForm = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/shows/[showId]/ShowDetailForm.tsx",
  );

  assert.match(showDetailForm, /Open Ticket Scanner/);
  assert.match(showDetailForm, /Open Ticket Manager/);
  assert.match(showDetailForm, /\/admin\/shows\/\$\{show\.show_id\}\/tickets/);
});

test("dynamic admin show routes override breadcrumb IDs with show names", () => {
  const showDetailPage = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/shows/[showId]/page.tsx",
  );
  const scannerPage = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/shows/[showId]/scanner/page.tsx",
  );
  const ticketManagerPage = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/shows/[showId]/tickets/page.tsx",
  );

  assert.match(showDetailPage, /breadcrumbLabelOverrides/);
  assert.match(scannerPage, /breadcrumbLabelOverrides/);
  assert.match(ticketManagerPage, /breadcrumbLabelOverrides/);
});

test("walk-in routes override breadcrumb IDs with show and schedule labels", () => {
  const walkInPage = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/walk-in/[showId]/[schedId]/page.tsx",
  );
  const walkInRoomPage = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/walk-in/[showId]/[schedId]/room/page.tsx",
  );

  assert.match(walkInPage, /breadcrumbLabelOverrides/);
  assert.match(walkInPage, /scheduleLabel/);
  assert.match(walkInRoomPage, /breadcrumbLabelOverrides/);
  assert.match(walkInRoomPage, /scheduleLabel/);
});

test("walk-in completion auto-consumes newly issued tickets before delivery", () => {
  const queueCompleteRoute = readRepoFile("app/api/queue/complete/route.ts");

  assert.match(queueCompleteRoute, /autoConsumeIssuedReservationTickets/);
  assert.match(queueCompleteRoute, /await autoConsumeIssuedReservationTickets\(\{/);
});

test("ticket builder loads ticket fonts from local public assets instead of external Google font stylesheets", () => {
  const canvasContents = readRepoFile(
    "components/ticket-template/TicketTemplateCanvas.tsx",
  );
  const fontCatalogContents = readRepoFile("lib/tickets/fontCatalog.ts");

  assert.doesNotMatch(canvasContents, /createElement\("link"\)/);
  assert.doesNotMatch(canvasContents, /fonts\.googleapis\.com/);
  assert.match(canvasContents, /buildTicketTemplateFontFaceCss/);
  assert.doesNotMatch(fontCatalogContents, /fonts\.googleapis\.com/);
});
