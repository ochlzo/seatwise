CREATE TYPE "SchedStatus" AS ENUM ('ON_GOING', 'FULLY_BOOKED', 'CLOSED');

ALTER TABLE "Sched"
ADD COLUMN "status" "SchedStatus";
