import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import { createEmptyTicketTemplate } from "./templateSchema.ts";
import { renderTicketPng } from "./renderTicketPng.ts";

async function createSolidPngDataUrl(color: {
  r: number;
  g: number;
  b: number;
  alpha?: number;
}) {
  const buffer = await sharp({
    create: {
      width: 40,
      height: 40,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();

  return `data:image/png;base64,${buffer.toString("base64")}`;
}

test("renderTicketPng returns a 2550 x 825 PNG and preserves asset z-order", async () => {
  const template = createEmptyTicketTemplate();

  template.nodes.push(
    {
      id: "asset-bottom",
      kind: "asset",
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      src: await createSolidPngDataUrl({ r: 255, g: 0, b: 0, alpha: 1 }),
      opacity: 1,
    },
    {
      id: "asset-top",
      kind: "asset",
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      src: await createSolidPngDataUrl({ r: 0, g: 0, b: 255, alpha: 1 }),
      opacity: 1,
    },
    {
      id: "field-booking-ref",
      kind: "field",
      fieldKey: "reservation_number",
      x: 120,
      y: 100,
      width: 420,
      fontSize: 58,
      fontFamily: "Georgia",
      fontWeight: 700,
      fill: "#111827",
      align: "left",
      opacity: 1,
    },
    {
      id: "qr-1",
      kind: "qr",
      x: 2200,
      y: 100,
      size: 220,
      opacity: 1,
    },
  );

  const pngBuffer = await renderTicketPng({
    template,
    fields: {
      reservation_number: "SW-2026-0001",
    },
    qrValue: "https://seatwise.test/ticket/verify/signed-token",
  });

  const metadata = await sharp(pngBuffer).metadata();
  assert.equal(metadata.width, 2550);
  assert.equal(metadata.height, 825);

  const { data, info } = await sharp(pngBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixelIndex = (15 * info.width + 15) * info.channels;

  assert.equal(data[pixelIndex], 0);
  assert.equal(data[pixelIndex + 1], 0);
  assert.equal(data[pixelIndex + 2], 255);
});
