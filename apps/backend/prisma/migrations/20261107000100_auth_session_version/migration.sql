-- Invalidate issued JWTs after logout, password change, or account security reset.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "authVersion" INTEGER NOT NULL DEFAULT 0;
