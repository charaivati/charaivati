// app/api/user/magic-link/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMagicToken } from "@/lib/auth";
import sendEmail from "@/lib/sendEmail";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const token = createMagicToken(user.id);
    const base = process.env.BASE_URL || "http://localhost:3000";
    const link = `${base}/api/user/magic?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent("/login")}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Your magic sign-in link",
        text: `Click to login: ${link}`,
        html: `<p>Click to login: <a href="${link}">${link}</a></p>`,
      });
    } catch (e) {
      console.error("Magic link email failed:", e);
      return NextResponse.json({
        ok: false,
        error: "Email send failed",
        token, // dev fallback
      });
    }

    return NextResponse.json({ ok: true, message: "Magic link sent." });
  } catch (err) {
    console.error("magic-link error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
