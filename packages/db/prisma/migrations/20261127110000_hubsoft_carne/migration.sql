-- Add configurable Hubsoft carne flag to Settings
ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "hubsoftCarne" BOOLEAN NOT NULL DEFAULT true;
