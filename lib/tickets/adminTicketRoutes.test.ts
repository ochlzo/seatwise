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
});

test("seat builder keeps explicit admin access enforcement", () => {
  const pageContents = readRepoFile("app/(admin-user)/seat-builder/page.tsx");

  assert.match(pageContents, /getCurrentAdminContext/);
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

test("ticket templates page keeps explicit admin access enforcement", () => {
  const pageContents = readRepoFile(
    "app/(admin-user)/(dashboard)/admin/ticket-templates/page.tsx",
  );

  assert.match(pageContents, /getCurrentAdminContext/);
});
