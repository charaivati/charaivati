// app/api/user/magic-link/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMagicToken } from "@/lib/auth";
import sendEmail from "@/lib/sendEmail";

function sanitizeRedirect(path: string) {
  // allow only relative paths that start with '/'
  if (!path || typeof path !== "string") return "/login";
  try {
    const u = new URL(path, "https://example.com"); // will parse relative path
    if (u.origin !== "https://example.com") return "/login";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/login";
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawEmail = body?.email;
    const email = rawEmail ? String(rawEmail).trim().toLowerCase() : "";
    if (!email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

    const token = createMagicToken(user.id);

    // Robust origin resolution:
    const base =
      process.env.BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.APP_ORIGIN ||
      // fallback to request host (works in many hosting environments)
      (() => {
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
        const proto = req.headers.get("x-forwarded-proto") || req.headers.get("x-forwarded-protocol") || "https";
        return host ? `${proto}://${host}` : "http://localhost:3000";
      })();

    const redirectPath = sanitizeRedirect(body?.redirect ?? "/login");

    // Construct the final link using URL API
    const link = new URL("/api/user/magic", base);
    link.searchParams.set("token", token);
    link.searchParams.set("redirect", redirectPath);

    const to: string = (user.email ?? email) as string;
    await sendEmail({
      to,
      subject: "Your magic sign-in link",
      text: `Click to login: ${link.toString()}`,
      html: `<p>Click to login: <a href="${link.toString()}">${link.toString()}</a></p>`,
    });

    return NextResponse.json({ ok: true, message: "Magic link sent." });
  } catch (err) {
    console.error("magic-link error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
