import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeTemplateVersion } from "@/lib/tickets/templateSchema";

export const runtime = "nodejs";
// Keep compute close to Neon (Singapore) to reduce DB latency on Vercel
export const preferredRegion = "sin1";

type ShowTicketDesign = {
  ticketTemplateId: string;
  ticketTemplateVersionId: string;
  templateName: string;
  versionNumber: number;
  previewUrl: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ showId: string }> },
) {
  try {
    const { showId } = await params;

    const show = await prisma.show.findUnique({
      where: { show_id: showId },
      select: {
        show_id: true,
        ticket_template_id: true,
      },
    });

    if (!show) {
      return NextResponse.json({ error: "Show not found." }, { status: 404 });
    }

    let linkedTemplateIds: string[] = [];
    try {
      const rows = await prisma.$queryRaw<Array<{ ticket_template_id: string }>>(
        Prisma.sql`
          SELECT "ticket_template_id"
          FROM "ShowTicketTemplate"
          WHERE "show_id" = ${showId}
          ORDER BY "createdAt" ASC
        `,
      );
      linkedTemplateIds = rows.map((row) => row.ticket_template_id);
    } catch {
      linkedTemplateIds = [];
    }

    const orderedTemplateIds =
      linkedTemplateIds.length > 0
        ? linkedTemplateIds
        : show.ticket_template_id
          ? [show.ticket_template_id]
          : [];

    if (orderedTemplateIds.length === 0) {
      return NextResponse.json({ success: true, designs: [] });
    }

    const templates = await prisma.ticketTemplate.findMany({
      where: {
        ticket_template_id: { in: orderedTemplateIds },
      },
      select: {
        ticket_template_id: true,
        live_ticket_template_version_id: true,
        template_name: true,
        versions: {
          orderBy: { version_number: "desc" },
          select: {
            ticket_template_version_id: true,
            version_number: true,
            template_schema: true,
          },
        },
      },
    });

    const templateById = new Map(
      templates.map((template) => [template.ticket_template_id, template]),
    );

    const designs: ShowTicketDesign[] = [];

    for (const templateId of orderedTemplateIds) {
      const template = templateById.get(templateId);
      if (!template) continue;
      const latestVersion = template.versions[0] ?? null;
      const liveVersion =
        template.versions.find(
          (version) =>
            version.ticket_template_version_id ===
            template.live_ticket_template_version_id,
        ) ?? latestVersion;
      if (!liveVersion) continue;

      const normalizedVersion = normalizeTemplateVersion(
        liveVersion.template_schema as Record<string, unknown> | null | undefined,
      );

      designs.push({
        ticketTemplateId: template.ticket_template_id,
        ticketTemplateVersionId: liveVersion.ticket_template_version_id,
        templateName: template.template_name,
        versionNumber: liveVersion.version_number,
        previewUrl: normalizedVersion.previewUrl ?? null,
      });
    }

    return NextResponse.json({
      success: true,
      designs,
    });
  } catch (error) {
    console.error("[shows/:showId/ticket-designs][GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load ticket designs." },
      { status: 500 },
    );
  }
}
