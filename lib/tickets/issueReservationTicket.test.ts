import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyTicketTemplate,
  normalizeTemplateVersion,
} from "./templateSchema.ts";
import {
  getTicketTemplateById,
  saveTicketTemplateVersionRecord,
} from "../db/TicketTemplates.ts";

type StoredTemplateVersion = {
  ticket_template_version_id: string;
  ticket_template_id: string;
  version_number: number;
  template_schema: ReturnType<typeof createEmptyTicketTemplate>;
  createdAt: Date;
};

type StoredTemplate = {
  ticket_template_id: string;
  team_id: string;
  template_name: string;
  createdAt: Date;
  updatedAt: Date;
  versions: StoredTemplateVersion[];
};

function createMemoryTicketTemplateDb() {
  const templates: StoredTemplate[] = [];
  let templateCounter = 0;
  let versionCounter = 0;

  const findTemplateById = (ticketTemplateId: string) =>
    templates.find((template) => template.ticket_template_id === ticketTemplateId) ?? null;

  return {
    ticketTemplate: {
      async create(args: {
        data: {
          team_id: string;
          template_name: string;
        };
      }) {
        const createdAt = new Date(`2026-03-27T00:00:0${templateCounter}Z`);
        const template: StoredTemplate = {
          ticket_template_id: `ticket-template-${++templateCounter}`,
          team_id: args.data.team_id,
          template_name: args.data.template_name,
          createdAt,
          updatedAt: createdAt,
          versions: [],
        };
        templates.push(template);
        return {
          ticket_template_id: template.ticket_template_id,
          team_id: template.team_id,
          template_name: template.template_name,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        };
      },
      async update(args: {
        where: { ticket_template_id: string };
        data: { template_name: string; updatedAt: Date };
      }) {
        const template = findTemplateById(args.where.ticket_template_id);
        if (!template) {
          throw new Error("Template not found");
        }
        template.template_name = args.data.template_name;
        template.updatedAt = args.data.updatedAt;
        return {
          ticket_template_id: template.ticket_template_id,
          team_id: template.team_id,
          template_name: template.template_name,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
        };
      },
      async findFirst(args: {
        where: {
          ticket_template_id: string;
          team_id?: string;
        };
        include?: {
          versions?: {
            orderBy?: { version_number: "asc" | "desc" };
          };
        };
      }) {
        const template = templates.find((candidate) => {
          if (candidate.ticket_template_id !== args.where.ticket_template_id) {
            return false;
          }
          if (args.where.team_id && candidate.team_id !== args.where.team_id) {
            return false;
          }
          return true;
        });
        if (!template) {
          return null;
        }
        const versions = [...template.versions];
        if (args.include?.versions?.orderBy?.version_number === "desc") {
          versions.sort((left, right) => right.version_number - left.version_number);
        } else if (args.include?.versions?.orderBy?.version_number === "asc") {
          versions.sort((left, right) => left.version_number - right.version_number);
        }
        return {
          ticket_template_id: template.ticket_template_id,
          team_id: template.team_id,
          template_name: template.template_name,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          versions,
        };
      },
      async findMany(args: {
        where?: {
          team_id?: string;
        };
        include?: {
          versions?: {
            orderBy?: { version_number: "asc" | "desc" };
          };
        };
        orderBy?: {
          updatedAt: "asc" | "desc";
        };
      }) {
        let results = [...templates];
        if (args.where?.team_id) {
          results = results.filter((template) => template.team_id === args.where?.team_id);
        }
        if (args.orderBy?.updatedAt === "desc") {
          results.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
        } else if (args.orderBy?.updatedAt === "asc") {
          results.sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime());
        }
        return results.map((template) => {
          const versions = [...template.versions];
          if (args.include?.versions?.orderBy?.version_number === "desc") {
            versions.sort((left, right) => right.version_number - left.version_number);
          } else if (args.include?.versions?.orderBy?.version_number === "asc") {
            versions.sort((left, right) => left.version_number - right.version_number);
          }
          return {
            ticket_template_id: template.ticket_template_id,
            team_id: template.team_id,
            template_name: template.template_name,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            versions,
          };
        });
      },
    },
    ticketTemplateVersion: {
      async create(args: {
        data: {
          ticket_template_id: string;
          version_number: number;
          template_schema: ReturnType<typeof createEmptyTicketTemplate>;
        };
      }) {
        const template = findTemplateById(args.data.ticket_template_id);
        if (!template) {
          throw new Error("Template not found");
        }
        const version: StoredTemplateVersion = {
          ticket_template_version_id: `ticket-template-version-${++versionCounter}`,
          ticket_template_id: args.data.ticket_template_id,
          version_number: args.data.version_number,
          template_schema: args.data.template_schema,
          createdAt: new Date(`2026-03-27T00:01:0${versionCounter}Z`),
        };
        template.versions.push(version);
        template.updatedAt = version.createdAt;
        return version;
      },
    },
    async $transaction<T>(callback: (tx: ReturnType<typeof createMemoryTicketTemplateDb>) => Promise<T>) {
      return callback(this as ReturnType<typeof createMemoryTicketTemplateDb>);
    },
  };
}

test("saving a template creates version 1", async () => {
  const db = createMemoryTicketTemplateDb();

  const saved = await saveTicketTemplateVersionRecord(
    {
      teamId: "team-alpha",
      templateName: "Orchestra Ticket",
      templateSchema: createEmptyTicketTemplate(),
    },
    db,
  );

  assert.equal(saved.template.template_name, "Orchestra Ticket");
  assert.equal(saved.template.team_id, "team-alpha");
  assert.equal(saved.version.version_number, 1);
});

test("saving preserves uploaded asset refs and editor node properties in version JSON", async () => {
  const db = createMemoryTicketTemplateDb();
  const templateSchema = createEmptyTicketTemplate();

  templateSchema.nodes.push(
    {
      id: "asset-hero",
      kind: "asset",
      x: 0,
      y: 0,
      width: 720,
      height: 320,
      opacity: 0.65,
      assetKey: "seatwise/ticket_templates/draft-123/assets/hero",
      src: "https://res.cloudinary.com/seatwise/image/upload/v1/hero.png",
      name: "hero.png",
    },
    {
      id: "field-booking-ref",
      kind: "field",
      fieldKey: "reservation_number",
      label: "Booking Ref",
      x: 120,
      y: 160,
      width: 420,
      fontSize: 58,
      fontFamily: "Georgia",
      fontWeight: 700,
      fill: "#111827",
      align: "center",
      opacity: 0.9,
    },
    {
      id: "qr-1",
      kind: "qr",
      x: 2000,
      y: 110,
      size: 220,
      opacity: 0.8,
    },
  );

  const saved = await saveTicketTemplateVersionRecord(
    {
      teamId: "team-alpha",
      templateName: "VIP Ticket",
      templateSchema,
    },
    db,
  );

  assert.deepEqual(saved.version.template_schema.nodes, templateSchema.nodes);
});

test("saving again emits the next version number for the same template", async () => {
  const db = createMemoryTicketTemplateDb();

  const initial = await saveTicketTemplateVersionRecord(
    {
      teamId: "team-alpha",
      templateName: "Orchestra Ticket",
      templateSchema: createEmptyTicketTemplate(),
    },
    db,
  );

  const nextSchema = createEmptyTicketTemplate();
  nextSchema.nodes.push({
    id: "field-show-name",
    kind: "field",
    fieldKey: "show_name",
    x: 180,
    y: 240,
  });

  const savedAgain = await saveTicketTemplateVersionRecord(
    {
      ticketTemplateId: initial.template.ticket_template_id,
      teamId: "team-alpha",
      templateName: "Orchestra Ticket v2",
      templateSchema: nextSchema,
    },
    db,
  );

  assert.equal(savedAgain.template.ticket_template_id, initial.template.ticket_template_id);
  assert.equal(savedAgain.template.template_name, "Orchestra Ticket v2");
  assert.equal(savedAgain.version.version_number, 2);
  assert.deepEqual(
    savedAgain.version.template_schema.nodes,
    normalizeTemplateVersion(nextSchema).nodes,
  );
});

test("saving preserves asset z-order from the editor state", async () => {
  const db = createMemoryTicketTemplateDb();
  const templateSchema = createEmptyTicketTemplate();

  templateSchema.nodes.push(
    {
      id: "asset-background",
      kind: "asset",
      x: 0,
      y: 0,
      width: 2550,
      height: 825,
      assetKey: "seatwise/ticket_templates/draft-123/assets/background",
      src: "https://res.cloudinary.com/seatwise/image/upload/v1/background.png",
      name: "background.png",
      opacity: 1,
    },
    {
      id: "asset-logo",
      kind: "asset",
      x: 1840,
      y: 64,
      width: 240,
      height: 240,
      assetKey: "seatwise/ticket_templates/draft-123/assets/logo",
      src: "https://res.cloudinary.com/seatwise/image/upload/v1/logo.png",
      name: "logo.png",
      opacity: 1,
    },
    {
      id: "field-show-name",
      kind: "field",
      fieldKey: "show_name",
      label: "Show Name",
      x: 120,
      y: 120,
      width: 560,
      fontSize: 72,
      fontFamily: "Georgia",
      fontWeight: 700,
      fill: "#111827",
      align: "left",
      opacity: 1,
    },
  );

  const saved = await saveTicketTemplateVersionRecord(
    {
      teamId: "team-alpha",
      templateName: "Layered Ticket",
      templateSchema,
    },
    db,
  );

  assert.deepEqual(
    saved.version.template_schema.nodes.map((node) => node.id),
    ["asset-background", "asset-logo", "field-show-name"],
  );
});

test("loading a template returns the latest version plus historical versions", async () => {
  const db = createMemoryTicketTemplateDb();

  const initial = await saveTicketTemplateVersionRecord(
    {
      teamId: "team-alpha",
      templateName: "Orchestra Ticket",
      templateSchema: createEmptyTicketTemplate(),
    },
    db,
  );

  const secondSchema = createEmptyTicketTemplate();
  secondSchema.nodes.push({
    id: "asset-hero",
    kind: "asset",
    x: 0,
    y: 0,
    width: 300,
    height: 300,
    assetKey: "seatwise/tickets/hero.png",
  });

  await saveTicketTemplateVersionRecord(
    {
      ticketTemplateId: initial.template.ticket_template_id,
      teamId: "team-alpha",
      templateName: "Orchestra Ticket",
      templateSchema: secondSchema,
    },
    db,
  );

  const loaded = await getTicketTemplateById(
    initial.template.ticket_template_id,
    {
      teamId: "team-alpha",
      isSuperadmin: false,
    },
    db,
  );

  assert.ok(loaded);
  assert.equal(loaded?.latestVersion.version_number, 2);
  assert.deepEqual(
    loaded?.versions.map((version) => version.version_number),
    [2, 1],
  );
  assert.deepEqual(
    loaded?.latestVersion.template_schema.nodes,
    normalizeTemplateVersion(secondSchema).nodes,
  );
});
