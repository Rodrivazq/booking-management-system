-- Permite a un admin habilitar a un usuario puntual a reservar la semana en
-- curso fuera de la ventana normal (altas a mitad de semana).
-- Seguro/idempotente: ADD COLUMN IF NOT EXISTS.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reservationOverrideWeek" TEXT;
