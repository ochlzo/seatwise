import { PDFDocument } from "pdf-lib";

import {
  TICKET_TEMPLATE_CANVAS_INCH_HEIGHT,
  TICKET_TEMPLATE_CANVAS_INCH_WIDTH,
} from "./constants.ts";

type BuildTicketPdfParams = {
  ticketPng: Uint8Array;
};

const PDF_POINTS_PER_INCH = 72;

export async function buildTicketPdf({ ticketPng }: BuildTicketPdfParams) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([
    TICKET_TEMPLATE_CANVAS_INCH_WIDTH * PDF_POINTS_PER_INCH,
    TICKET_TEMPLATE_CANVAS_INCH_HEIGHT * PDF_POINTS_PER_INCH,
  ]);
  const embeddedPng = await pdf.embedPng(ticketPng);

  page.drawImage(embeddedPng, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });

  return pdf.save();
}
