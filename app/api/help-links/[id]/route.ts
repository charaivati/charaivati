// app/api/help-links/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

function isAdmin(user: any | null) {
  if (!user || !user.email) return false;
  const env = (process.env.EMAIL_USER || "").toLowerCase();
  return env && user.email.toLowerCase() === env;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req);
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });

    const id = params.id;
    const body = await req.json();
    const allowed = ["pageSlug", "country", "title", "url", "notes"];
    const data: any = {};
    for (const k of allowed) {
      if (k in body) data[k] = body[k];
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });

    const updated = await prisma.helpLink.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    console.error("PATCH /api/help-links/[id]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req);
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });

    const id = params.id;
    await prisma.helpLink.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /api/help-links/[id]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
