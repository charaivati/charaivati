import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { assignNextPartner } from "@/lib/workflow/assignNextPartner";

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
    select: { assignedToId: true, store: { select: { ownerId: true, pageId: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = order.store.ownerId === user.id;
  const { isPartner } = isOwner
    ? { isPartner: false }
    : await resolveAssignedCollab(order.assignedToId, order.store.pageId, user.id);

  if (!isOwner && !isPartner)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { deliveryStatus, assignedToId, deliveryNote, vehicleId, partnerAction } = body;

  if (deliveryStatus !== undefined && !DELIVERY_STATUSES.includes(deliveryStatus))
    return NextResponse.json({ error: "Invalid deliveryStatus" }, { status: 400 });

  // ── Partner actions ────────────────────────────────────────────────────────
  if (isPartner && !isOwner) {
    // Accept / Reject assignment
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
      return NextResponse.json({ partnerStatus: "rejected", assignedToId: null, requiresAttention: true });
    }

    // Partner marks delivery complete (customer still needs to confirm receipt)
    if (partnerAction === "complete") {
      const updated = await prisma.order.update({
        where: { id },
        data: { partnerStatus: "completed", vehicleId: null },
      });
      return NextResponse.json(updated);
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

  const { store: _s, userId: _u, ...orderData } = order;
  return NextResponse.json({ ...orderData, assignedCollab });
}
