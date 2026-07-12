-- Chat key rotation protection:
-- 1. UserPublicKey.keyHistory — previous public keys (JSON array of JWK
--    strings) so friends can decrypt messages sent before this user rotated.
-- 2. UserKeyBackup — server-encrypted backup of the user's chat keypair so a
--    new device / cleared browser restores the same identity instead of
--    rotating to a fresh key.

ALTER TABLE "UserPublicKey" ADD COLUMN IF NOT EXISTS "keyHistory" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS "UserKeyBackup" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "encrypted" TEXT NOT NULL,
  "iv" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserKeyBackup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserKeyBackup_userId_key" ON "UserKeyBackup"("userId");

ALTER TABLE "UserKeyBackup" ADD CONSTRAINT "UserKeyBackup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
