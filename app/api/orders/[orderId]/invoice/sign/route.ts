import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";
import { createNotification } from "@/lib/notifications/createNotification";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { store: { select: { ownerId: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.store.ownerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!order.invoiceUrl) return NextResponse.json({ error: "Unsigned invoice must be generated first" }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "Only PDF files accepted" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME)!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Server misconfiguration: Cloudinary credentials missing" }, { status: 500 });
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  let uploadResult: any;
  try {
    uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "invoices/signed", public_id: `${orderId}_signed`, resource_type: "raw", type: "authenticated", overwrite: true, invalidate: true },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      const { Readable } = require("stream");
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  } catch (uploadErr) {
    console.error("[invoice/sign] upload FAILED:", uploadErr);
    return NextResponse.json({ error: "PDF upload failed" }, { status: 500 });
  }

  const invoiceSignedUrl: string = uploadResult.secure_url;

  await db.$executeRaw`
    UPDATE "Order" SET "invoiceSignedUrl" = ${invoiceSignedUrl}, "invoiceSignedAt" = NOW()
    WHERE id = ${orderId}
  `;

  createNotification({
    userId: order.userId,
    type: "delivery_complete",
    title: "Your invoice is ready",
    body: `Order #${orderId.slice(-8).toUpperCase()} — signed invoice available to download.`,
    link: `/order/${orderId}/track`,
  }).catch(() => {});

  return NextResponse.json({ invoiceSignedUrl });
}
