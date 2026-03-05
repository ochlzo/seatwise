-- Reduce PaymentMethod enum values to: GCASH, WALK_IN
-- Map legacy methods to WALK_IN before switching enum type.

ALTER TABLE "Payment"
ALTER COLUMN "method" TYPE TEXT;

UPDATE "Payment"
SET "method" = 'WALK_IN'
WHERE "method" IN ('CASH', 'MAYA', 'CREDIT_CARD', 'BANK_TRANSFER');

CREATE TYPE "PaymentMethod_new" AS ENUM ('GCASH', 'WALK_IN');

ALTER TABLE "Payment"
ALTER COLUMN "method" TYPE "PaymentMethod_new"
USING ("method"::TEXT::"PaymentMethod_new");

DROP TYPE "PaymentMethod";

ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
