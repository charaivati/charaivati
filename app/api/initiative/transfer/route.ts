import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

// GET /api/initiative/transfer — list completed transfers where the caller can still revoke
export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const transfers = await prisma.initiativeTransfer.findMany({
    where: {
      fromUserId: user.id,
      status: "completed",
      revokeDeadline: { gt: new Date() },
    },
    select: {
      id: true,
      pageId: true,
      toEmail: true,
      completedAt: true,
      revokeDeadline: true,
      page: { select: { title: true, pageType: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  return NextResponse.json({ transfers });
}
