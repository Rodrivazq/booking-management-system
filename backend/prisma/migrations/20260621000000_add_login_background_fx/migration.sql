-- Difuminado del fondo del login (desenfoque px + oscurecido %).
-- Seguro/idempotente: ADD COLUMN IF NOT EXISTS con defaults.
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "loginBackgroundBlur" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "loginBackgroundDim" INTEGER NOT NULL DEFAULT 55;
