import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import DeliveriesClient, { type DeliveryOrder, type CompletedDelivery } from "@/components/earn/DeliveriesClient";

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
  agreedAmount: number | null;
  addrName: string;
  addrPhone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  storeName: string;
  activeStepId: string | null;
  cycleCount: number | null;
};

type RawCompleted = {
  id: string;
  createdAt: Date;
  agreedAmount: number | null;
  addrName: string;
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

  // Accepted collaborations where one of the user's pages is the receiver.
  const collabs = pageIds.length > 0 ? await prisma.collaboration.findMany({
    where: { receiverId: { in: pageIds }, status: "accepted" },
    select: {
      id: true,
      role: true,
      requester: { select: { title: true } },
    },
  }) : [];

  const collabIds = collabs.map((c) => c.id);
  const collabMeta: Record<string, { role: string; requesterTitle: string }> = {};
  for (const c of collabs) {
    collabMeta[c.id] = { role: c.role, requesterTitle: c.requester.title };
  }

  // All orders assigned to these collaborations with partnerStatus assigned or accepted.
  // Raw SQL because these are new schema fields not yet in all generated clients.
  const rawCollabOrders = collabIds.length > 0 ? await prisma.$queryRaw<RawOrder[]>`
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
      o."agreedAmount",
      a.name      AS "addrName",
      a.phone     AS "addrPhone",
      a.line1,
      a.city,
      a.state,
      a.pincode,
      s.name      AS "storeName",
      (SELECT osp."stepId" FROM "OrderStepProgress" osp
       WHERE osp."orderId" = o.id AND osp.status = 'active'
       ORDER BY osp."activatedAt" DESC LIMIT 1) AS "activeStepId",
      (SELECT osp."cycleCount" FROM "OrderStepProgress" osp
       WHERE osp."orderId" = o.id AND osp.status = 'active'
       ORDER BY osp."activatedAt" DESC LIMIT 1) AS "cycleCount"
    FROM "Order" o
    JOIN "Address" a ON o."addressId" = a.id
    JOIN "Store"   s ON o."storeId"   = s.id
    WHERE o."assignedToId" = ANY(${collabIds}::text[])
      AND o."partnerStatus" IN ('assigned', 'accepted')
    ORDER BY o."createdAt" DESC
  ` : [];

  // Orders where a delivery block's assignedUserId matches the current user.
  // Uses a LATERAL join to parse the items JSON array and look up Block.assignedUserId.
  const rawBlockOrders = await prisma.$queryRaw<RawOrder[]>`
    SELECT DISTINCT ON (o.id)
      o.id,
      o."deliveryStatus",
      o."partnerStatus",
      o."vehicleId",
      o."assignedToId",
      o."deliveryNote",
      o.items,
      o.total,
      o."createdAt",
      o."agreedAmount",
      a.name      AS "addrName",
      a.phone     AS "addrPhone",
      a.line1,
      a.city,
      a.state,
      a.pincode,
      s.name      AS "storeName",
      (SELECT osp."stepId" FROM "OrderStepProgress" osp
       WHERE osp."orderId" = o.id AND osp.status = 'active'
       ORDER BY osp."activatedAt" DESC LIMIT 1) AS "activeStepId",
      (SELECT osp."cycleCount" FROM "OrderStepProgress" osp
       WHERE osp."orderId" = o.id AND osp.status = 'active'
       ORDER BY osp."activatedAt" DESC LIMIT 1) AS "cycleCount"
    FROM "Order" o
    JOIN "Address" a ON o."addressId" = a.id
    JOIN "Store"   s ON o."storeId"   = s.id,
    LATERAL (
      SELECT TRUE FROM jsonb_array_elements(o.items::jsonb) AS item
      JOIN "Block" b ON b.id = (item->>'blockId')
      WHERE b."assignedUserId" = ${userId} AND b."serviceType" = 'delivery'
      LIMIT 1
    ) AS matched
    WHERE o."partnerStatus" IN ('assigned', 'accepted')
    ORDER BY o.id, o."createdAt" DESC
  `;

  // Orders where the store owner self-assigned via partnerAction: "self_assign".
  // assignedToId is set to the owner's userId (a plain string marker, not a Collaboration id).
  const rawSelfOrders = await prisma.$queryRaw<RawOrder[]>`
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
      o."agreedAmount",
      a.name      AS "addrName",
      a.phone     AS "addrPhone",
      a.line1,
      a.city,
      a.state,
      a.pincode,
      s.name      AS "storeName",
      (SELECT osp."stepId" FROM "OrderStepProgress" osp
       WHERE osp."orderId" = o.id AND osp.status = 'active'
       ORDER BY osp."activatedAt" DESC LIMIT 1) AS "activeStepId",
      (SELECT osp."cycleCount" FROM "OrderStepProgress" osp
       WHERE osp."orderId" = o.id AND osp.status = 'active'
       ORDER BY osp."activatedAt" DESC LIMIT 1) AS "cycleCount"
    FROM "Order" o
    JOIN "Address" a ON o."addressId" = a.id
    JOIN "Store"   s ON o."storeId"   = s.id
    WHERE o."assignedToId" = ${userId}
      AND o."partnerStatus" IN ('assigned', 'accepted')
  `;

  // Merge, deduplicate by id (collab orders take precedence, then block, then self).
  const seenIds = new Set(rawCollabOrders.map((o) => o.id));
  const afterCollab = rawBlockOrders.filter((o) => !seenIds.has(o.id));
  afterCollab.forEach((o) => seenIds.add(o.id));
  const mergedRaw = [
    ...rawCollabOrders,
    ...afterCollab,
    ...rawSelfOrders.filter((o) => !seenIds.has(o.id)),
  ];
  mergedRaw.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const orders: DeliveryOrder[] = mergedRaw.map((o) => {
    const isSelf = o.assignedToId === userId;
    return {
      ...o,
      items: o.items as DeliveryOrder["items"],
      createdAt: o.createdAt.toISOString(),
      collabRole:     isSelf ? "self" : (collabMeta[o.assignedToId]?.role ?? "employee"),
      requesterTitle: collabMeta[o.assignedToId]?.requesterTitle ?? (o as any).storeName ?? "",
    };
  });

  // Last 10 completed deliveries for this user
  const rawCompleted = await prisma.$queryRaw<RawCompleted[]>`
    SELECT
      o.id,
      o."createdAt",
      o."agreedAmount",
      a.name      AS "addrName",
      a.line1,
      a.city,
      a.state,
      a.pincode,
      s.name      AS "storeName"
    FROM "Order" o
    JOIN "Address" a ON o."addressId" = a.id
    JOIN "Store"   s ON o."storeId"   = s.id
    WHERE o."assignedToId" = ANY(${collabIds}::text[])
      AND o."partnerStatus" = 'completed'
    ORDER BY o."createdAt" DESC
    LIMIT 10
  `;

  const completedOrders: CompletedDelivery[] = rawCompleted.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
  }));

  return <Shell><DeliveriesClient orders={orders} completedOrders={completedOrders} /></Shell>;
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
