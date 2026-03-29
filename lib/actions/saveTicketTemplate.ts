"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { getCurrentAdminContext } from "@/lib/auth/adminContext";
import { saveTicketTemplateVersionRecord } from "@/lib/db/TicketTemplates";
import type { TicketTemplateVersion } from "@/lib/tickets/types";

type SaveTicketTemplatePayload = {
  ticketTemplateId?: string;
  ticketTemplateVersionId?: string;
  teamId?: string;
  templateName: string;
  templateSchema: TicketTemplateVersion;
};

export async function saveTicketTemplateAction(payload: SaveTicketTemplatePayload) {
  try {
    const adminContext = await getCurrentAdminContext();

    const scopedTeamId = adminContext.isSuperadmin
      ? payload.teamId?.trim() || adminContext.teamId
      : adminContext.teamId;

    if (!scopedTeamId) {
      throw new Error("A team is required to save a ticket template.");
    }

    const saved = await saveTicketTemplateVersionRecord({
      ticketTemplateId: payload.ticketTemplateId?.trim() || undefined,
      ticketTemplateVersionId: payload.ticketTemplateVersionId?.trim() || undefined,
      teamId: scopedTeamId,
      templateName: payload.templateName,
      templateSchema: payload.templateSchema,
    });

    revalidatePath("/admin/ticket-templates");
    revalidatePath("/ticket-builder");

    return {
      success: true,
      ticketTemplateId: saved.template.ticket_template_id,
      ticketTemplateVersionId: saved.version.ticket_template_version_id,
      versionNumber: saved.version.version_number,
    };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "A ticket template with this name already exists for the selected team.",
      };
    }

    console.error("Error in saveTicketTemplateAction:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to save ticket template.",
    };
  }
}
