-- Migration: add unique constraint on Reservation(userId, weekStart)
-- Safe: Uses IF NOT EXISTS guard to avoid errors if applied twice.
-- PREREQUISITE: Run check_duplicates_before_migration.sql first.
-- If duplicates exist, clean them before running this.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'Reservation_userId_weekStart_key'
    ) THEN
        ALTER TABLE "Reservation"
            ADD CONSTRAINT "Reservation_userId_weekStart_key"
            UNIQUE ("userId", "weekStart");
    END IF;
END $$;
