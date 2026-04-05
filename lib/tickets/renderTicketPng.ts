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
  const qrDataUrl = await buildQrDataUrl(input.qrValue, 1024);

  const { renderTicketPngRuntime } = await import("./renderTicketPng.runtime.mjs");
  const ticketPng = await renderTicketPngRuntime({
    ...input,
    qrDataUrl,
  });

  return Buffer.from(ticketPng);
}
