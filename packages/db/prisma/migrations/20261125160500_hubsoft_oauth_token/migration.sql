-- Add Hubsoft OAuth credentials and persisted access/refresh tokens to Settings
ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "hubsoftClientId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "hubsoftClientSecret" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "hubsoftUsername" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "hubsoftPassword" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "hubsoftAccessToken" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "hubsoftRefreshToken" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "hubsoftTokenUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hubsoftTokenExpiresAt" TIMESTAMP(3);
