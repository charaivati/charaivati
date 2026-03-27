import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie } from "@/lib/session";

function buildGuestName() {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `Guest ${suffix.toUpperCase()}`;
}

export async function POST() {
  try {
    const guest = await prisma.user.create({
      data: {
        name: buildGuestName(),
        status: "guest",
        verified: false,
        emailVerified: false,
      },
      select: { id: true, name: true },
    });

    const token = await createSessionToken({ userId: guest.id, role: "guest" });
    let res = NextResponse.json({ ok: true, guest });
    res = setSessionCookie(res, token);
    return res;
  } catch (error) {
    console.error("[guest-login] failed:", error);
    return NextResponse.json({ ok: false, error: "guest_login_failed" }, { status: 500 });
  }
}
