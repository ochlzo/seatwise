ALTER TABLE "Reservation"
ADD COLUMN "reservation_status_changed_at" TIMESTAMP(3);

UPDATE "Reservation"
SET "reservation_status_changed_at" = CASE
  WHEN "status" = 'CONFIRMED' THEN COALESCE("ticket_issued_at", "updatedAt", "createdAt")
  WHEN "status" = 'CANCELLED' THEN "updatedAt"
  ELSE NULL
END;
