import assert from "node:assert/strict";
import test from "node:test";

import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import { buildTicketPdf } from "./buildTicketPdf.ts";

test("buildTicketPdf creates a single-page 8.5in x 2.75in PDF from a ticket PNG", async () => {
  const pngBuffer = await sharp({
    create: {
      width: 2550,
      height: 825,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const pdfBytes = await buildTicketPdf({
    ticketPng: pngBuffer,
  });

  assert.ok(pdfBytes.length > 0);

  const pdf = await PDFDocument.load(pdfBytes);
  assert.equal(pdf.getPageCount(), 1);

  const [page] = pdf.getPages();
  assert.equal(page.getWidth(), 612);
  assert.equal(page.getHeight(), 198);
});
