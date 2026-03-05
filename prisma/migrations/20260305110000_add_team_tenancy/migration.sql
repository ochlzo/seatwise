-- Create team table
CREATE TABLE "Team" (
  "team_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Team_pkey" PRIMARY KEY ("team_id")
);

CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- Add tenancy columns
ALTER TABLE "Admin" ADD COLUMN "team_id" TEXT;
ALTER TABLE "Admin" ADD COLUMN "is_superadmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Show" ADD COLUMN "team_id" TEXT;

-- Add indexes
CREATE INDEX "Admin_team_id_idx" ON "Admin"("team_id");
CREATE INDEX "Show_team_id_idx" ON "Show"("team_id");

-- Seed default team and backfill current records
INSERT INTO "Team" ("team_id", "name", "createdAt", "updatedAt")
VALUES ('default-team', 'Default Team', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("team_id") DO NOTHING;

UPDATE "Admin"
SET "team_id" = 'default-team'
WHERE "team_id" IS NULL;

UPDATE "Show"
SET "team_id" = 'default-team'
WHERE "team_id" IS NULL;

-- Add foreign keys after backfill
ALTER TABLE "Admin"
ADD CONSTRAINT "Admin_team_id_fkey"
FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Show"
ADD CONSTRAINT "Show_team_id_fkey"
FOREIGN KEY ("team_id") REFERENCES "Team"("team_id") ON DELETE RESTRICT ON UPDATE CASCADE;