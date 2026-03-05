-- Remove POSTPONED from ShowStatus enum.
-- Existing POSTPONED rows are mapped to CLOSED before type replacement.

ALTER TABLE "Show"
ALTER COLUMN "show_status" TYPE TEXT;

UPDATE "Show"
SET "show_status" = 'CLOSED'
WHERE "show_status" = 'POSTPONED';

CREATE TYPE "ShowStatus_new" AS ENUM (
  'UPCOMING',
  'DRAFT',
  'OPEN',
  'CLOSED',
  'ON_GOING',
  'CANCELLED'
);

ALTER TABLE "Show"
ALTER COLUMN "show_status" TYPE "ShowStatus_new"
USING ("show_status"::TEXT::"ShowStatus_new");

DROP TYPE "ShowStatus";

ALTER TYPE "ShowStatus_new" RENAME TO "ShowStatus";
