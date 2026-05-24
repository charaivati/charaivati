import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { assignNextPartner } from "@/lib/workflow/assignNextPartner";
import { advanceToNextStep } from "@/lib/workflow/advanceToNextStep";
import { createNotification } from "@/lib/notifications/createNotification";

const DELIVERY_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

type Params = { params: Promise<{ id: string }> };

type CollabWithPages = Awaited<ReturnType<typeof fetchCollab>>;

async function fetchCollab(id: string) {
  return prisma.collaboration.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, title: true, pageType: true, ownerId: true } },
      receiver:  { select: { id: true, title: true, pageType: true, ownerId: true } },
    },
  });
}

// Returns isPartner + the full collab record (null if not assigned or deleted).
async function resolveAssignedCollab(
  assignedToId: string | null,
  storePageId: string | null,
  userId: string
): Promise<{ isPartner: boolean; collab: CollabWithPages }> {
  if (!assignedToId) return { isPartner: false, collab: null };
  const collab = await fetchCollab(assignedToId);
  if (!collab) return { isPartner: false, collab: null };
  const partnerPage =
    collab.requesterId === storePageId ? collab.receiver : collab.requester;
  return { isPartner: partnerPage.ownerId === userId, collab };
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let user = await getServerUser(req);
  // TEST ONLY — never deploy with ALLOW_TEST_BYPASS=true
  if (!user && process.env.ALLOW_TEST_BYPASS === "true") {
    const tid = req.headers.get("x-test-userid");
    if (tid) user = await prisma.user.findUnique({ where: { id: tid }, select: { id: true, email: true, name: true } });
  }
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await (prisma.order as any).findUnique({
    where: { id },
    select: { assignedToId: true, items: true, store: { select: { ownerId: true, pageId: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = order.store.ownerId === user.id;
  const { isPartner } = isOwner
    ? { isPartner: false }
    : await resolveAssignedCollab(order.assignedToId, order.store.pageId, user.id);

  // Check if user is a block-assigned employee (items JSON references a delivery block with assignedUserId = user.id)
  let isBlockEmployee = false;
  if (!isOwner && !isPartner) {
    const items = (order.items as { blockId?: string }[] | null) ?? [];
    const blockIds = items.map((i) => i.blockId).filter((b): b is string => !!b);
    if (blockIds.length > 0) {
      const match = await prisma.storeBlock.findFirst({
        where: { id: { in: blockIds }, assignedUserId: user.id, serviceType: "delivery" },
        select: { id: true },
      });
      isBlockEmployee = match !== null;
    }
  }

  if (!isOwner && !isPartner && !isBlockEmployee)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { deliveryStatus, assignedToId, deliveryNote, vehicleId, partnerAction } = body;

  if (deliveryStatus !== undefined && !DELIVERY_STATUSES.includes(deliveryStatus))
    return NextResponse.json({ error: "Invalid deliveryStatus" }, { status: 400 });

  // ── Complete delivery — universal (owner, collab partner, block employee) ──
  // Placed before the partner gate so owners delivering themselves can also call it.
  if (partnerAction === "complete") {
    const updated = await prisma.order.update({
      where: { id },
      data: { partnerStatus: "completed", vehicleId: null },
    });

    // Block-based employees bypass the step confirm API (auth gap there); advance the
    // active OSP here instead. Collab partners call step confirm before this action —
    // their OSP is already advanced, so this branch is intentionally skipped for them.
    if (isBlockEmployee) {
      const activeOSP = await prisma.orderStepProgress.findFirst({
        where: { orderId: id, status: "active" },
        select: { id: true, stepId: true },
      });
      if (activeOSP) {
        await prisma.orderStepProgress.update({
          where: { id: activeOSP.id },
          data: { status: "confirmed", confirmedAt: new Date() },
        });
        advanceToNextStep(id, activeOSP.stepId).catch((e) =>
          console.error("delivery complete: advanceToNextStep failed:", e)
        );
      }
    }

    return NextResponse.json(updated);
  }

  // ── Partner / block-employee actions ──────────────────────────────────────
  if ((isPartner || isBlockEmployee) && !isOwner) {
    // Accept / Reject assignment — collab partners only
    if (isPartner) {
      if (partnerAction === "accept") {
        const updated = await (prisma.order as any).update({
          where: { id },
          data: { partnerStatus: "accepted" },
        });
        return NextResponse.json(updated);
      }

      if (partnerAction === "reject") {
        const activeOSP = await prisma.orderStepProgress.findFirst({
          where: { orderId: id, status: "active" },
          select: { id: true, stepId: true },
        });

        // Clear current assignment before cycling
        await prisma.order.update({
          where: { id },
          data: { partnerStatus: "rejected", assignedToId: null },
        });

        if (activeOSP) {
          const result = await assignNextPartner({
            orderId: id,
            stepId: activeOSP.stepId,
            ospId: activeOSP.id,
          });

          if (result.escalated) {
            return NextResponse.json({ partnerStatus: "rejected", assignedToId: null, requiresAttention: true });
          }
          if (result.assigned) {
            return NextResponse.json({ partnerStatus: "assigned", cycled: true });
          }
        }

        // No active OSP or no assignees configured — flag for owner attention
        await prisma.order.update({
          where: { id },
          data: { requiresAttention: true },
        });
        createNotification({
          userId: order.store.ownerId,
          type: "workflow_attention",
          title: "Delivery partner rejected",
          body: `Order #${id.slice(-8).toUpperCase()} — no other partner available. Please reassign manually.`,
          link: `/store/${order.storeId}/orders`,
        }).catch(() => {});
        return NextResponse.json({ partnerStatus: "rejected", assignedToId: null, requiresAttention: true });
      }
    }

    // deliveryStatus and vehicleId updates
    const hasAllowedField = deliveryStatus !== undefined || "vehicleId" in body;
    if (!hasAllowedField)
      return NextResponse.json(
        { error: "Partners can only update deliveryStatus, vehicleId, or partnerAction" },
        { status: 400 }
      );

    // Validate vehicleId exists when being set.
    if (vehicleId != null) {
      const vehicle = await (prisma as any).vehicle.findUnique({
        where: { id: vehicleId },
        select: { id: true },
      });
      if (!vehicle)
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (deliveryStatus !== undefined) data.deliveryStatus = deliveryStatus;
    if ("vehicleId" in body) data.vehicleId = vehicleId ?? null;

    // Auto-set partnerStatus on terminal states
    if (deliveryStatus === "delivered") {
      data.vehicleId = null;
      data.partnerStatus = "completed";
    } else if (deliveryStatus === "cancelled") {
      data.vehicleId = null;
      data.partnerStatus = null;
    }

    const updated = await (prisma.order as any).update({ where: { id }, data });
    return NextResponse.json(updated);
  }

  // ── Owner actions ──────────────────────────────────────────────────────────

  // Owner delivers the order themselves — appears in their own /earn/deliveries dashboard
  if (partnerAction === "self_assign") {
    const updated = await (prisma.order as any).update({
      where: { id },
      data: { assignedToId: user.id, partnerStatus: "accepted" },
    });
    createNotification({
      userId: user.id,
      type: "order_assigned",
      title: "Delivery assigned to you",
      body: `Order #${id.slice(-8).toUpperCase()} — ₹${updated.agreedAmount ?? updated.total}`,
      link: "/earn/deliveries",
    }).catch(() => {});
    return NextResponse.json(updated);
  }

  // Assign an internal delivery block (and its employee) to a sub-order
  if (partnerAction === "assign_block") {
    const { blockId } = body as { blockId?: string };
    if (!blockId) return NextResponse.json({ error: "blockId required" }, { status: 400 });

    const block = await prisma.storeBlock.findUnique({
      where:  { id: blockId },
      select: {
        id:             true,
        title:          true,
        serviceType:    true,
        assignedUserId: true,
        price:          true,
        section:        { select: { storeId: true } },
      },
    });
    if (!block) return NextResponse.json({ error: "Block not found" }, { status: 404 });
    if (block.serviceType !== "delivery")
      return NextResponse.json({ error: "Not a delivery block" }, { status: 400 });

    // Fetch current items so we can update the first item's blockId/title
    const currentOrder = await (prisma as any).order.findUnique({
      where:  { id },
      select: { items: true, agreedAmount: true, total: true },
    });
    const currentItems = (currentOrder?.items as any[]) ?? [];
    const updatedItems =
      currentItems.length > 0
        ? currentItems.map((item: any, idx: number) =>
            idx === 0 ? { ...item, blockId: block.id, title: block.title } : item
          )
        : [{ blockId: block.id, title: block.title, quantity: 1, price: currentOrder?.agreedAmount ?? currentOrder?.total ?? 0 }];

    const updated = await (prisma as any).order.update({
      where: { id },
      data: {
        assignedToId:   blockId,   // block used as internal delivery reference
        partnerStatus:  "accepted",
        deliveryStatus: "processing",
        items:          updatedItems,
      },
    });

    // Notify the assigned employee if one is set on the block
    if (block.assignedUserId) {
      await createNotification({
        userId: block.assignedUserId,
        type:   "order_assigned",
        title:  "Delivery assigned to you",
        body:   `Order #${id.slice(-8).toUpperCase()} — ₹${updated.agreedAmount ?? updated.total}`,
        link:   "/earn/deliveries",
      });
    }

    return NextResponse.json(updated);
  }

  // Validate vehicleId exists when being set.
  if (vehicleId != null) {
    const vehicle = await (prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true },
    });
    if (!vehicle)
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  // Validate assignedToId if being set.
  if (assignedToId != null) {
    const collab = await prisma.collaboration.findUnique({
      where: { id: assignedToId },
      select: { status: true, requesterId: true, receiverId: true },
    });
    if (!collab)
      return NextResponse.json({ error: "Collaboration not found" }, { status: 404 });
    if (collab.status !== "accepted")
      return NextResponse.json({ error: "Collaboration is not accepted" }, { status: 400 });
    const storePageId = order.store.pageId;
    if (storePageId !== collab.requesterId && storePageId !== collab.receiverId)
      return NextResponse.json(
        { error: "Collaboration does not belong to this store's page" },
        { status: 400 }
      );
  }

  const data: Record<string, unknown> = {};
  if (deliveryStatus !== undefined) data.deliveryStatus = deliveryStatus;

  if ("assignedToId" in body) {
    data.assignedToId = assignedToId ?? null;
    // Setting a partner → mark as awaiting acceptance; clearing → reset
    data.partnerStatus = assignedToId != null ? "assigned" : null;
  }

  if ("deliveryNote" in body) data.deliveryNote = deliveryNote ?? null;
  if ("vehicleId" in body) data.vehicleId = vehicleId ?? null;

  // Cleanup on terminal delivery states
  if (deliveryStatus === "delivered" || deliveryStatus === "cancelled") {
    data.vehicleId = null;
    data.partnerStatus = null;
  }

  const updated = await (prisma.order as any).update({ where: { id }, data });
  return NextResponse.json(updated);
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await (prisma.order as any).findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      deliveryStatus: true,
      partnerStatus: true,
      assignedToId: true,
      deliveryNote: true,
      vehicleId: true,
      items: true,
      total: true,
      createdAt: true,
      address: {
        select: {
          name: true, phone: true, line1: true,
          city: true, state: true, pincode: true,
        },
      },
      store: { select: { ownerId: true, pageId: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner  = order.store.ownerId === user.id;
  const isBuyer  = order.userId === user.id;
  const { isPartner, collab } = await resolveAssignedCollab(
    order.assignedToId,
    order.store.pageId,
    user.id
  );

  if (!isOwner && !isPartner && !isBuyer)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignedCollab = collab
    ? {
        id: collab.id,
        role: collab.role,
        status: collab.status,
        requesterId: collab.requesterId,
        receiverId:  collab.receiverId,
        requester: { title: collab.requester.title, pageType: collab.requester.pageType },
        receiver:  { title: collab.receiver.title,  pageType: collab.receiver.pageType  },
      }
    : null;

  const invRow = await prisma.$queryRaw<{ invoiceSignedUrl: string | null }[]>`
    SELECT "invoiceSignedUrl" FROM "Order" WHERE id = ${id} LIMIT 1
  `;
  const invoiceSignedUrl = invRow[0]?.invoiceSignedUrl ?? null;

  const { store: _s, userId: _u, ...orderData } = order;
  return NextResponse.json({ ...orderData, invoiceSignedUrl, assignedCollab });
}
