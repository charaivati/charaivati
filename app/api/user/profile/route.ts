import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(req: Request) {
  const user = await getServerUser(req);

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({
    ok: true,
    profile,
  });
}

export async function PATCH(req: Request) {
  try {
    const user = await getServerUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const updated = await prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...body },
      update: body,
    });

    return NextResponse.json({
      ok: true,
      profile: updated,
    });
  } catch (err) {
    console.error("Profile update error:", err);

    return NextResponse.json(
      { ok: false },
      { status: 500 }
    );
  }
}