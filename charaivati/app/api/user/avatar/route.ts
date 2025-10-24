// app/api/user/avatar/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

import { verifySessionToken } from "@/lib/auth"; // your JWT helpers
import { prisma } from "@/lib/prisma"; // ensure this path matches your project

export const dynamic = "force-dynamic"; // ensure server handling

function parseCookiesFromHeader(cookieHeader?: string | null) {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  cookieHeader.split(";").map(s => s.trim()).filter(Boolean).forEach(pair => {
    const [k, ...rest] = pair.split("=");
    map[k] = decodeURIComponent(rest.join("="));
  });
  return map;
}

export async function POST(req: Request) {
  try {
    // --- 1) Read cookies from Request headers ---
    const cookieHeader = req.headers.get("cookie") ?? null;
    const cookies = parseCookiesFromHeader(cookieHeader);
    const session = cookies["session"] ?? null;

    // helpful debug log (server console)
    console.log("[avatar] incoming cookieHeader:", cookieHeader ? "(present)" : "(none)");

    // --- 2) Verify JWT session token ---
    if (!session) {
      console.warn("[avatar] no session cookie present");
      return NextResponse.json({ error: "unauthenticated - no session cookie" }, { status: 401 });
    }

    const payload = verifySessionToken(session);
    if (!payload || !payload.sub) {
      console.warn("[avatar] session token invalid or expired", { payload });
      return NextResponse.json({ error: "unauthenticated - invalid session token" }, { status: 401 });
    }

    const userId = payload.sub;
    // --- 3) Load user from DB ---
    const user = await prisma.user.findUnique({ where: { id: userId }});
    if (!user) {
      console.warn("[avatar] no user found for sub:", userId);
      return NextResponse.json({ error: "unauthenticated - user not found" }, { status: 401 });
    }

    // --- 4) Parse multipart form via Request.formData() (works in App Router) ---
    const form = await req.formData();
    // field name used by client code earlier was 'avatar' (adjust if you used different)
    const file = form.get("avatar") as File | null;
    if (!file) {
      console.warn("[avatar] no file found in formData");
      return NextResponse.json({ error: "no-file" }, { status: 400 });
    }

    // --- 5) Convert to buffer and resize (sharp) ---
    const arrayBuf = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    // optional: validate mime type by File.type
    const mime = (file as any).type ?? "";
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (mime && !allowed.includes(mime)) {
      return NextResponse.json({ error: "invalid_type", details: mime }, { status: 400 });
    }

    const resized = await sharp(buf).resize(512, 512, { fit: "cover" }).webp({ quality: 80 }).toBuffer();

    // --- 6) Save to local public/uploads/avatars ---
    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await fs.mkdir(uploadDir, { recursive: true });

    // delete previous local avatar (if exists)
    if (user.avatarStorageKey) {
      try {
        const oldPath = path.join(uploadDir, user.avatarStorageKey);
        await fs.unlink(oldPath).catch(() => {});
      } catch (e) {
        console.warn("[avatar] old file delete failed", e);
      }
    }

    const filename = `${user.id}-${Date.now()}.webp`;
    const destPath = path.join(uploadDir, filename);
    await fs.writeFile(destPath, resized);

    const avatarUrl = `/uploads/avatars/${filename}`;

    // --- 7) Update DB ---
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl, avatarStorageKey: filename, avatarAt: new Date() },
    });

    console.log("[avatar] uploaded for user", user.id, "->", avatarUrl);
    return NextResponse.json({ ok: true, avatarUrl });
  } catch (err: any) {
    console.error("[avatar] unexpected error:", err);
    return NextResponse.json({ error: "server-error", details: String(err) }, { status: 500 });
  }
}
