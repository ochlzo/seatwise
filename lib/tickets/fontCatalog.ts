export type TicketTemplateFontOption = {
  label: string;
  family: string;
  cssUrl?: string;
};

function buildGoogleFontCssUrl(family: string) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;700&display=swap`;
}

export const TICKET_TEMPLATE_FONT_OPTIONS: TicketTemplateFontOption[] = [
  { label: "Georgia", family: "Georgia" },
  { label: "Inter", family: "Inter", cssUrl: buildGoogleFontCssUrl("Inter") },
  { label: "Poppins", family: "Poppins", cssUrl: buildGoogleFontCssUrl("Poppins") },
  { label: "Montserrat", family: "Montserrat", cssUrl: buildGoogleFontCssUrl("Montserrat") },
  { label: "Lato", family: "Lato", cssUrl: buildGoogleFontCssUrl("Lato") },
  { label: "Open Sans", family: "Open Sans", cssUrl: buildGoogleFontCssUrl("Open Sans") },
  { label: "Roboto", family: "Roboto", cssUrl: buildGoogleFontCssUrl("Roboto") },
  { label: "Source Sans 3", family: "Source Sans 3", cssUrl: buildGoogleFontCssUrl("Source Sans 3") },
  { label: "Merriweather", family: "Merriweather", cssUrl: buildGoogleFontCssUrl("Merriweather") },
  { label: "Playfair Display", family: "Playfair Display", cssUrl: buildGoogleFontCssUrl("Playfair Display") },
  { label: "Bebas Neue", family: "Bebas Neue", cssUrl: buildGoogleFontCssUrl("Bebas Neue") },
  { label: "Oswald", family: "Oswald", cssUrl: buildGoogleFontCssUrl("Oswald") },
  { label: "Raleway", family: "Raleway", cssUrl: buildGoogleFontCssUrl("Raleway") },
  { label: "Nunito", family: "Nunito", cssUrl: buildGoogleFontCssUrl("Nunito") },
  { label: "Rubik", family: "Rubik", cssUrl: buildGoogleFontCssUrl("Rubik") },
  { label: "DM Sans", family: "DM Sans", cssUrl: buildGoogleFontCssUrl("DM Sans") },
  { label: "Archivo", family: "Archivo", cssUrl: buildGoogleFontCssUrl("Archivo") },
  { label: "Manrope", family: "Manrope", cssUrl: buildGoogleFontCssUrl("Manrope") },
  { label: "Space Grotesk", family: "Space Grotesk", cssUrl: buildGoogleFontCssUrl("Space Grotesk") },
  { label: "Lora", family: "Lora", cssUrl: buildGoogleFontCssUrl("Lora") },
];

const FONT_OPTIONS_BY_FAMILY = new Map(
  TICKET_TEMPLATE_FONT_OPTIONS.map((option) => [option.family, option]),
);

export function getTicketTemplateFontOptionByFamily(family: string) {
  return FONT_OPTIONS_BY_FAMILY.get(family);
}
