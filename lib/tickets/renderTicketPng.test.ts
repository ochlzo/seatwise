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

function findInkBounds(
  data: Buffer,
  info: sharp.OutputInfo,
  whiteThreshold = 245,
) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * info.channels;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      if (r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (!Number.isFinite(minX)) {
    return null;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
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

test("renderTicketPng clips oversized overlays that extend beyond the ticket canvas", async () => {
  const template = createEmptyTicketTemplate();

  template.nodes.push(
    {
      id: "asset-oversized",
      kind: "asset",
      x: -30,
      y: -20,
      width: 2700,
      height: 900,
      src: await createSolidPngDataUrl({ r: 12, g: 34, b: 56, alpha: 1 }),
      opacity: 1,
    },
    {
      id: "qr-outside-right",
      kind: "qr",
      x: 2450,
      y: 700,
      size: 200,
      opacity: 1,
    },
  );

  const pngBuffer = await renderTicketPng({
    template,
    fields: {},
    qrValue: "https://seatwise.test/ticket/verify/signed-token",
  });

  const metadata = await sharp(pngBuffer).metadata();
  assert.equal(metadata.width, 2550);
  assert.equal(metadata.height, 825);
});

test("renderTicketPng wraps overflowing field text and uses available vertical space", async () => {
  const template = createEmptyTicketTemplate();

  template.nodes.push({
    id: "field-show-name",
    kind: "field",
    fieldKey: "show_name",
    x: 120,
    y: 140,
    width: 260,
    height: 160,
    fontSize: 72,
    fontFamily: "Georgia",
    fontWeight: 700,
    fill: "#111827",
    align: "left",
    opacity: 1,
  });

  const pngBuffer = await renderTicketPng({
    template,
    fields: {
      show_name:
        "Seatwise International Grand Symphony Anniversary Gala Performance Night",
    },
    qrValue: "https://seatwise.test/ticket/verify/signed-token",
  });

  const { data, info } = await sharp(pngBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const lowerHalfStartY = 220;
  const lowerHalfEndY = 300;
  const startX = 120;
  const endX = 380;

  let hasInkInLowerHalf = false;
  for (let y = lowerHalfStartY; y < lowerHalfEndY && !hasInkInLowerHalf; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * info.width + x) * info.channels;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (r < 245 || g < 245 || b < 245) {
        hasInkInLowerHalf = true;
        break;
      }
    }
  }

  assert.equal(hasInkInLowerHalf, true);
});

test("renderTicketPng applies field-node rotation when rendering reservation values", async () => {
  const baseTemplate = createEmptyTicketTemplate();
  baseTemplate.nodes.push({
    id: "field-seat",
    kind: "field",
    fieldKey: "seat",
    x: 900,
    y: 340,
    width: 640,
    height: 100,
    fontSize: 72,
    fontFamily: "Georgia",
    fontWeight: 700,
    fill: "#111827",
    align: "left",
    opacity: 1,
  });

  const rotatedTemplate = {
    ...baseTemplate,
    nodes: baseTemplate.nodes.map((node) =>
      node.kind === "field" ? { ...node, rotation: 90 } : node,
    ),
  };

  const [unrotatedPng, rotatedPng] = await Promise.all([
    renderTicketPng({
      template: baseTemplate,
      fields: { seat: "A-12 VIP LEFT WING" },
      qrValue: "https://seatwise.test/ticket/verify/signed-token",
    }),
    renderTicketPng({
      template: rotatedTemplate,
      fields: { seat: "A-12 VIP LEFT WING" },
      qrValue: "https://seatwise.test/ticket/verify/signed-token",
    }),
  ]);

  assert.notDeepEqual(unrotatedPng, rotatedPng);

  const [unrotatedRaw, rotatedRaw] = await Promise.all([
    sharp(unrotatedPng).raw().toBuffer({ resolveWithObject: true }),
    sharp(rotatedPng).raw().toBuffer({ resolveWithObject: true }),
  ]);

  const unrotatedBounds = findInkBounds(unrotatedRaw.data, unrotatedRaw.info);
  const rotatedBounds = findInkBounds(rotatedRaw.data, rotatedRaw.info);

  assert.ok(unrotatedBounds, "Expected non-white text pixels for unrotated field.");
  assert.ok(rotatedBounds, "Expected non-white text pixels for rotated field.");

  assert.ok(
    (unrotatedBounds?.width ?? 0) > (unrotatedBounds?.height ?? 0),
    "Unrotated field text should render mostly horizontally.",
  );
  assert.ok(
    (rotatedBounds?.height ?? 0) > (rotatedBounds?.width ?? 0),
    "Rotated field text should render mostly vertically.",
  );
});
