-- Add DRY_RUN to ShowStatus enum for pre-live reservation testing flows.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ShowStatus'
      AND e.enumlabel = 'DRY_RUN'
  ) THEN
    ALTER TYPE "ShowStatus" ADD VALUE 'DRY_RUN' AFTER 'OPEN';
  END IF;
END$$;
