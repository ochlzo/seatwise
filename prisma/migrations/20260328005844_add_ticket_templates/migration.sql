-- AlterEnum
ALTER TYPE "SeatStatus" ADD VALUE 'CONSUMED';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "ticket_consumed_at" TIMESTAMP(3),
ADD COLUMN     "ticket_consumed_by_admin_id" TEXT,
ADD COLUMN     "ticket_delivery_error" TEXT,
ADD COLUMN     "ticket_issued_at" TIMESTAMP(3),
ADD COLUMN     "ticket_template_version_id" TEXT;

-- AlterTable
ALTER TABLE "Show" ADD COLUMN     "ticket_template_id" TEXT;

-- CreateTable
CREATE TABLE "TicketTemplate" (
    "ticket_template_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "template_name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketTemplate_pkey" PRIMARY KEY ("ticket_template_id")
);

-- CreateTable
CREATE TABLE "TicketTemplateVersion" (
    "ticket_template_version_id" TEXT NOT NULL,
    "ticket_template_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "template_schema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketTemplateVersion_pkey" PRIMARY KEY ("ticket_template_version_id")
);

-- CreateIndex
CREATE INDEX "TicketTemplate_team_id_idx" ON "TicketTemplate"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTemplate_ticket_template_id_team_id_key" ON "TicketTemplate"("ticket_template_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTemplate_team_id_template_name_key" ON "TicketTemplate"("team_id", "template_name");

-- CreateIndex
CREATE INDEX "TicketTemplateVersion_ticket_template_id_idx" ON "TicketTemplateVersion"("ticket_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "TicketTemplateVersion_ticket_template_id_version_number_key" ON "TicketTemplateVersion"("ticket_template_id", "version_number");

-- CreateIndex
CREATE INDEX "Reservation_ticket_template_version_id_idx" ON "Reservation"("ticket_template_version_id");

-- CreateIndex
CREATE INDEX "Reservation_ticket_consumed_by_admin_id_idx" ON "Reservation"("ticket_consumed_by_admin_id");

-- CreateIndex
CREATE INDEX "Show_ticket_template_id_idx" ON "Show"("ticket_template_id");

-- CreateIndex
CREATE INDEX "Show_ticket_template_id_team_id_idx" ON "Show"("ticket_template_id", "team_id");

-- AddForeignKey
ALTER TABLE "Show" ADD CONSTRAINT "Show_ticket_template_id_team_id_fkey" FOREIGN KEY ("ticket_template_id", "team_id") REFERENCES "TicketTemplate"("ticket_template_id", "team_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTemplate" ADD CONSTRAINT "TicketTemplate_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTemplateVersion" ADD CONSTRAINT "TicketTemplateVersion_ticket_template_id_fkey" FOREIGN KEY ("ticket_template_id") REFERENCES "TicketTemplate"("ticket_template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ticket_consumed_by_admin_id_fkey" FOREIGN KEY ("ticket_consumed_by_admin_id") REFERENCES "Admin"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ticket_template_version_id_fkey" FOREIGN KEY ("ticket_template_version_id") REFERENCES "TicketTemplateVersion"("ticket_template_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;
