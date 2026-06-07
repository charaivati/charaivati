import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// Surfaces normal-step process tasks assigned to the current user — the OrderStepProgress
// row IS the task record (status "active" = pending confirmation, "confirmed" = done).
// No sub-order, no deliveryStatus — see TASK-SURFACE-1 Part A.
export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRaw<{
    ospId: string;
    orderId: string;
    stepId: string;
    currentAssigneeId: string | null;
    stepName: string;
    items: unknown;
    total: number;
    createdAt: Date;
    storeId: string;
    storeName: string;
    storeSlug: string | null;
    storePageId: string | null;
  }[]>`
    SELECT osp.id AS "ospId", osp."orderId", osp."stepId", osp."currentAssigneeId",
           ws.name AS "stepName",
           o.items, o.total, o."createdAt",
           s.id AS "storeId", s.name AS "storeName", s.slug AS "storeSlug", s."pageId" AS "storePageId"
    FROM "OrderStepProgress" osp
    JOIN "WorkflowStep" ws ON ws.id = osp."stepId"
    JOIN "Order" o ON o.id = osp."orderId"
    JOIN "Store" s ON s.id = o."storeId"
    WHERE osp.status = 'active'
      AND osp."currentAssigneeId" IS NOT NULL
      AND ws."activityType" = 'normal'
  `;

  if (rows.length === 0) return NextResponse.json([]);

  const assigneeIds = [...new Set(rows.map((r) => r.currentAssigneeId!).filter(Boolean))];
  const wsaRows = await (prisma as any).workflowStepAssignee.findMany({
    where: { id: { in: assigneeIds } },
    select: {
      id: true,
      collaboration: {
        select: {
          requesterId:    true,
          receiverUserId: true,
          requester:      { select: { ownerId: true } },
          receiverPage:   { select: { ownerId: true } },
        },
      },
    },
  });
  const wsaById = new Map((wsaRows as any[]).map((w) => [w.id, w.collaboration]));

  // Resolve each row's WorkflowStepAssignee → the user who would act on it
  // (mirrors assignNormalStep.ts's resolution exactly, keyed off the order's store.pageId)
  function resolvePartnerUserId(collab: any, initiativeId: string | null): string | undefined {
    if (!collab) return undefined;
    if (collab.requesterId === initiativeId) {
      return collab.receiverPage?.ownerId ?? collab.receiverUserId ?? undefined;
    }
    return collab.requester?.ownerId ?? undefined;
  }

  const result = rows
    .filter((r) => {
      if (!r.currentAssigneeId) return false;
      const collab = wsaById.get(r.currentAssigneeId);
      return resolvePartnerUserId(collab, r.storePageId) === user.id;
    })
    .map((r) => {
      const items = (r.items as { title: string; quantity: number }[]) ?? [];
      const summary = items.slice(0, 2).map((i) => `${i.title} ×${i.quantity}`).join(", ")
        + (items.length > 2 ? ` +${items.length - 2} more` : "");
      return {
        ospId:        r.ospId,
        orderId:      r.orderId,
        orderRef:     `#${r.orderId.slice(-8).toUpperCase()}`,
        stepId:       r.stepId,
        stepName:     r.stepName,
        storeName:    r.storeName,
        storeSlug:    r.storeSlug,
        itemsSummary: summary,
        total:        r.total,
        createdAt:    r.createdAt,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json(result);
}
