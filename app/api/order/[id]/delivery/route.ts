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
      requester:    { select: { id: true, title: true, pageType: true, ownerId: true } },
      receiverPage: { select: { id: true, title: true, pageType: true, ownerId: true } },
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
    collab.requesterId === storePageId ? collab.receiverPage : collab.requester;
  return { isPartner: (partnerPage?.ownerId ?? null) === userId, collab };
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

  const order = await (prisma as any).order.findUnique({
    where: { id },
    select: {
      userId: true,
      assignedToId: true,
      assignedToUserId: true,
      deliveryStatus: true,
      items: true,
      store: { select: { ownerId: true, pageId: true, deletedAt: true } },
      user: { select: { status: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Zombie-prevention guard (COLLAB-ZOMBIE-CHECK): a deleted store can have no
  // further delivery actions performed against its orders by anyone.
  if (order.store.deletedAt) {
    return NextResponse.json({ error: "This store has been deleted — no further delivery actions are possible." }, { status: 409 });
  }

  const isOwner = order.store.ownerId === user.id;
  const { isPartner } = isOwner
    ? { isPartner: false }
    : await resolveAssignedCollab(order.assignedToId, order.store.pageId, user.id);

  // Direct employee: assigned via assignedToUserId (user-type team member, not the owner)
  const isDirectEmployee = !isOwner && !isPartner && order.assignedToUserId === user.id;

  // Owner-as-partner: store owner is also the delivery person assigned via assignedToUserId.
  // assignNextPartner writes assignedToUserId (not assignedToId) for user-type WSA collabs so
  // the deliveries page rawPersonalOrders query finds the order. The owner can accept/reject
  // from /earn/deliveries just like an external partner would.
  const isOwnerAsPartner = isOwner && order.assignedToUserId === user.id;

  // Block-assigned employee: item JSON references a delivery block with assignedUserId = user.id
  let isBlockEmployee = false;
  if (!isOwner && !isPartner && !isDirectEmployee) {
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

  if (!isOwner && !isPartner && !isBlockEmployee && !isDirectEmployee)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { deliveryStatus, assignedToId, deliveryNote, vehicleId, partnerAction } = body;

  if (deliveryStatus !== undefined && !DELIVERY_STATUSES.includes(deliveryStatus))
    return NextResponse.json({ error: "Invalid deliveryStatus" }, { status: 400 });

  // ── Complete delivery — universal (owner, collab partner, direct employee, block employee) ──
  if (partnerAction === "complete") {
    const updated = await (prisma as any).order.update({
      where: { id },
      data: { partnerStatus: "completed", vehicleId: null },
    });

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

  // ── Partner / direct-employee / block-employee / owner-as-partner actions ─
  // isOwnerAsPartner only enters this block for explicit partner actions (accept/reject)
  // or vehicleId (GPS start) — all other owner fields (deliveryNote, deliveryStatus, etc.)
  // fall through to the owner section below.
  if ((isOwnerAsPartner && (partnerAction != null || "vehicleId" in body)) ||
      ((isPartner || isBlockEmployee || isDirectEmployee) && !isOwner)) {
    // Accept / Reject — collab partners, direct employees, and owner-as-partner
    if (isPartner || isDirectEmployee || isOwnerAsPartner) {
      if (partnerAction === "accept") {
        const updated = await (prisma as any).order.update({
          where: { id },
          data: { partnerStatus: "accepted" },
        });
        return NextResponse.json(updated);
      }

      if (partnerAction === "reject") {
        if (isDirectEmployee) {
          // Clear the direct-user assignment; owner must reassign manually
          await (prisma as any).order.update({
            where: { id },
            data: { assignedToUserId: null, partnerStatus: null, requiresAttention: true },
          });
          createNotification({
            userId: order.store.ownerId,
            type: "workflow_attention",
            title: "Team member rejected delivery",
            body: `Order #${id.slice(-8).toUpperCase()} — assigned employee rejected. Please reassign.`,
            link: `/store/${order.storeId}/orders`,
          }).catch(() => {});
          return NextResponse.json({ partnerStatus: null, assignedToUserId: null, requiresAttention: true });
        }

        if (isOwnerAsPartner) {
          // Owner rejected their own self-delivery — cycle to the next WSA partner.
          // Use the delivery-step OSP directly (assignedToId is null in this path).
          const ospRows = await prisma.$queryRaw<{ stepId: string; ospId: string }[]>`
            SELECT osp."stepId", osp.id AS "ospId"
            FROM "OrderStepProgress" osp
            JOIN "WorkflowStep" ws ON ws.id = osp."stepId"
            WHERE osp."orderId" = ${id}
              AND ws."activityType" = 'delivery'
            ORDER BY ws."sequence" DESC
            LIMIT 1
          `;
          const deliveryStepId = ospRows[0]?.stepId;
          const deliveryOspId  = ospRows[0]?.ospId;

          await (prisma as any).order.update({
            where: { id },
            data: { assignedToUserId: null, partnerStatus: "rejected" },
          });

          if (deliveryStepId && deliveryOspId) {
            const result = await assignNextPartner({
              orderId: id,
              stepId:  deliveryStepId,
              ospId:   deliveryOspId,
            });
            if (result.escalated)
              return NextResponse.json({ partnerStatus: "rejected", assignedToUserId: null, requiresAttention: true });
            if (result.assigned)
              return NextResponse.json({ partnerStatus: "assigned", cycled: true });
          }

          await (prisma as any).order.update({ where: { id }, data: { requiresAttention: true } });
          createNotification({
            userId: order.store.ownerId,
            type: "workflow_attention",
            title: "Delivery self-rejected",
            body: `Order #${id.slice(-8).toUpperCase()} — no other delivery partner available. Please reassign.`,
            link: `/store/orders/all`,
          }).catch(() => {});
          return NextResponse.json({ partnerStatus: "rejected", assignedToUserId: null, requiresAttention: true });
        }

        // Collab partner reject — cycle to next assignee.
        // Delivery-step OSPs are already "confirmed" by dispatch time (set in
        // confirm/route.ts before assignNextPartner runs), so a status:"active"
        // lookup always misses. Derive the step from the dispatched collaboration
        // (order.assignedToId, captured above before it's nulled) and look up the
        // OSP via its unique (orderId, stepId) key instead. OSP status is
        // intentionally NOT restored to "active" — assignNextPartner is status-agnostic.
        const stepRows = await prisma.$queryRaw<{ stepId: string }[]>`
          SELECT wsa."stepId"
          FROM "WorkflowStepAssignee" wsa
          JOIN "WorkflowStep" ws ON ws.id = wsa."stepId"
          WHERE wsa."collaborationId" = ${order.assignedToId}
            AND ws."activityType" = 'delivery'
          ORDER BY ws."sequence" DESC
          LIMIT 1
        `;
        const stepId = stepRows[0]?.stepId;
        const activeOSP = stepId
          ? await prisma.orderStepProgress.findUnique({
              where: { orderId_stepId: { orderId: id, stepId } },
              select: { id: true, stepId: true },
            })
          : null;

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

    // When a direct employee or owner-as-partner starts GPS (sets vehicleId), auto-advance
    // deliveryStatus to "out_for_delivery" so the customer's tracking map activates.
    const NON_DELIVERY_STATUSES = new Set(["pending", "confirmed", "processing"]);
    if (
      (isDirectEmployee || isOwnerAsPartner) &&
      "vehicleId" in body &&
      vehicleId != null &&
      deliveryStatus === undefined &&
      NON_DELIVERY_STATUSES.has(order.deliveryStatus ?? "")
    ) {
      data.deliveryStatus = "out_for_delivery";
    }

    if (deliveryStatus === "delivered" || data.deliveryStatus === "delivered") {
      data.vehicleId = null;
      data.partnerStatus = "completed";
    } else if (deliveryStatus === "cancelled" || data.deliveryStatus === "cancelled") {
      data.vehicleId = null;
      data.partnerStatus = null;
    }

    const updated = await (prisma as any).order.update({ where: { id }, data });

    // Fire buyer notification for any path that results in out_for_delivery
    const effectiveDeliveryStatus = (data.deliveryStatus as string | undefined) ?? deliveryStatus;
    if (effectiveDeliveryStatus === "out_for_delivery" && order.userId && order.user?.status !== "guest") {
      createNotification({
        userId: order.userId,
        type: "out_for_delivery",
        title: "Order out for delivery",
        body: `Your order #${id.slice(-6).toUpperCase()} is on its way!`,
        link: `/order/${id}/track`,
      }).catch(() => {});
    }

    return NextResponse.json(updated);
  }

  // ── Owner actions ──────────────────────────────────────────────────────────

  if (partnerAction === "self_assign") {
    const updated = await (prisma as any).order.update({
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
        assignedToId:   blockId,
        partnerStatus:  "accepted",
        deliveryStatus: "processing",
        items:          updatedItems,
      },
    });

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

  // ── Owner: assign to a team member user directly ───────────────────────────
  if ("userId" in body) {
    const targetUserId = (body as { userId: string | null }).userId;

    if (targetUserId != null) {
      const storePageId = order.store.pageId;
      // Verify this user is an accepted team-scope member of the initiative
      const teamCollab = await prisma.collaboration.findFirst({
        where: {
          requesterId:    storePageId ?? undefined,
          receiverUserId: targetUserId,
          scope:          "team",
          status:         "accepted",
        },
        select: { id: true },
      });
      if (!teamCollab)
        return NextResponse.json(
          { error: "User is not an accepted team member of this initiative" },
          { status: 400 }
        );
    }

    const updated = await (prisma as any).order.update({
      where: { id },
      data: {
        assignedToUserId: targetUserId ?? null,
        assignedToId:     null,           // clear any collab-based assignment
        partnerStatus:    targetUserId != null ? (targetUserId === user.id ? "accepted" : "assigned") : null,
      },
    });

    if (targetUserId) {
      createNotification({
        userId: targetUserId,
        type:   "order_assigned",
        title:  "Delivery assigned to you",
        body:   `Order #${id.slice(-8).toUpperCase()} from ${order.store.pageId ?? "store"}`,
        link:   "/earn/deliveries",
      }).catch(() => {});
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

  // Validate assignedToId (collab-based partner assignment) if being set.
  let assignedPartnerOwnerId: string | null = null;
  if (assignedToId != null) {
    const collab = await fetchCollab(assignedToId);
    if (!collab)
      return NextResponse.json({ error: "Collaboration not found" }, { status: 404 });
    if (collab.status !== "accepted")
      return NextResponse.json({ error: "Collaboration is not accepted" }, { status: 400 });
    const storePageId = order.store.pageId;
    if (storePageId !== collab.requesterId && storePageId !== collab.receiverPageId)
      return NextResponse.json(
        { error: "Collaboration does not belong to this store's page" },
        { status: 400 }
      );
    const partnerPage =
      collab.requesterId === storePageId ? collab.receiverPage : collab.requester;
    assignedPartnerOwnerId = partnerPage?.ownerId ?? null;
  }

  const data: Record<string, unknown> = {};
  if (deliveryStatus !== undefined) data.deliveryStatus = deliveryStatus;

  if ("assignedToId" in body) {
    data.assignedToId     = assignedToId ?? null;
    data.assignedToUserId = null;   // clear any user-type assignment
    data.partnerStatus    = assignedToId != null ? "assigned" : null;
  }

  if ("deliveryNote" in body) data.deliveryNote = deliveryNote ?? null;
  if ("vehicleId" in body) data.vehicleId = vehicleId ?? null;

  if (deliveryStatus === "delivered" || deliveryStatus === "cancelled") {
    data.vehicleId    = null;
    data.partnerStatus = null;
  }

  const updated = await (prisma as any).order.update({ where: { id }, data });

  if ("assignedToId" in body && assignedToId != null && assignedPartnerOwnerId) {
    createNotification({
      userId: assignedPartnerOwnerId,
      type:   "order_assigned",
      title:  "Delivery assigned to you",
      body:   `Order #${id.slice(-8).toUpperCase()} from ${order.store.pageId ?? "store"}`,
      link:   "/earn/deliveries",
    }).catch(() => {});
  }

  if (deliveryStatus === "out_for_delivery" && order.userId && order.user?.status !== "guest") {
    createNotification({
      userId: order.userId,
      type: "out_for_delivery",
      title: "Order out for delivery",
      body: `Your order #${id.slice(-6).toUpperCase()} is on its way!`,
      link: `/order/${id}/track`,
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await (prisma as any).order.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      deliveryStatus: true,
      partnerStatus: true,
      assignedToId: true,
      assignedToUserId: true,
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
  const isDirectEmployee = order.assignedToUserId === user.id;

  if (!isOwner && !isPartner && !isBuyer && !isDirectEmployee)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignedCollab = collab
    ? {
        id:          collab.id,
        role:        collab.role,
        status:      collab.status,
        requesterId: collab.requesterId,
        receiverPageId: collab.receiverPageId,
        requester:    { title: collab.requester.title,    pageType: collab.requester.pageType },
        receiverPage: collab.receiverPage
          ? { title: collab.receiverPage.title, pageType: collab.receiverPage.pageType }
          : null,
      }
    : null;

  const invRow = await prisma.$queryRaw<{ invoiceSignedUrl: string | null }[]>`
    SELECT "invoiceSignedUrl" FROM "Order" WHERE id = ${id} LIMIT 1
  `;
  const invoiceSignedUrl = invRow[0]?.invoiceSignedUrl ?? null;

  const { store: _s, userId: _u, ...orderData } = order;
  return NextResponse.json({ ...orderData, invoiceSignedUrl, assignedCollab });
}
