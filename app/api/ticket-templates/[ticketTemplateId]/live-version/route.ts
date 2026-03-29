import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { AdminContextError, getCurrentAdminContext } from "@/lib/auth/adminContext";
import { setTicketTemplateLiveVersionRecord } from "@/lib/db/TicketTemplates";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

type LiveVersionBody = {
  ticketTemplateVersionId?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticketTemplateId: string }> },
) {
  try {
    const adminContext = await getCurrentAdminContext();
    const { ticketTemplateId } = await params;
    const body = (await request.json()) as LiveVersionBody;
    const ticketTemplateVersionId =
      typeof body.ticketTemplateVersionId === "string"
        ? body.ticketTemplateVersionId.trim()
        : "";

    if (!ticketTemplateVersionId) {
      return NextResponse.json(
        { error: "Ticket template version is required." },
        { status: 400 },
      );
    }

    const updatedTemplate = await setTicketTemplateLiveVersionRecord({
      ticketTemplateId,
      ticketTemplateVersionId,
      adminScope: {
        teamId: adminContext.teamId,
        isSuperadmin: adminContext.isSuperadmin,
      },
    });

    return NextResponse.json({
      success: true,
      ticketTemplate: updatedTemplate,
    });
  } catch (error) {
    if (error instanceof AdminContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (
      error instanceof Prisma.PrismaClientValidationError &&
      error.message.includes("live_ticket_template_version_id")
    ) {
      return NextResponse.json(
        {
          error:
            "Ticket template live-version schema is out of sync. Run `npx prisma migrate dev` and `npx prisma generate`, then restart the dev server.",
        },
        { status: 500 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to update live version.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
