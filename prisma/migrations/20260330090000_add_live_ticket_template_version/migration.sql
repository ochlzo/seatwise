ALTER TABLE "TicketTemplate"
ADD COLUMN "live_ticket_template_version_id" TEXT;

CREATE INDEX "TicketTemplate_live_ticket_template_version_id_idx"
ON "TicketTemplate"("live_ticket_template_version_id");

ALTER TABLE "TicketTemplate"
ADD CONSTRAINT "TicketTemplate_live_ticket_template_version_id_fkey"
FOREIGN KEY ("live_ticket_template_version_id")
REFERENCES "TicketTemplateVersion"("ticket_template_version_id")
ON DELETE SET NULL
ON UPDATE CASCADE;
