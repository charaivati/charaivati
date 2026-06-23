import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";
import { createNotification } from "@/lib/notifications/createNotification";
import { haversineKm } from "@/lib/geo/haversine";

// Computes price from the block's pricing model — same per-km/per-kg-km
// formulas already used by the delivery cost calculator (lib/workflow/calculateDeliveryCost.ts),
// just driven by customer-chosen start/drop instead of a saved address.
function computePrice(block: { pricingModel: string | null; price: number | null; perKmRate: number | null; perKgRate: number | null; weight: number }, distanceKm: number, weightKg: number) {
  const model = block.pricingModel ?? "fixed";
  if (model === "per_km") return (block.price ?? 0) + (block.perKmRate ?? 0) * distanceKm;
  if (model === "per_kg_km") return (block.perKgRate ?? 0) * weightKg + (block.perKmRate ?? 0) * distanceKm;
  return block.price ?? 0;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await params;
  const { blockId, startLat, startLng, startLabel, dropLat, dropLng, dropLabel, weightKg } = await req.json();

  if (!blockId || ![startLat, startLng, dropLat, dropLng].every((v) => typeof v === "number" && Number.isFinite(v))) {
    return NextResponse.json({ error: "blockId, start location, and drop location are required" }, { status: 400 });
  }

  const store = await db.store.findFirst({ where: { pageId } });
  if (!store) return NextResponse.json({ error: "Fleet not found" }, { status: 404 });

  const statusRow = await db.$queryRaw<{ acceptingOrders: boolean; deletedAt: Date | null }[]>`
    SELECT "acceptingOrders", "deletedAt" FROM "Store" WHERE id = ${store.id} LIMIT 1
  `;
  if (!statusRow[0] || statusRow[0].deletedAt) {
    return NextResponse.json({ error: "This fleet is no longer available." }, { status: 422 });
  }
  if (!statusRow[0].acceptingOrders) {
    return NextResponse.json({ error: "This fleet isn't taking bookings right now." }, { status: 422 });
  }

  const block = await db.storeBlock.findUnique({ where: { id: blockId } });
  if (!block || block.storeId !== store.id || block.serviceType !== "delivery" || block.visibility !== "public") {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  const distanceKm = haversineKm(startLat, startLng, dropLat, dropLng);
  const weight = typeof weightKg === "number" && weightKg > 0 ? weightKg : block.weight ?? 1;
  const total = Math.round(computePrice(block, distanceKm, weight));

  // Order requires a saved Address — this booking has no saved address, so a
  // minimal one is created from the drop point. Never shown as a "real" saved
  // address to the customer; it only exists to satisfy the existing Order/delivery machinery.
  const address = await db.address.create({
    data: {
      userId: user.id,
      name: user.name ?? "Customer",
      phone: "",
      line1: dropLabel || "Drop location",
      city: "-",
      state: "-",
      pincode: "000000",
      lat: dropLat,
      lng: dropLng,
    },
  });

  const order = await db.order.create({
    data: {
      userId: user.id,
      storeId: store.id,
      addressId: address.id,
      status: "pending",
      total,
      items: [
        {
          blockId: block.id,
          title: block.title,
          price: total,
          quantity: 1,
          imageUrl: null,
          startLat,
          startLng,
          startLabel: startLabel || null,
          dropLabel: dropLabel || null,
          distanceKm: Math.round(distanceKm * 10) / 10,
        },
      ],
    } as any,
  });

  try {
    await createNotification({
      userId: store.ownerId,
      type: "order_confirmed",
      title: `New fleet booking on ${store.name}`,
      body: `${block.title} — ₹${total.toLocaleString("en-IN")} (${distanceKm.toFixed(1)} km)`,
      link: `/store/${store.id}/orders`,
    });
  } catch (e) {
    console.error("Fleet booking notification failed:", e);
  }

  return NextResponse.json({ orderId: order.id, total, distanceKm: Math.round(distanceKm * 10) / 10 }, { status: 201 });
}
