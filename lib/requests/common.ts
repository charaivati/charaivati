// REQBCAST-1c — shared helpers for the request-broadcast routes.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { getPayToVpa } from "@/lib/payments/getVpa";

export async function authUserId(req: NextRequest): Promise<string | null> {
  const payload = await verifySessionToken(getTokenFromRequest(req));
  return payload?.userId ?? null;
}

// Lazy expiry — global sweep on read. ponytail: cheap one-statement sweep, no
// scheduler; the in-process setTimeout pattern (Quote) doesn't survive restarts.
export async function expireStale(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "RequestBroadcast" SET status='expired'
    WHERE status='open' AND "expiresAt" IS NOT NULL AND "expiresAt" < NOW()
  `;
}

// locale → en → slug fallback, one query for the whole set.
export async function categoryTitles(ids: string[], locale: string): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const rows = await prisma.$queryRaw<{ categoryId: string; locale: string; title: string }[]>(
    Prisma.sql`
      SELECT t."categoryId", t.locale, t.title
      FROM "StoreCategoryTranslation" t
      WHERE t."categoryId" = ANY(${ids}::text[]) AND t.locale IN (${locale}, 'en')
    `
  );
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.locale === locale) out[r.categoryId] = r.title;
    else if (!out[r.categoryId]) out[r.categoryId] = r.title; // en fallback
  }
  return out;
}

// The handoff surfaced at accept — accepted provider's contact + UPI VPA.
// DISPLAY/HANDOFF ONLY (REQBCAST-1b): nothing here moves or verifies money.
export async function resolveHandoff(
  providerId: string,
  providerStoreId: string | null
): Promise<{ providerName: string | null; providerPhone: string | null; vpa: string | null }> {
  const [user, vpa] = await Promise.all([
    prisma.user.findUnique({ where: { id: providerId }, select: { name: true, phone: true } }),
    getPayToVpa(providerStoreId ? { storeId: providerStoreId } : { userId: providerId }),
  ]);
  return { providerName: user?.name ?? null, providerPhone: user?.phone ?? null, vpa };
}
