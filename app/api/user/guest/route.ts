import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie, getTokenFromRequest, verifySessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";

function buildGuestName() {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `Guest ${suffix.toUpperCase()}`;
}

function getClientIp(req: Request): string {
  // X-Forwarded-For is set by Vercel; take the first hop (client IP)
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  try {
    // 1. Idempotency guard: if request has a valid session cookie, return existing session
    const token = getTokenFromRequest(req);
    if (token) {
      const payload = await verifySessionToken(token);
      if (payload?.userId) {
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (user) {
          const existingToken = await createSessionToken({ userId: user.id, role: user.status });
          let res = NextResponse.json({ ok: true, guest: { id: user.id, name: user.name } });
          res = setSessionCookie(res, existingToken);
          return res;
        }
      }
    }

    const clientIp = getClientIp(req);

    // 2. IP-based rate limiting: 3 guests per 10 minutes, 20 per day
    const shortLimit = await checkRateLimit(`guest:create:${clientIp}`, 3, 600);
    if (!shortLimit.ok) {
      return NextResponse.json(
        { error: "Too many guest accounts. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const dayLimit = await checkRateLimit(`guest:create:${clientIp}:day`, 20, 86400);
    if (!dayLimit.ok) {
      return NextResponse.json(
        { error: "Daily guest creation limit reached. Please try again tomorrow." },
        { status: 429 }
      );
    }

    // 3. DB backstop: count guests created in last 24h (global cap)
    const guestCap = parseInt(process.env.GUEST_DAILY_CAP || "500", 10);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentGuestCount = await prisma.user.count({
      where: {
        status: "guest",
        createdAt: { gte: oneDayAgo },
      },
    });

    if (recentGuestCount >= guestCap) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    // All checks passed; create guest
    const guest = await prisma.user.create({
      data: {
        name: buildGuestName(),
        status: "guest",
        verified: false,
        emailVerified: false,
      },
      select: { id: true, name: true },
    });

    const newToken = await createSessionToken({ userId: guest.id, role: "guest" });
    let res = NextResponse.json({ ok: true, guest });
    res = setSessionCookie(res, newToken);
    return res;
  } catch (error) {
    console.error("[guest-login] failed:", error);
    return NextResponse.json({ ok: false, error: "guest_login_failed" }, { status: 500 });
  }
}
