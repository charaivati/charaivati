import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { userId: true, storeId: true, invoiceUrl: true, invoiceSignedUrl: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const store = await db.store.findUnique({
    where: { id: order.storeId },
    select: { ownerId: true },
  });

  const isBuyer = order.userId === user.id;
  const isOwner = store?.ownerId === user.id;
  if (!isBuyer && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hasInvoice = !!(order.invoiceSignedUrl || order.invoiceUrl);
  if (!hasInvoice) return NextResponse.json({ error: "No invoice available" }, { status: 404 });

  // Compute public_id directly — parsing the stored URL is fragile because
  // authenticated assets use /raw/authenticated/{sig}/v{ver}/... not /raw/upload/
  // The upload always uses folder:"invoices" (or "invoices/signed") + public_id:orderId
  const publicId = order.invoiceSignedUrl
    ? `invoices/signed/${orderId}_signed`
    : `invoices/${orderId}`;

  const signedUrl = cloudinary.utils.private_download_url(publicId, "", {
    resource_type: "raw",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 60,
  });

  const cloudRes = await fetch(signedUrl);

  if (!cloudRes.ok) {
    const body = await cloudRes.text();
    console.error("[invoice-download] signed fetch failed:", cloudRes.status, body.slice(0, 500));

    if (cloudRes.status === 404) {
      // Asset no longer exists on Cloudinary — clear so it can regenerate
      await db.order.update({
        where: { id: orderId },
        data: { invoiceUrl: null, invoiceNumber: null, invoiceGenAt: null, invoiceType: null },
      });
      return NextResponse.json({ error: "Invoice expired, please regenerate" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });
  }

  const buffer = await cloudRes.arrayBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${orderId}.pdf"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
