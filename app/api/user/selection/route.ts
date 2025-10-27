// app/api/user/selection/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromReq, verifySessionToken } from "@/lib/auth"; // adapt to your actual helpers

type CurrentUser = {
  id: string;
  email?: string | null;
  // add other fields you expect
};

export async function POST(req: Request) {
  try {
    // Example: get token from cookie/header (use your existing helper if present)
    const token = getTokenFromReq(req as any);
    if (!token) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

    const session = verifySessionToken(token);
    if (!session) return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });

    const currentUser: CurrentUser = { id: session.id, email: session.email };

    // Now use currentUser.id (not userId)
    const body = await req.json();
    // Sample selection logic — adjust fields as needed
    const selection = body.selection ?? null;

    // persist as appropriate
    await prisma.user.update({ where: { id: currentUser.id }, data: { preferredLanguage: selection } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("/api/user/selection error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
