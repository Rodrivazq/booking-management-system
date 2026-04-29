-- Migration: add missing columns that exist in schema.prisma but not in the init migration
-- Safe: all operations use ADD COLUMN IF NOT EXISTS or DO NOTHING where applicable

-- Add documentId to User (schema has it as optional unique)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "documentId" TEXT;

-- Create unique index for documentId only if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'User' AND indexname = 'User_documentId_key'
    ) THEN
        CREATE UNIQUE INDEX "User_documentId_key" ON "User"("documentId");
    END IF;
END $$;

-- Add isEmailVerified to User (schema default: false)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Add verificationToken to User (schema: optional unique)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationToken" TEXT;

-- Create unique index for verificationToken only if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'User' AND indexname = 'User_verificationToken_key'
    ) THEN
        CREATE UNIQUE INDEX "User_verificationToken_key" ON "User"("verificationToken");
    END IF;
END $$;

-- Update FK on Reservation to use CASCADE (schema: onDelete: Cascade)
-- Drop the old RESTRICT constraint first if it exists, then re-add with CASCADE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Reservation_userId_fkey'
    ) THEN
        ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_userId_fkey";
    END IF;
END $$;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update FK on PasswordReset to use CASCADE (schema: onDelete: Cascade)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'PasswordReset_userId_fkey'
    ) THEN
        ALTER TABLE "PasswordReset" DROP CONSTRAINT "PasswordReset_userId_fkey";
    END IF;
END $$;
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
