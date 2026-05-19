import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import DeliveriesClient, { type DeliveryOrder } from "@/components/earn/DeliveriesClient";

type RawOrder = {
  id: string;
  deliveryStatus: string;
  partnerStatus: string | null;
  vehicleId: string | null;
  assignedToId: string;
  deliveryNote: string | null;
  items: unknown;
  total: number;
  createdAt: Date;
  addrName: string;
  addrPhone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  storeName: string;
};

export default async function DeliveriesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;
  const userId = payload?.userId ?? null;

  if (!userId) redirect("/earn");

  // Pages this user owns — any of these can be the receiver side of a collaboration.
  const ownedPages = await prisma.page.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  const pageIds = ownedPages.map((p) => p.id);

  if (pageIds.length === 0) {
    return <Shell><DeliveriesClient orders={[]} /></Shell>;
  }

  // Accepted collaborations where one of the user's pages is the receiver.
  const collabs = await prisma.collaboration.findMany({
    where: { receiverId: { in: pageIds }, status: "accepted" },
    select: {
      id: true,
      role: true,
      requester: { select: { title: true } },
    },
  });

  if (collabs.length === 0) {
    return <Shell><DeliveriesClient orders={[]} /></Shell>;
  }

  const collabIds = collabs.map((c) => c.id);
  const collabMeta: Record<string, { role: string; requesterTitle: string }> = {};
  for (const c of collabs) {
    collabMeta[c.id] = { role: c.role, requesterTitle: c.requester.title };
  }

  // All orders assigned to these collaborations with partnerStatus assigned or accepted.
  // Raw SQL because these are new schema fields not yet in all generated clients.
  const rawOrders = await prisma.$queryRaw<RawOrder[]>`
    SELECT
      o.id,
      o."deliveryStatus",
      o."partnerStatus",
      o."vehicleId",
      o."assignedToId",
      o."deliveryNote",
      o.items,
      o.total,
      o."createdAt",
      a.name      AS "addrName",
      a.phone     AS "addrPhone",
      a.line1,
      a.city,
      a.state,
      a.pincode,
      s.name      AS "storeName"
    FROM "Order" o
    JOIN "Address" a ON o."addressId" = a.id
    JOIN "Store"   s ON o."storeId"   = s.id
    WHERE o."assignedToId" = ANY(${collabIds}::text[])
      AND o."partnerStatus" IN ('assigned', 'accepted')
    ORDER BY o."createdAt" DESC
  `;

  const orders: DeliveryOrder[] = rawOrders.map((o) => ({
    ...o,
    items: o.items as DeliveryOrder["items"],
    createdAt: o.createdAt.toISOString(),
    collabRole:     collabMeta[o.assignedToId]?.role           ?? "",
    requesterTitle: collabMeta[o.assignedToId]?.requesterTitle ?? "",
  }));

  return <Shell><DeliveriesClient orders={orders} /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <a
          href="/app/initiatives"
          className="text-sm text-gray-400 hover:text-white mb-6 inline-block transition-colors"
        >
          ← Initiatives
        </a>
        <h1 className="text-2xl font-bold text-white mb-2">My Deliveries</h1>
        <p className="text-sm text-gray-400 mb-8">
          Orders assigned to you — accept, dispatch, and track deliveries.
        </p>
        {children}
      </div>
    </div>
  );
}
