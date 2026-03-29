import { readFile } from "node:fs/promises";

import { buildFontFaceRule, getLocalTicketFontSource } from "./fontCatalog.ts";

const embeddedFontCssCache = new Map<string, Promise<string>>();

async function readEmbeddedFontData(fileName: string) {
  const fontUrl = new URL(`../../public/fonts/tickets/${fileName}`, import.meta.url);
  const fontBuffer = await readFile(fontUrl);
  return `data:font/woff2;base64,${fontBuffer.toString("base64")}`;
}

export function buildEmbeddedTicketFontFaceCss(family: string) {
  const trimmedFamily = family.trim();
  const cached = embeddedFontCssCache.get(trimmedFamily);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const source = getLocalTicketFontSource(trimmedFamily);
    if (!source?.files) {
      return "";
    }

    const [regularSrc, boldSrc] = await Promise.all([
      readEmbeddedFontData(source.files[400]),
      readEmbeddedFontData(source.files[700]),
    ]);

    return [
      buildFontFaceRule(source.family, regularSrc, 400),
      buildFontFaceRule(source.family, boldSrc, 700),
    ].join("\n");
  })();

  embeddedFontCssCache.set(trimmedFamily, promise);
  return promise;
}
