import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEmbeddedTicketFontFaceCss,
  buildTicketTemplateFontFaceCss,
  resolveTicketRenderFontFamily,
  TICKET_TEMPLATE_FONT_OPTIONS,
} from "./fontCatalog.ts";

test("resolveTicketRenderFontFamily appends a sans-serif fallback stack for UI fonts", () => {
  assert.equal(
    resolveTicketRenderFontFamily("Inter"),
    'Inter, "DejaVu Sans", Arial, Helvetica, sans-serif',
  );
  assert.equal(
    resolveTicketRenderFontFamily("DM Sans"),
    '"DM Sans", "DejaVu Sans", Arial, Helvetica, sans-serif',
  );
});

test("resolveTicketRenderFontFamily appends a serif fallback stack for serif fonts", () => {
  assert.equal(
    resolveTicketRenderFontFamily("Georgia"),
    'Georgia, "DejaVu Serif", "Times New Roman", serif',
  );
  assert.equal(
    resolveTicketRenderFontFamily("Playfair Display"),
    '"Playfair Display", "DejaVu Serif", "Times New Roman", serif',
  );
});

test("resolveTicketRenderFontFamily falls back to a safe sans-serif stack for unknown fonts", () => {
  assert.equal(
    resolveTicketRenderFontFamily("Unknown Custom Font"),
    '"Unknown Custom Font", "DejaVu Sans", Arial, Helvetica, sans-serif',
  );
});

test("buildTicketTemplateFontFaceCss uses local public font files instead of external font APIs", () => {
  const css = buildTicketTemplateFontFaceCss("Inter");

  assert.match(css, /@font-face/);
  assert.match(css, /\/fonts\/tickets\/inter-400\.woff2/);
  assert.match(css, /\/fonts\/tickets\/inter-700\.woff2/);
  assert.doesNotMatch(css, /fonts\.googleapis\.com/);
  assert.doesNotMatch(css, /fonts\.gstatic\.com/);
});

test("font catalog no longer exposes external css urls for downloadable families", () => {
  const interOption = TICKET_TEMPLATE_FONT_OPTIONS.find(
    (option) => option.family === "Inter",
  );

  assert.ok(interOption);
  assert.equal("cssUrl" in interOption, false);
});

test("buildEmbeddedTicketFontFaceCss inlines local font data for server-side rendering", async () => {
  const css = await buildEmbeddedTicketFontFaceCss("Inter");

  assert.match(css, /@font-face/);
  assert.match(css, /data:font\/woff2;base64,/);
  assert.doesNotMatch(css, /fonts\.googleapis\.com/);
  assert.doesNotMatch(css, /fonts\.gstatic\.com/);
});
