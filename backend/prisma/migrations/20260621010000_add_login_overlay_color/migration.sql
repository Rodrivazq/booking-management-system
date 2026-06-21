-- Color del tinte/oscurecido del fondo del login (paleta).
-- Seguro/idempotente.
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "loginBackgroundColor" TEXT DEFAULT '#1e293b';
