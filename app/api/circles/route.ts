// app/api/circles/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const DEFAULT_CIRCLES = [
  { label: "Family",        color: "amber", isDefault: true },
  { label: "Close Friends", color: "teal",  isDefault: true },
];

const memberSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  profile: { select: { displayName: true } },
};

/** Ensure the two default circles exist for this user, return all circles. */
async function ensureDefaults(ownerId: string) {
  const existing = await db.friendCircle.findMany({ where: { ownerId } });
  if (existing.length === 0) {
    await db.friendCircle.createMany({
      data: DEFAULT_CIRCLES.map((c) => ({ ...c, ownerId })),
    });
  }
}

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  await ensureDefaults(user.id);

  const circles = await db.friendCircle.findMany({
    where: { ownerId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      members: {
        include: { user: { select: memberSelect } },
        orderBy: { addedAt: "asc" },
      },
    },
  });

  return NextResponse.json({ ok: true, circles });
}

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const label = String(body.label ?? "").trim();
  const color = String(body.color ?? "blue").trim();

  if (!label) return NextResponse.json({ ok: false, error: "Label required" }, { status: 400 });

  const circle = await db.friendCircle.create({
    data: { ownerId: user.id, label, color, isDefault: false },
    include: { members: { include: { user: { select: memberSelect } } } },
  });

  return NextResponse.json({ ok: true, circle }, { status: 201 });
}
