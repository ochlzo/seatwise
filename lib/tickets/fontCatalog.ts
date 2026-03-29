import { readFile } from "node:fs/promises";

export type TicketTemplateFontOption = {
  label: string;
  family: string;
};

type TicketRenderFontCategory = "sans" | "serif";

type LocalTicketFontSource = {
  family: string;
  category: TicketRenderFontCategory;
  files?: {
    400: string;
    700: string;
  };
};

const LOCAL_TICKET_FONT_SOURCES: LocalTicketFontSource[] = [
  { family: "Georgia", category: "serif" },
  {
    family: "Inter",
    category: "sans",
    files: { 400: "inter-400.woff2", 700: "inter-700.woff2" },
  },
  {
    family: "Poppins",
    category: "sans",
    files: { 400: "poppins-400.woff2", 700: "poppins-700.woff2" },
  },
  {
    family: "Montserrat",
    category: "sans",
    files: { 400: "montserrat-400.woff2", 700: "montserrat-700.woff2" },
  },
  {
    family: "Lato",
    category: "sans",
    files: { 400: "lato-400.woff2", 700: "lato-700.woff2" },
  },
  {
    family: "Open Sans",
    category: "sans",
    files: { 400: "open-sans-400.woff2", 700: "open-sans-700.woff2" },
  },
  {
    family: "Roboto",
    category: "sans",
    files: { 400: "roboto-400.woff2", 700: "roboto-700.woff2" },
  },
  {
    family: "Source Sans 3",
    category: "sans",
    files: { 400: "source-sans-3-400.woff2", 700: "source-sans-3-700.woff2" },
  },
  {
    family: "Merriweather",
    category: "serif",
    files: { 400: "merriweather-400.woff2", 700: "merriweather-700.woff2" },
  },
  {
    family: "Playfair Display",
    category: "serif",
    files: {
      400: "playfair-display-400.woff2",
      700: "playfair-display-700.woff2",
    },
  },
  {
    family: "Bebas Neue",
    category: "sans",
    files: { 400: "bebas-neue-400.woff2", 700: "bebas-neue-700.woff2" },
  },
  {
    family: "Oswald",
    category: "sans",
    files: { 400: "oswald-400.woff2", 700: "oswald-700.woff2" },
  },
  {
    family: "Raleway",
    category: "sans",
    files: { 400: "raleway-400.woff2", 700: "raleway-700.woff2" },
  },
  {
    family: "Nunito",
    category: "sans",
    files: { 400: "nunito-400.woff2", 700: "nunito-700.woff2" },
  },
  {
    family: "Rubik",
    category: "sans",
    files: { 400: "rubik-400.woff2", 700: "rubik-700.woff2" },
  },
  {
    family: "DM Sans",
    category: "sans",
    files: { 400: "dm-sans-400.woff2", 700: "dm-sans-700.woff2" },
  },
  {
    family: "Archivo",
    category: "sans",
    files: { 400: "archivo-400.woff2", 700: "archivo-700.woff2" },
  },
  {
    family: "Manrope",
    category: "sans",
    files: { 400: "manrope-400.woff2", 700: "manrope-700.woff2" },
  },
  {
    family: "Space Grotesk",
    category: "sans",
    files: { 400: "space-grotesk-400.woff2", 700: "space-grotesk-700.woff2" },
  },
  {
    family: "Lora",
    category: "serif",
    files: { 400: "lora-400.woff2", 700: "lora-700.woff2" },
  },
];

export const TICKET_TEMPLATE_FONT_OPTIONS: TicketTemplateFontOption[] =
  LOCAL_TICKET_FONT_SOURCES.map(({ family }) => ({
    label: family,
    family,
  }));

const FONT_OPTIONS_BY_FAMILY = new Map(
  TICKET_TEMPLATE_FONT_OPTIONS.map((option) => [option.family, option]),
);

const LOCAL_FONT_SOURCE_BY_FAMILY = new Map(
  LOCAL_TICKET_FONT_SOURCES.map((source) => [source.family, source]),
);

const embeddedFontCssCache = new Map<string, Promise<string>>();

function quoteFontFamily(family: string) {
  return family.includes(" ") ? `"${family}"` : family;
}

function getLocalTicketFontSource(family: string) {
  return LOCAL_FONT_SOURCE_BY_FAMILY.get(family);
}

function buildFontFaceRule(
  family: string,
  src: string,
  weight: 400 | 700,
) {
  return [
    "@font-face {",
    `font-family: ${quoteFontFamily(family)};`,
    `src: url("${src}") format("woff2");`,
    `font-weight: ${weight};`,
    "font-style: normal;",
    "font-display: swap;",
    "}",
  ].join("");
}

function getFallbackStack(category: TicketRenderFontCategory) {
  if (category === "serif") {
    return '"DejaVu Serif", "Times New Roman", serif';
  }

  return '"DejaVu Sans", Arial, Helvetica, sans-serif';
}

export function resolveTicketRenderFontFamily(family: string) {
  const trimmedFamily = family.trim();
  const source = getLocalTicketFontSource(trimmedFamily);
  const category = source?.category ?? "sans";

  return `${quoteFontFamily(trimmedFamily)}, ${getFallbackStack(category)}`;
}

export function buildTicketTemplateFontFaceCss(family: string) {
  const source = getLocalTicketFontSource(family.trim());
  if (!source?.files) {
    return "";
  }

  return [
    buildFontFaceRule(source.family, `/fonts/tickets/${source.files[400]}`, 400),
    buildFontFaceRule(source.family, `/fonts/tickets/${source.files[700]}`, 700),
  ].join("\n");
}

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

export function getTicketTemplateFontOptionByFamily(family: string) {
  return FONT_OPTIONS_BY_FAMILY.get(family);
}
