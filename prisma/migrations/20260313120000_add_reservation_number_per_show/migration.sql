-- Add reservation_number as nullable first for safe backfill
ALTER TABLE "Reservation"
ADD COLUMN "reservation_number" CHAR(4);

-- Backfill existing reservations with unique 4-digit values per show
DO $$
DECLARE
    reservation_row RECORD;
    candidate CHAR(4);
    slot INT;
    show_used_count INT;
BEGIN
    FOR reservation_row IN
        SELECT reservation_id, show_id
        FROM "Reservation"
        WHERE reservation_number IS NULL
        ORDER BY "createdAt" ASC, reservation_id ASC
    LOOP
        SELECT COUNT(*) INTO show_used_count
        FROM "Reservation"
        WHERE show_id = reservation_row.show_id
          AND reservation_number IS NOT NULL;

        IF show_used_count >= 10000 THEN
            RAISE EXCEPTION 'Cannot assign reservation_number for show %: all 0000-9999 numbers are already used.',
                reservation_row.show_id;
        END IF;

        candidate := NULL;

        -- Random search first
        FOR slot IN 1..50 LOOP
            candidate := LPAD((FLOOR(RANDOM() * 10000))::INT::TEXT, 4, '0');
            EXIT WHEN NOT EXISTS (
                SELECT 1
                FROM "Reservation"
                WHERE show_id = reservation_row.show_id
                  AND reservation_number = candidate
            );
            candidate := NULL;
        END LOOP;

        -- Deterministic fallback to guarantee completion when free slots still exist
        IF candidate IS NULL THEN
            FOR slot IN 0..9999 LOOP
                candidate := LPAD(slot::TEXT, 4, '0');
                EXIT WHEN NOT EXISTS (
                    SELECT 1
                    FROM "Reservation"
                    WHERE show_id = reservation_row.show_id
                      AND reservation_number = candidate
                );
                candidate := NULL;
            END LOOP;
        END IF;

        IF candidate IS NULL THEN
            RAISE EXCEPTION 'Failed to assign reservation_number for reservation % in show %.',
                reservation_row.reservation_id, reservation_row.show_id;
        END IF;

        UPDATE "Reservation"
        SET reservation_number = candidate
        WHERE reservation_id = reservation_row.reservation_id;
    END LOOP;
END $$;

ALTER TABLE "Reservation"
ALTER COLUMN "reservation_number" SET NOT NULL;

CREATE INDEX "Reservation_reservation_number_idx"
ON "Reservation"("reservation_number");

CREATE UNIQUE INDEX "Reservation_show_id_reservation_number_key"
ON "Reservation"("show_id", "reservation_number");
