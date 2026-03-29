-- CreateTable
CREATE TABLE "ShowTicketTemplate" (
    "show_id" TEXT NOT NULL,
    "ticket_template_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowTicketTemplate_pkey" PRIMARY KEY ("show_id","ticket_template_id")
);

-- Backfill legacy single-template links
INSERT INTO "ShowTicketTemplate" ("show_id", "ticket_template_id", "team_id")
SELECT "show_id", "ticket_template_id", "team_id"
FROM "Show"
WHERE "ticket_template_id" IS NOT NULL
ON CONFLICT ("show_id", "ticket_template_id") DO NOTHING;

-- CreateIndex
CREATE INDEX "ShowTicketTemplate_ticket_template_id_idx" ON "ShowTicketTemplate"("ticket_template_id");

-- CreateIndex
CREATE INDEX "ShowTicketTemplate_team_id_idx" ON "ShowTicketTemplate"("team_id");

-- AddForeignKey
ALTER TABLE "ShowTicketTemplate" ADD CONSTRAINT "ShowTicketTemplate_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "Show"("show_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowTicketTemplate" ADD CONSTRAINT "ShowTicketTemplate_ticket_template_id_team_id_fkey" FOREIGN KEY ("ticket_template_id", "team_id") REFERENCES "TicketTemplate"("ticket_template_id", "team_id") ON DELETE RESTRICT ON UPDATE CASCADE;