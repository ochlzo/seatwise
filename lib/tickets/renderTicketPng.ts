import QRCode from "qrcode";
import sharp from "sharp";

import {
  TICKET_TEMPLATE_CANVAS_PX_HEIGHT,
  TICKET_TEMPLATE_CANVAS_PX_WIDTH,
} from "./constants.ts";
import type { TicketTemplateAssetNode, TicketTemplateFieldNode, TicketTemplateVersion } from "./types.ts";

type RenderTicketPngParams = {
  template: TicketTemplateVersion;
  fields: Partial<Record<string, string>>;
  qrValue: string;
};

type FittedOverlay = {
  input: Buffer;
  left: number;
  top: number;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) {
    throw new Error("Only PNG data URLs are supported for ticket assets.");
  }
  return Buffer.from(match[1], "base64");
}

async function loadAssetBuffer(node: TicketTemplateAssetNode) {
  if (!node.src) {
    return null;
  }

  if (node.src.startsWith("data:image/png;base64,")) {
    return decodeDataUrl(node.src);
  }

  const response = await fetch(node.src);
  if (!response.ok) {
    throw new Error(`Failed to load ticket asset: ${node.src}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function buildQrOverlay(size: number, qrValue: string) {
  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    width: size,
    margin: 0,
    color: {
      dark: "#000000ff",
      light: "#ffffffff",
    },
  });

  return decodeDataUrl(qrDataUrl);
}

async function applyOverlayOpacity(input: Buffer, opacity: number) {
  if (opacity >= 1) {
    return input;
  }

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 3; index < data.length; index += info.channels) {
    data[index] = Math.round(data[index] * opacity);
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

async function fitOverlayToCanvas(
  input: Buffer,
  left: number,
  top: number,
): Promise<FittedOverlay | null> {
  const metadata = await sharp(input).metadata();
  const inputWidth = metadata.width ?? null;
  const inputHeight = metadata.height ?? null;

  if (!inputWidth || !inputHeight) {
    throw new Error("Ticket overlay dimensions could not be resolved.");
  }

  const sourceLeft = Math.max(0, -left);
  const sourceTop = Math.max(0, -top);
  const targetLeft = Math.max(0, left);
  const targetTop = Math.max(0, top);
  const extractWidth = Math.min(
    inputWidth - sourceLeft,
    TICKET_TEMPLATE_CANVAS_PX_WIDTH - targetLeft,
  );
  const extractHeight = Math.min(
    inputHeight - sourceTop,
    TICKET_TEMPLATE_CANVAS_PX_HEIGHT - targetTop,
  );

  if (extractWidth <= 0 || extractHeight <= 0) {
    return null;
  }

  if (
    sourceLeft === 0 &&
    sourceTop === 0 &&
    extractWidth === inputWidth &&
    extractHeight === inputHeight
  ) {
    return {
      input,
      left: targetLeft,
      top: targetTop,
    };
  }

  const clippedInput = await sharp(input)
    .extract({
      left: sourceLeft,
      top: sourceTop,
      width: extractWidth,
      height: extractHeight,
    })
    .png()
    .toBuffer();

  return {
    input: clippedInput,
    left: targetLeft,
    top: targetTop,
  };
}

function resolveTextAnchor(node: TicketTemplateFieldNode) {
  if (node.align === "center") {
    return {
      anchor: "middle",
      x: node.width ? node.width / 2 : 0,
    };
  }

  if (node.align === "right") {
    return {
      anchor: "end",
      x: node.width ?? 0,
    };
  }

  return {
    anchor: "start",
    x: 0,
  };
}

function buildFieldOverlay(node: TicketTemplateFieldNode, value: string) {
  const width = Math.max(Math.round(node.width ?? 420), 1);
  const height = Math.max(Math.ceil((node.fontSize ?? 64) * 1.4), 1);
  const { anchor, x } = resolveTextAnchor(node);
  const fontSize = node.fontSize ?? 64;
  const opacity = node.opacity ?? 1;
  const fill = node.fill ?? "#111827";
  const fontFamily = node.fontFamily ?? "Georgia";
  const fontWeight = node.fontWeight ?? 700;

  return Buffer.from(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
      `<text x="${x}" y="${fontSize}" font-size="${fontSize}" font-family="${escapeXml(fontFamily)}" font-weight="${fontWeight}" fill="${escapeXml(fill)}" fill-opacity="${opacity}" text-anchor="${anchor}">${escapeXml(value)}</text>`,
      "</svg>",
    ].join(""),
    "utf8",
  );
}

export async function renderTicketPng({
  template,
  fields,
  qrValue,
}: RenderTicketPngParams) {
  const overlays: sharp.OverlayOptions[] = [];

  for (const node of template.nodes) {
    if (node.kind === "asset") {
      const assetBuffer = await loadAssetBuffer(node);
      if (!assetBuffer) {
        continue;
      }

      const resizedAsset = await sharp(assetBuffer)
        .resize(
          Math.max(Math.round(node.width), 1),
          Math.max(Math.round(node.height), 1),
        )
        .png()
        .toBuffer();
      const fittedOverlay = await fitOverlayToCanvas(
        await applyOverlayOpacity(resizedAsset, node.opacity ?? 1),
        Math.round(node.x),
        Math.round(node.y),
      );

      if (!fittedOverlay) {
        continue;
      }

      overlays.push({
        input: fittedOverlay.input,
        left: fittedOverlay.left,
        top: fittedOverlay.top,
      });
      continue;
    }

    if (node.kind === "field") {
      const value = fields[node.fieldKey] ?? "";
      if (!value) {
        continue;
      }

      const fittedOverlay = await fitOverlayToCanvas(
        buildFieldOverlay(node, value),
        Math.round(node.x),
        Math.round(node.y),
      );

      if (!fittedOverlay) {
        continue;
      }

      overlays.push(fittedOverlay);
      continue;
    }

    if (node.kind === "qr") {
      const fittedOverlay = await fitOverlayToCanvas(
        await applyOverlayOpacity(
          await buildQrOverlay(Math.max(Math.round(node.size), 1), qrValue),
          node.opacity ?? 1,
        ),
        Math.round(node.x),
        Math.round(node.y),
      );

      if (!fittedOverlay) {
        continue;
      }

      overlays.push(fittedOverlay);
    }
  }

  return sharp({
    create: {
      width: TICKET_TEMPLATE_CANVAS_PX_WIDTH,
      height: TICKET_TEMPLATE_CANVAS_PX_HEIGHT,
      channels: 4,
      background: {
        r: 255,
        g: 255,
        b: 255,
        alpha: 1,
      },
    },
  })
    .composite(overlays)
    .png()
    .toBuffer();
}
