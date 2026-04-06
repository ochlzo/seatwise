import { NextResponse } from "next/server";

import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { getTicketTemplateById } from "@/lib/db/TicketTemplates";
import { buildTicketPdf } from "@/lib/tickets/buildTicketPdf";
import { renderTicketPng } from "@/lib/tickets/renderTicketPng";
import { normalizeTemplateVersion } from "@/lib/tickets/templateSchema";
import { formatTicketShowDate, formatTicketShowTime } from "@/lib/tickets/ticketDateTime";

export const runtime = "nodejs";
export const preferredRegion = "sin1";

type TestOutputBody = {
  ticketTemplateVersionId?: string;
  showName?: string;
  venue?: string;
  showDate?: string;
  showTime?: string;
  seatCategory?: string;
  price?: string;
  seatNumber?: string;
  customerName?: string;
  referenceNumber?: string;
};

function sanitizeFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

function buildFieldValues(body: TestOutputBody) {
  const showDate = body.showDate?.trim() ?? "";
  const showTime = body.showTime?.trim() ?? "";
  return {
    show_name: body.showName?.trim() ?? "",
    venue: body.venue?.trim() ?? "",
    show_date: showDate ? formatTicketShowDate(showDate) : "",
    show_time: showTime ? formatTicketShowTime(showTime) : "",
    seat_category: body.seatCategory?.trim() ?? "",
    price: body.price?.trim() ?? "",
    seat: body.seatNumber?.trim() ?? "",
    reservation_number: body.referenceNumber?.trim() ?? "",
    customer_name: body.customerName?.trim() ?? "",
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketTemplateId: string }> },
) {
  try {
    const adminContext = await getCurrentAdminContext();
    const { ticketTemplateId } = await params;
    const body = (await request.json()) as TestOutputBody;
    const template = await getTicketTemplateById(ticketTemplateId, {
      teamId: adminContext.teamId,
      isSuperadmin: adminContext.isSuperadmin,
    });

    if (!template) {
      return NextResponse.json({ error: "Ticket template not found." }, { status: 404 });
    }

    const version =
      template.versions.find(
        (candidate) => candidate.ticket_template_version_id === body.ticketTemplateVersionId,
      ) ?? template.latestVersion ?? template.versions[0] ?? null;

    if (!version) {
      return NextResponse.json(
        { error: "No ticket template version is available." },
        { status: 404 },
      );
    }

    const ticketPng = await renderTicketPng({
      template: normalizeTemplateVersion(version.template_schema),
      fields: buildFieldValues(body),
      qrValue: `test-output:${version.ticket_template_version_id}:${body.referenceNumber ?? ""}`,
    });
    const ticketPdf = await buildTicketPdf({ ticketPng });
    const fileName = `Test Ticket Output - ${sanitizeFileName(template.template_name) || "ticket-template"}.pdf`;

    return new NextResponse(ticketPdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[ticket-templates/:ticketTemplateId/test-output][POST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate test output." },
      { status: 500 },
    );
  }
}
