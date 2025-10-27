// app/api/user/magic-link/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMagicToken } from "@/lib/auth";
import sendEmail from "@/lib/sendEmail";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate incoming email early
    const rawEmail = body?.email;
    const email = rawEmail ? String(rawEmail).trim().toLowerCase() : "";
    if (!email) {
      return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    // create token and magic link
    const token = createMagicToken(user.id);
    const base = process.env.BASE_URL || "http://localhost:3000";
    const link = `${base}/api/user/magic?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent("/login")}`;

    // Ensure we pass a definite string to sendEmail
    const to: string = (user.email ?? email) as string;
    try {
      await sendEmail({
        to,
        subject: "Your magic sign-in link",
        text: `Click to login: ${link}`,
        html: `<p>Click to login: <a href="${link}">${link}</a></p>`,
      });
    } catch (e) {
      console.error("Magic link email failed:", e);
      // In dev it's useful to return the token so you can click the link.
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
