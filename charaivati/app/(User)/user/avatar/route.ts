// app/api/user/avatar/route.ts
import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma"; // use named import if your prisma exports named
import getServerUser from "@/lib/serverAuth";

export const runtime = "node"; // important for formidable to work

// we import formidable dynamically to be resilient to ESM/CJS shapes
async function makeFormidable() {
  // dynamic import so bundler picks right module shape
  const mod = await import("formidable");
  // modern API: callable function `formidable(options)` returns parser
  if (typeof mod.default === "function") {
    return mod.default;
  }
  // older API: has named IncomingForm constructor
  if (mod.IncomingForm) {
    return mod;
  }
  // fallback: return module itself and handle below
  return mod;
}

function parseForm(formModule: any, req: Request, options: any = {}) {
  // returns Promise<{ fields, files }>
  return new Promise<{ fields: any; files: any }>(async (resolve, reject) => {
    try {
      // If module is a callable (modern API)
      if (typeof formModule === "function") {
        const form = formModule(options);
        // formidable expects Node IncomingMessage; in Node runtime Next.js route provides a req-like object, so cast
        // @ts-ignore
        form.parse(req as any, (err: any, fields: any, files: any) => (err ? reject(err) : resolve({ fields, files })));
        return;
      }

      // If module has IncomingForm constructor (older API)
      if (formModule.IncomingForm) {
        // @ts-ignore
        const f = new formModule.IncomingForm({ multiples: false, ...options });
        // @ts-ignore
        f.parse(req as any, (err: any, fields: any, files: any) => (err ? reject(err) : resolve({ fields, files })));
        return;
      }

      return reject(new Error("Unsupported formidable module shape"));
    } catch (err) {
      reject(err);
    }
  });
}

export async function POST(req: Request) {
  try {
    // authenticate user
    const user = await getServerUser(req);
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

    // dynamic import of formidable
    const formModule = await makeFormidable();

    // parse multipart form
    const { files } = await parseForm(formModule, req, { maxFileSize: 5 * 1024 * 1024 });

    const file = Array.isArray(files?.avatar) ? files.avatar[0] : files?.avatar;
    if (!file) return NextResponse.json({ error: "no-file" }, { status: 400 });

    // allowed mime types check
    const mime = (file as any).mimetype || (file as any).type || "";
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(mime)) return NextResponse.json({ error: "invalid_type" }, { status: 400 });

    // read file buffer - formidable provides filepath on disk
    const buffer = await fs.readFile((file as any).filepath);

    // resize & convert to webp
    const resized = await sharp(buffer).resize(512, 512, { fit: "cover" }).webp({ quality: 80 }).toBuffer();

    // S3 upload
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const key = `users/avatars/${user.id}-${Date.now()}.webp`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: resized,
        ContentType: "image/webp",
        ACL: "public-read",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const avatarUrl = process.env.S3_CDN_HOST
      ? `${process.env.S3_CDN_HOST.replace(/\/$/, "")}/${key}`
      : `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    // delete old avatar if existed
    if (user.avatarStorageKey) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: user.avatarStorageKey }));
      } catch (e) {
        console.warn("old avatar deletion failed", e);
      }
    }

    // update db
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl, avatarStorageKey: key, avatarAt: new Date() },
    });

    return NextResponse.json({ ok: true, avatarUrl });
  } catch (err: any) {
    console.error("avatar upload error:", err);
    // If the error is from formidable API mismatch, give helpful message
    if (String(err).includes("IncomingForm") || String(err).toLowerCase().includes("formidable")) {
      return NextResponse.json({ error: "server form parser error: " + String(err) }, { status: 500 });
    }
    return NextResponse.json({ error: err?.message || "upload error" }, { status: 500 });
  }
}
