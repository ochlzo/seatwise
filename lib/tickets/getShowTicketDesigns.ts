import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeTemplateVersion } from "@/lib/tickets/templateSchema";

export type ShowTicketDesign = {
  ticketTemplateId: string;
  ticketTemplateVersionId: string;
  templateName: string;
  versionNumber: number;
  previewUrl: string | null;
};

export async function getShowTicketDesigns(showId: string): Promise<ShowTicketDesign[]> {
  const show = await prisma.show.findUnique({
    where: { show_id: showId },
    select: {
      show_id: true,
      ticket_template_id: true,
    },
  });

  if (!show) {
    return [];
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
    return [];
  }

  const templates = await prisma.ticketTemplate.findMany({
    where: {
      ticket_template_id: { in: orderedTemplateIds },
    },
    select: {
      ticket_template_id: true,
      template_name: true,
      live_ticket_template_version_id: true,
    },
  });

  const templateById = new Map(
    templates.map((template) => [template.ticket_template_id, template]),
  );

  const liveVersionIds = templates
    .map((template) => template.live_ticket_template_version_id)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const liveVersions = liveVersionIds.length
    ? await prisma.ticketTemplateVersion.findMany({
        where: {
          ticket_template_version_id: { in: liveVersionIds },
        },
        select: {
          ticket_template_version_id: true,
          ticket_template_id: true,
          version_number: true,
          template_schema: true,
        },
      })
    : [];

  const liveVersionByTemplateId = new Map(
    liveVersions.map((version) => [version.ticket_template_id, version]),
  );

  const fallbackTemplateIds = orderedTemplateIds.filter(
    (templateId) => !liveVersionByTemplateId.has(templateId),
  );

  const fallbackVersions = fallbackTemplateIds.length
    ? await prisma.ticketTemplateVersion.findMany({
        where: {
          ticket_template_id: { in: fallbackTemplateIds },
        },
        orderBy: [{ ticket_template_id: "asc" }, { version_number: "desc" }],
        select: {
          ticket_template_version_id: true,
          ticket_template_id: true,
          version_number: true,
          template_schema: true,
        },
      })
    : [];

  const fallbackVersionByTemplateId = new Map<string, (typeof fallbackVersions)[number]>();
  for (const version of fallbackVersions) {
    if (!fallbackVersionByTemplateId.has(version.ticket_template_id)) {
      fallbackVersionByTemplateId.set(version.ticket_template_id, version);
    }
  }

  const designs: ShowTicketDesign[] = [];

  for (const templateId of orderedTemplateIds) {
    const template = templateById.get(templateId);
    if (!template) continue;

    const version =
      liveVersionByTemplateId.get(templateId) ?? fallbackVersionByTemplateId.get(templateId);
    if (!version) continue;

    const normalizedVersion = normalizeTemplateVersion(
      version.template_schema as Record<string, unknown> | null | undefined,
    );

    designs.push({
      ticketTemplateId: template.ticket_template_id,
      ticketTemplateVersionId: version.ticket_template_version_id,
      templateName: template.template_name,
      versionNumber: version.version_number,
      previewUrl: normalizedVersion.previewUrl ?? null,
    });
  }

  return designs;
}
