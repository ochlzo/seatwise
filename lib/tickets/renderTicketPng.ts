import { Buffer } from "node:buffer";

import QRCode from "qrcode";
import { getTicketFontConfigPath } from "./fontConfig.server.ts";
import type { TicketTemplateVersion } from "./types.ts";

type RenderTicketPngParams = {
  template: TicketTemplateVersion;
  fields: Partial<Record<string, string>>;
  qrValue: string;
};

async function buildQrDataUrl(qrValue: string, size: number) {
  return QRCode.toDataURL(qrValue, {
    width: size,
    margin: 0,
    color: {
      dark: "#000000ff",
      light: "#ffffffff",
    },
  });
}

export async function renderTicketPng(input: RenderTicketPngParams) {
  const fontConfigPath = await getTicketFontConfigPath();
  process.env.FONTCONFIG_FILE = fontConfigPath;

  const qrNodeSizes = Array.from(
    new Set(
      input.template.nodes
        .filter((node): node is Extract<typeof node, { kind: "qr" }> => node.kind === "qr")
        .map((node) => Math.max(Math.round(node.size), 1)),
    ),
  );
  const qrDataUrls = Object.fromEntries(
    await Promise.all(
      qrNodeSizes.map(async (size) => [String(size), await buildQrDataUrl(input.qrValue, size)] as const),
    ),
  );

  const { renderTicketPngRuntime } = await import("./renderTicketPng.runtime.mjs");
  const ticketPng = await renderTicketPngRuntime({
    ...input,
    qrDataUrls,
  });

  return Buffer.from(ticketPng);
}
