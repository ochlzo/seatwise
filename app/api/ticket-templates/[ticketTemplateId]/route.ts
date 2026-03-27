import { NextResponse } from "next/server";

import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { getTicketTemplateById } from "@/lib/db/TicketTemplates";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketTemplateId: string }> },
) {
  try {
    const adminContext = await getCurrentAdminContext();
    const { ticketTemplateId } = await params;

    const ticketTemplate = await getTicketTemplateById(ticketTemplateId, {
      teamId: adminContext.teamId,
      isSuperadmin: adminContext.isSuperadmin,
    });

    if (!ticketTemplate) {
      return NextResponse.json({ error: "Ticket template not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ticketTemplate,
    });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[ticket-templates/:ticketTemplateId][GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticket template." },
      { status: 500 },
    );
  }
}
