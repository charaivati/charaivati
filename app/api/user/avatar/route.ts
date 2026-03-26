import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import formidable from "formidable";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Parse cookies and verify session
    const cookieHeader = req.headers.get("cookie") ?? "";
    const cookies = Object.fromEntries(cookieHeader.split(";").map(c => {
      const [k, ...v] = c.split("=");
      return [k.trim(), decodeURIComponent(v.join("="))];
    }));
    const session = cookies["session"];
    const verified = verifySessionToken(session);
    if (!verified?.id) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (verified.role === "guest") {
      return NextResponse.json({ error: "guest_readonly" }, { status: 403 });
    }

    // Convert request to Node stream (needed for formidable)
    const form = formidable({ multiples: false, maxFileSize: 5 * 1024 * 1024 }); // 5 MB max
    const [fields, files] = await form.parse(await (req as any).arrayBuffer());

    const file = files.avatar?.[0];
    if (!file) {
      return NextResponse.json({ error: "no file uploaded" }, { status: 400 });
    }

    const buffer = await fs.readFile(file.filepath);
    const resized = await sharp(buffer)
      .resize(512, 512)
      .webp({ quality: 80 })
      .toBuffer();

    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${verified.id}-${Date.now()}.webp`;
    const destPath = path.join(uploadDir, filename);
    await fs.writeFile(destPath, resized);

    const avatarUrl = `/uploads/avatars/${filename}`;
    await prisma.user.update({
      where: { id: verified.id },
      data: { avatarUrl, avatarStorageKey: filename, avatarAt: new Date() },
    });

    return NextResponse.json({ ok: true, avatarUrl });
  } catch (err: any) {
    console.error("Avatar upload error:", err);
    return NextResponse.json({ error: "server error", details: err.message }, { status: 500 });
  }
}
