// lib/featureFlags.ts (server)
import prisma from "./prisma";

export async function getFeatureFlagValue(key: string): Promise<boolean> {
  const f = await prisma.featureFlag.findUnique({ where: { key } });
  return f?.enabled ?? false;
}

export async function upsertFeatureFlag(key: string, enabled: boolean, meta?: Record<string, any>) {
  return prisma.featureFlag.upsert({
    where: { key },
    update: { enabled, meta },
    create: { key, enabled, meta },
  });
}
