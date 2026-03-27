import { prisma } from "../prisma.ts";
import {
  normalizeTemplateVersion,
} from "../tickets/templateSchema.ts";
import type { TicketTemplateVersion as TicketTemplateSchema } from "../tickets/types.ts";

export type TicketTemplateAdminScope = {
  teamId: string | null;
  isSuperadmin: boolean;
};

type StoredTicketTemplateVersion = {
  ticket_template_version_id: string;
  ticket_template_id: string;
  version_number: number;
  template_schema: unknown;
  createdAt: Date;
};

type StoredTicketTemplate = {
  ticket_template_id: string;
  team_id: string;
  template_name: string;
  createdAt: Date;
  updatedAt: Date;
  versions: StoredTicketTemplateVersion[];
};

type TicketTemplatePersistenceDb = {
  ticketTemplate: {
    create(args: {
      data: {
        team_id: string;
        template_name: string;
      };
    }): Promise<Omit<StoredTicketTemplate, "versions">>;
    update(args: {
      where: { ticket_template_id: string };
      data: {
        template_name: string;
        updatedAt: Date;
      };
    }): Promise<Omit<StoredTicketTemplate, "versions">>;
    findFirst(args: {
      where: {
        ticket_template_id: string;
        team_id?: string;
      };
      include: {
        versions: {
          orderBy: { version_number: "asc" | "desc" };
        };
      };
    }): Promise<StoredTicketTemplate | null>;
    findMany(args: {
      where?: {
        team_id?: string;
        template_name?: {
          contains: string;
          mode: "insensitive";
        };
      };
      include: {
        versions: {
          orderBy: { version_number: "asc" | "desc" };
        };
      };
      orderBy: {
        updatedAt: "asc" | "desc";
      };
    }): Promise<StoredTicketTemplate[]>;
  };
  ticketTemplateVersion: {
    create(args: {
      data: {
        ticket_template_id: string;
        version_number: number;
        template_schema: TicketTemplateSchema;
      };
    }): Promise<StoredTicketTemplateVersion>;
  };
  $transaction<T>(callback: (tx: TicketTemplatePersistenceDb) => Promise<T>): Promise<T>;
};

export type TicketTemplateVersionSummary = {
  ticket_template_version_id: string;
  ticket_template_id: string;
  version_number: number;
  template_schema: TicketTemplateSchema;
  createdAt: Date;
};

export type TicketTemplateListItem = {
  ticket_template_id: string;
  team_id: string;
  template_name: string;
  createdAt: Date;
  updatedAt: Date;
  latestVersionNumber: number | null;
  latestVersionCreatedAt: Date | null;
  versionCount: number;
};

export type TicketTemplateDetail = TicketTemplateListItem & {
  latestVersion: TicketTemplateVersionSummary | null;
  versions: TicketTemplateVersionSummary[];
};

type SaveTicketTemplateVersionInput = {
  ticketTemplateId?: string;
  teamId: string;
  templateName: string;
  templateSchema: TicketTemplateSchema;
};

type SaveTicketTemplateVersionResult = {
  template: Omit<StoredTicketTemplate, "versions">;
  version: TicketTemplateVersionSummary;
};

const DEFAULT_DB = prisma as unknown as TicketTemplatePersistenceDb;

function mapVersion(version: StoredTicketTemplateVersion): TicketTemplateVersionSummary {
  return {
    ticket_template_version_id: version.ticket_template_version_id,
    ticket_template_id: version.ticket_template_id,
    version_number: version.version_number,
    template_schema: normalizeTemplateVersion(
      version.template_schema as Partial<TicketTemplateSchema> | null | undefined,
    ),
    createdAt: version.createdAt,
  };
}

function mapTemplateDetail(template: StoredTicketTemplate): TicketTemplateDetail {
  const versions = template.versions.map(mapVersion);
  const latestVersion = versions[0] ?? null;

  return {
    ticket_template_id: template.ticket_template_id,
    team_id: template.team_id,
    template_name: template.template_name,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    latestVersionNumber: latestVersion?.version_number ?? null,
    latestVersionCreatedAt: latestVersion?.createdAt ?? null,
    versionCount: versions.length,
    latestVersion,
    versions,
  };
}

export async function getTicketTemplates(
  params: {
    adminScope: TicketTemplateAdminScope;
    query?: string;
    sort?: string;
    teamId?: string;
  },
  db: TicketTemplatePersistenceDb = DEFAULT_DB,
): Promise<TicketTemplateListItem[]> {
  const where: {
    team_id?: string;
    template_name?: {
      contains: string;
      mode: "insensitive";
    };
  } = {};

  if (!params.adminScope.isSuperadmin) {
    if (!params.adminScope.teamId) {
      return [];
    }
    where.team_id = params.adminScope.teamId;
  } else if (params.teamId?.trim()) {
    where.team_id = params.teamId.trim();
  }

  const query = params.query?.trim();
  if (query) {
    where.template_name = {
      contains: query,
      mode: "insensitive",
    };
  }

  const templates = await db.ticketTemplate.findMany({
    where,
    include: {
      versions: {
        orderBy: { version_number: "desc" },
      },
    },
    orderBy: {
      updatedAt: params.sort === "oldest" ? "asc" : "desc",
    },
  });

  return templates.map((template) => {
    const detail = mapTemplateDetail(template);
    return {
      ticket_template_id: detail.ticket_template_id,
      team_id: detail.team_id,
      template_name: detail.template_name,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      latestVersionNumber: detail.latestVersionNumber,
      latestVersionCreatedAt: detail.latestVersionCreatedAt,
      versionCount: detail.versionCount,
    };
  });
}

export async function getTicketTemplateById(
  ticketTemplateId: string,
  adminScope: TicketTemplateAdminScope,
  db: TicketTemplatePersistenceDb = DEFAULT_DB,
): Promise<TicketTemplateDetail | null> {
  const trimmedId = ticketTemplateId.trim();
  if (!trimmedId) {
    return null;
  }

  if (!adminScope.isSuperadmin && !adminScope.teamId) {
    return null;
  }

  const template = await db.ticketTemplate.findFirst({
    where: {
      ticket_template_id: trimmedId,
      ...(adminScope.isSuperadmin ? {} : { team_id: adminScope.teamId ?? undefined }),
    },
    include: {
      versions: {
        orderBy: { version_number: "desc" },
      },
    },
  });

  return template ? mapTemplateDetail(template) : null;
}

export async function saveTicketTemplateVersionRecord(
  input: SaveTicketTemplateVersionInput,
  db: TicketTemplatePersistenceDb = DEFAULT_DB,
): Promise<SaveTicketTemplateVersionResult> {
  const templateName = input.templateName.trim();
  if (!templateName) {
    throw new Error("Template name is required.");
  }

  const teamId = input.teamId.trim();
  if (!teamId) {
    throw new Error("Team is required.");
  }

  const normalizedTemplateSchema = normalizeTemplateVersion(input.templateSchema);

  return db.$transaction(async (tx) => {
    let template: Omit<StoredTicketTemplate, "versions">;
    let nextVersionNumber = 1;

    if (input.ticketTemplateId?.trim()) {
      const existingTemplate = await tx.ticketTemplate.findFirst({
        where: {
          ticket_template_id: input.ticketTemplateId.trim(),
          team_id: teamId,
        },
        include: {
          versions: {
            orderBy: { version_number: "desc" },
          },
        },
      });

      if (!existingTemplate) {
        throw new Error("Ticket template not found.");
      }

      nextVersionNumber = (existingTemplate.versions[0]?.version_number ?? 0) + 1;
      template = await tx.ticketTemplate.update({
        where: {
          ticket_template_id: existingTemplate.ticket_template_id,
        },
        data: {
          template_name: templateName,
          updatedAt: new Date(),
        },
      });
    } else {
      template = await tx.ticketTemplate.create({
        data: {
          team_id: teamId,
          template_name: templateName,
        },
      });
    }

    const version = mapVersion(
      await tx.ticketTemplateVersion.create({
        data: {
          ticket_template_id: template.ticket_template_id,
          version_number: nextVersionNumber,
          template_schema: normalizedTemplateSchema,
        },
      }),
    );

    return {
      template,
      version,
    };
  });
}
