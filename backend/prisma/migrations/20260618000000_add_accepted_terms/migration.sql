-- Evidencia de aceptación de Términos y Política de Privacidad (Ley 18.331).
-- Seguro/idempotente: ADD COLUMN IF NOT EXISTS.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "acceptedTermsAt" TIMESTAMP(3);
