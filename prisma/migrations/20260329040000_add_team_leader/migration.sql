-- Add optional team leader reference
ALTER TABLE "Team"
ADD COLUMN "team_leader_admin_id" TEXT;

CREATE UNIQUE INDEX "Team_team_leader_admin_id_key" ON "Team"("team_leader_admin_id");

ALTER TABLE "Team"
ADD CONSTRAINT "Team_team_leader_admin_id_fkey"
FOREIGN KEY ("team_leader_admin_id") REFERENCES "Admin"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
