import QRCode from "qrcode";
import sharp from "sharp";

import { resolveTicketRenderFontFamily } from "./fontCatalog.ts";
import {
  TICKET_TEMPLATE_CANVAS_PX_HEIGHT,
  TICKET_TEMPLATE_CANVAS_PX_WIDTH,
} from "./constants.ts";
import type {
  TicketTemplateAssetNode,
  TicketTemplateFieldNode,
  TicketTemplateVersion,
} from "./types.ts";

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

const LINE_HEIGHT_RATIO = 1.2;
const DESCENDER_RATIO = 0.2;
const MIN_FIELD_FONT_SIZE = 1;

function estimateTextWidth(text: string, fontSize: number, fontWeight: number) {
  let widthUnits = 0;

  for (const character of text) {
    if (character === " ") {
      widthUnits += 0.33;
      continue;
    }

    if ("ilI1|`'.,:;!".includes(character)) {
      widthUnits += 0.28;
      continue;
    }

    if ("MW@#%&".includes(character)) {
      widthUnits += 0.92;
      continue;
    }

    if (/[A-Z]/.test(character)) {
      widthUnits += 0.68;
      continue;
    }

    if (/[0-9]/.test(character)) {
      widthUnits += 0.58;
      continue;
    }

    widthUnits += 0.56;
  }

  const weightMultiplier = fontWeight >= 700 ? 1.04 : 1;
  return widthUnits * fontSize * weightMultiplier;
}

function splitLongToken(
  token: string,
  maxWidth: number,
  fontSize: number,
  fontWeight: number,
) {
  const parts: string[] = [];
  let current = "";

  for (const character of token) {
    const next = `${current}${character}`;
    if (!current || estimateTextWidth(next, fontSize, fontWeight) <= maxWidth) {
      current = next;
      continue;
    }

    parts.push(current);
    current = character;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function wrapParagraph(
  paragraph: string,
  maxWidth: number,
  fontSize: number,
  fontWeight: number,
) {
  const tokens = paragraph.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = "";

  const pushCurrentLine = () => {
    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }
  };

  tokens.forEach((token) => {
    const candidateLine = currentLine ? `${currentLine} ${token}` : token;
    if (estimateTextWidth(candidateLine, fontSize, fontWeight) <= maxWidth) {
      currentLine = candidateLine;
      return;
    }

    if (currentLine) {
      pushCurrentLine();
    }

    if (estimateTextWidth(token, fontSize, fontWeight) <= maxWidth) {
      currentLine = token;
      return;
    }

    const brokenToken = splitLongToken(token, maxWidth, fontSize, fontWeight);
    if (!brokenToken.length) {
      return;
    }

    if (brokenToken.length === 1) {
      currentLine = brokenToken[0] ?? "";
      return;
    }

    lines.push(...brokenToken.slice(0, -1));
    currentLine = brokenToken[brokenToken.length - 1] ?? "";
  });

  pushCurrentLine();
  return lines.length ? lines : [""];
}

function wrapTextLines(
  value: string,
  maxWidth: number,
  fontSize: number,
  fontWeight: number,
) {
  const normalizedValue = value.replace(/\r\n?/g, "\n");
  const paragraphs = normalizedValue.split("\n");
  const lines: string[] = [];

  paragraphs.forEach((paragraph) => {
    lines.push(...wrapParagraph(paragraph, maxWidth, fontSize, fontWeight));
  });

  return lines.length ? lines : [""];
}

function measureTextBlockHeight(lineCount: number, fontSize: number) {
  if (lineCount <= 0) {
    return 0;
  }

  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  return (
    fontSize +
    Math.max(lineCount - 1, 0) * lineHeight +
    fontSize * DESCENDER_RATIO
  );
}

function fitFieldTextToBounds(node: TicketTemplateFieldNode, value: string) {
  const width = Math.max(Math.round(node.width ?? 420), 1);
  const height = Math.max(
    Math.round(node.height ?? Math.ceil((node.fontSize ?? 64) * 1.4)),
    1,
  );
  const initialFontSize = Math.max(
    Math.round(node.fontSize ?? 64),
    MIN_FIELD_FONT_SIZE,
  );
  const fontWeight = node.fontWeight ?? 700;

  for (
    let fontSize = initialFontSize;
    fontSize >= MIN_FIELD_FONT_SIZE;
    fontSize -= 1
  ) {
    const lines = wrapTextLines(value, width, fontSize, fontWeight);
    if (measureTextBlockHeight(lines.length, fontSize) <= height) {
      return {
        width,
        height,
        fontSize,
        lines,
      };
    }
  }

  return {
    width,
    height,
    fontSize: MIN_FIELD_FONT_SIZE,
    lines: wrapTextLines(value, width, MIN_FIELD_FONT_SIZE, fontWeight),
  };
}

function buildFieldOverlay(node: TicketTemplateFieldNode, value: string) {
  const fittedText = fitFieldTextToBounds(node, value);
  const width = fittedText.width;
  const { anchor, x } = resolveTextAnchor({
    ...node,
    width,
  });
  const fontSize = fittedText.fontSize;
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  const opacity = node.opacity ?? 1;
  const fill = node.fill ?? "#111827";
  const fontFamily = resolveTicketRenderFontFamily(node.fontFamily ?? "Merriweather");
  const fontWeight = node.fontWeight ?? 700;
  const rotation =
    typeof node.rotation === "number" && Number.isFinite(node.rotation)
      ? node.rotation
      : 0;
  const xPosition = Math.round(node.x);
  const yPosition = Math.round(node.y);
  const groupTransform =
    rotation === 0
      ? `translate(${xPosition} ${yPosition})`
      : `translate(${xPosition} ${yPosition}) rotate(${rotation})`;
  const textSpans = fittedText.lines
    .map((line, index) => {
      const lineY = fontSize + index * lineHeight;
      const lineText = line.length > 0 ? escapeXml(line) : "&#160;";
      return `<tspan x="${x}" y="${lineY}">${lineText}</tspan>`;
    })
    .join("");

  return Buffer.from(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${TICKET_TEMPLATE_CANVAS_PX_WIDTH}" height="${TICKET_TEMPLATE_CANVAS_PX_HEIGHT}" viewBox="0 0 ${TICKET_TEMPLATE_CANVAS_PX_WIDTH} ${TICKET_TEMPLATE_CANVAS_PX_HEIGHT}">`,
      `<g transform="${groupTransform}">`,
      `<text font-size="${fontSize}" font-family="${escapeXml(fontFamily)}" font-weight="${fontWeight}" fill="${escapeXml(fill)}" fill-opacity="${opacity}" text-anchor="${anchor}">${textSpans}</text>`,
      "</g>",
      "</svg>",
    ].join(""),
    "utf8",
  );
}

export async function renderTicketPngInline({
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

      overlays.push({
        input: buildFieldOverlay(node, value),
        left: 0,
        top: 0,
      });
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
