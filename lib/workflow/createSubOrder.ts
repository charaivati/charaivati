import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/createNotification";
import { haversineKm } from "@/lib/geo/haversine";

interface CreateSubOrderParams {
  parentOrderId: string;
  assigneeUserId: string;
  storeId: string;
  stepId: string;
  stepName: string;
  agreedAmount?: number;
  subOrderType: string;
}

export async function createSubOrder(params: CreateSubOrderParams): Promise<number> {
  const { parentOrderId, assigneeUserId, storeId, stepId, stepName, agreedAmount, subOrderType } = params;

  try {
    // Fetch parent order — need customer userId, addressId, items, and delivery coords
    const parent = await (prisma as any).order.findUnique({
      where: { id: parentOrderId },
      select: {
        userId:    true,
        addressId: true,
        items:     true,
        address:   { select: { lat: true, lng: true } },
      },
    });
    if (!parent) return 0;

    // Dedup: skip if a sub-order already exists for this parent + assignee + type
    const existing = await (prisma as any).order.findFirst({
      where: { parentOrderId, userId: assigneeUserId, subOrderType },
      select: { id: true },
    });
    if (existing) return 0;

    // ── Find partner's store ──────────────────────────────────────────────────
    const partnerStore = await prisma.store.findFirst({
      where: { ownerId: assigneeUserId },
      select: { id: true },
    });
    if (!partnerStore) {
      console.warn(`createSubOrder: partner ${assigneeUserId} has no store — sub-order will use original storeId`);
    }
    const targetStoreId = partnerStore?.id ?? storeId;

    // ── Find delivery blocks in partner's store ───────────────────────────────
    const deliveryBlocks = partnerStore
      ? await prisma.storeBlock.findMany({
          where: {
            section:     { storeId: partnerStore.id },
            serviceType: "delivery",
            visibility:  { in: ["public", "internal"] },
          },
          orderBy: { createdAt: "asc" },
          select: {
            id:           true,
            title:        true,
            price:        true,
            perKmRate:    true,
            perKgRate:    true,
            pricingModel: true,
          },
        })
      : [];

    // ── Calculate total weight from parent order items ────────────────────────
    const rawItems = (parent.items as { blockId: string; quantity: number }[]) ?? [];
    const totalItems = rawItems.reduce((s, i) => s + (i.quantity ?? 1), 0);
    const blockIds = rawItems.map((i) => i.blockId).filter(Boolean);
    const sourceBlocks =
      blockIds.length > 0
        ? await prisma.storeBlock.findMany({
            where:  { id: { in: blockIds } },
            select: { id: true, weight: true },
          })
        : [];
    const weightMap = new Map(sourceBlocks.map((b) => [b.id, b.weight]));
    const totalWeightKg = rawItems.reduce(
      (s, i) => s + ((weightMap.get(i.blockId) ?? 1) as number) * (i.quantity ?? 1),
      0
    );

    // ── Calculate distance (partner's store location → delivery address) ──────
    // Store location (GEO-STORE-1) — canonical Store.lat/lng, with the partner's
    // isDefault Address as a legacy fallback. Fields added after the last
    // successful `prisma generate`, so fetched via raw SQL.
    let distanceKm = 0;
    if (parent.address?.lat != null && parent.address?.lng != null) {
      const [partnerStoreLocRows, partnerAddr] = await Promise.all([
        partnerStore
          ? prisma.$queryRaw<{ lat: number | null; lng: number | null }[]>`
              SELECT "lat", "lng" FROM "Store" WHERE id = ${partnerStore.id} LIMIT 1
            `
          : Promise.resolve([]),
        prisma.address.findFirst({
          where:  { userId: assigneeUserId, isDefault: true },
          select: { lat: true, lng: true },
        }),
      ]);
      const partnerLat = partnerStoreLocRows[0]?.lat ?? partnerAddr?.lat ?? null;
      const partnerLng = partnerStoreLocRows[0]?.lng ?? partnerAddr?.lng ?? null;
      if (partnerLat != null && partnerLng != null) {
        distanceKm = haversineKm(
          partnerLat, partnerLng,
          parent.address.lat, parent.address.lng
        );
      } else if (deliveryBlocks.some((b) => b.perKmRate)) {
        console.warn(
          `createSubOrder: missing coordinates for partner store ${targetStoreId} or order ${parentOrderId} delivery address — per-km delivery cost will be 0`
        );
      }
    }

    // ── Determine cost and item entry ─────────────────────────────────────────
    let calculatedCost: number;
    let itemBlockId: string | null = null;
    let itemTitle = "Delivery Service";

    if (agreedAmount && agreedAmount > 0) {
      // Authoritative cost already calculated upstream (WorkflowStepAssignee pricing or accepted quote).
      // Block pricing already had its chance at the WorkflowStepAssignee level — do not override here.
      calculatedCost = agreedAmount;
      if (deliveryBlocks.length > 0) {
        itemBlockId = deliveryBlocks[0].id;
        itemTitle   = deliveryBlocks[0].title;
      }
    } else if (deliveryBlocks.length > 0) {
      // No agreed amount set upstream — fall back to partner's block pricing
      const block = deliveryBlocks[0];
      itemBlockId = block.id;
      itemTitle   = block.title;

      let cost = 0;
      if (block.price)     cost += block.price;
      if (block.perKgRate) cost += block.perKgRate * totalWeightKg;
      if (block.perKmRate) cost += block.perKmRate * distanceKm;
      calculatedCost = Math.round(cost * 100) / 100;
    } else {
      calculatedCost = 0;
    }

    // ── Create sub-order in partner's store ───────────────────────────────────
    // The DB has @@unique([parentOrderId, userId, subOrderType]); a concurrent
    // confirm can still race past the findFirst guard above and hit P2002 — catch
    // it and treat as "already created" rather than surfacing a 500.
    try {
      await (prisma as any).order.create({
        data: {
          userId:         assigneeUserId,
          storeId:        targetStoreId,
          addressId:      parent.addressId,
          status:         "pending",
          deliveryStatus: "pending",
          items: [
            {
              blockId:  itemBlockId,
              title:    itemTitle,
              quantity: 1,
              price:    calculatedCost,
            },
          ],
          total:         calculatedCost,
          parentOrderId,
          subOrderType,
          agreedAmount:  calculatedCost > 0 ? calculatedCost : null,
        },
      });
    } catch (createErr: any) {
      if (createErr?.code === "P2002") return 0;
      throw createErr;
    }

    // ── Notify partner ────────────────────────────────────────────────────────
    await createNotification({
      userId: assigneeUserId,
      type:   "order_assigned",
      title:  "New delivery order",
      body:   `New delivery order — ₹${calculatedCost}`,
      link:   "/store/orders/all",
    });

    return calculatedCost;
  } catch (e) {
    console.error("createSubOrder failed:", e);
    return 0;
  }
}
