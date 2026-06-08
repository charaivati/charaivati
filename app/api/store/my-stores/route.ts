import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { getStoreSlugs } from "@/lib/store/getStoreSlugs";
import { softDeleteStore } from "@/lib/store/softDeleteStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ stores: [] });

  const stores = await prisma.store.findMany({
    where: { ownerId: user.id },
    select: {
      id: true,
      name: true,
      pageId: true,
      createdAt: true,
      deletedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const slugs = await getStoreSlugs(stores.map((s) => s.id));
  return NextResponse.json({
    stores: stores.map((s) => ({ ...s, slug: slugs[s.id] ?? null })),
  });
}

// Soft-deletes the store + its linked Page (whole-venture delete). Refuses when
// any order (including sub-orders) is still open. See lib/store/softDeleteStore.ts.
export async function DELETE(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const storeId = (body.id || "").trim();
  if (!storeId) return NextResponse.json({ error: "store_id_required" }, { status: 400 });

  const result = await softDeleteStore(storeId, user.id);

  if (!result.ok) {
    if (result.reason === "not_found") return NextResponse.json({ error: "store_not_found" }, { status: 404 });
    if (result.reason === "forbidden") return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    return NextResponse.json(
      { error: "open_orders", message: "This store has open orders — settle or cancel them before deleting.", blockingOrders: result.blockingOrders },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
