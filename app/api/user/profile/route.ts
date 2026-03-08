import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(req: Request) {
  try {
    const user = await getServerUser(req);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "unauthenticated" },
        { status: 401 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({
      ok: true,
      profile: profile ?? null,
    });
  } catch (err) {
    console.error("GET /api/user/profile error:", err);

    return NextResponse.json(
      { ok: false, error: "server_error" },
      { status: 500 }
    );
  }
}