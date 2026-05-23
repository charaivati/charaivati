import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function PATCH(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { ids?: string[]; all?: boolean };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notifClient = (prisma as any).notification;

  if (body.all) {
    await notifClient.updateMany({
      where: { userId: user.id, read: false },
      data:  { read: true },
    });
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    await notifClient.updateMany({
      where: { id: { in: body.ids }, userId: user.id },
      data:  { read: true },
    });
  }

  return NextResponse.json({ ok: true });
}
