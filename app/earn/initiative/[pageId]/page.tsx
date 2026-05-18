import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import InitiativeTabs from "@/components/earn/InitiativeTabs";

function pageBadge(type: string | null, pageType: string | null) {
  if (type === "health")        return { label: "Health",   color: "#059669" };
  if (pageType === "helping")   return { label: "Helping",  color: "#0d9488" };
  if (pageType === "learning")  return { label: "Learning", color: "#7c3aed" };
  if (pageType === "service")   return { label: "Service",  color: "#b45309" };
  return                               { label: "Store",    color: "#6366f1" };
}

export default async function InitiativePage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;

  // Auth — read session cookie server-side
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const userId = payload?.userId ?? null;

  if (!userId) redirect("/earn");

  const [page, store, ownerPages] = await Promise.all([
    prisma.page.findUnique({
      where: { id: pageId },
      include: {
        course: true,
        helpingInitiative: true,
        collaborationsIn: { include: { requester: true } },
        collaborationsOut: { include: { receiver: true } },
      },
    }),
    prisma.store.findFirst({ where: { pageId } }),
    prisma.page.findMany({
      where: { ownerId: userId },
      select: { id: true, title: true, pageType: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!page || page.ownerId !== userId) redirect("/earn");

  const badge = pageBadge(page.type, page.pageType);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <a
          href="/app/initiatives"
          className="text-sm text-gray-400 hover:text-white mb-6 inline-block transition-colors"
        >
          ← Initiatives
        </a>

        <div className="flex items-center gap-3 mb-8">
          <h1 className="text-2xl font-bold text-white">{page.title}</h1>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0"
            style={{ color: badge.color, background: `${badge.color}18` }}
          >
            {badge.label}
          </span>
        </div>

        <InitiativeTabs
          pageId={pageId}
          pageType={page.pageType ?? "store"}
          storeName={store?.name ?? null}
          storeSlug={store?.slug ?? null}
          storeId={store?.id ?? null}
          ownerPages={ownerPages}
        />
      </div>
    </div>
  );
}
