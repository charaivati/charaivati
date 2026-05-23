import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collab = await prisma.collaboration.findUnique({
    where: { id },
    select: {
      requester: { select: { ownerId: true } },
      receiver:  { select: { ownerId: true } },
    },
  });
  if (!collab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (collab.requester.ownerId !== user.id && collab.receiver.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { costPerOrder, costPerKg, costPerKgPerKm, costPerItemPerKm } = await req.json();

  const updated = await prisma.collaboration.update({
    where: { id },
    data: {
      ...(costPerOrder     !== undefined && { costPerOrder:     costPerOrder     === null ? null : Number(costPerOrder) }),
      ...(costPerKg        !== undefined && { costPerKg:        costPerKg        === null ? null : Number(costPerKg) }),
      ...(costPerKgPerKm   !== undefined && { costPerKgPerKm:   costPerKgPerKm   === null ? null : Number(costPerKgPerKm) }),
      ...(costPerItemPerKm !== undefined && { costPerItemPerKm: costPerItemPerKm === null ? null : Number(costPerItemPerKm) }),
    },
  });

  return NextResponse.json(updated);
}
