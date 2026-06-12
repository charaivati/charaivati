-- PRIV-ACT-1: user search privacy opt-out.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "discoverable" BOOLEAN NOT NULL DEFAULT true;
