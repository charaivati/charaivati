import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { v2 as cloudinary } from "cloudinary";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";
import { generateInvoiceNumber } from "@/lib/invoice/generateInvoiceNumber";
import { InvoiceDocument } from "@/lib/invoice/InvoiceDocument";
import type { InvoiceDocumentProps } from "@/lib/invoice/InvoiceDocument";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Fetch order
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      store: { select: { id: true, name: true, ownerId: true } },
      user: { select: { id: true, name: true, email: true } },
      address: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // 2. Only store owner can generate invoice
  if (order.store.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Only for delivered orders
  if (order.status !== "delivered") {
    return NextResponse.json({ error: "Invoice can only be generated for delivered orders" }, { status: 400 });
  }

  // 4. Idempotent — return existing URL if already generated
  if (order.invoiceUrl) {
    return NextResponse.json({
      invoiceUrl: order.invoiceUrl,
      invoiceNumber: order.invoiceNumber,
      invoiceType: order.invoiceType,
    });
  }

  // 5. Seller billing profile (linked to this store, owned by owner)
  const sellerProfile = await (db.billingProfile as any).findFirst({
    where: { linkedStoreId: order.storeId, userId: user.id },
  });

  // 6. Buyer billing profile (personal, unlinked, for this user)
  const buyerProfile = await (db.billingProfile as any).findFirst({
    where: { userId: order.userId, linkedStoreId: null },
    orderBy: { createdAt: "asc" },
  });

  // Buyer info: prefer saved profile, then invoiceData from order, then user name
  const orderInvoiceData = order.invoiceData as Record<string, string> | null;
  const buyer: InvoiceDocumentProps["buyer"] = buyerProfile
    ? {
        legalName: buyerProfile.legalName,
        companyName: buyerProfile.companyName ?? undefined,
        gstin: buyerProfile.gstin ?? undefined,
        address: buyerProfile.addressLine ?? undefined,
        city: buyerProfile.city ?? undefined,
        state: buyerProfile.state ?? undefined,
        pinCode: buyerProfile.pinCode ?? undefined,
      }
    : orderInvoiceData?.legalName
    ? {
        legalName: orderInvoiceData.legalName,
        address: orderInvoiceData.addressLine ?? undefined,
        city: orderInvoiceData.city ?? undefined,
        state: orderInvoiceData.state ?? undefined,
        pinCode: orderInvoiceData.pinCode ?? undefined,
      }
    : {
        legalName: order.user.name ?? order.user.email ?? "Customer",
        address: order.address.line1,
        city: order.address.city,
        state: order.address.state,
        pinCode: order.address.pincode,
      };

  // Seller info: prefer billing profile, fallback to store name
  const seller: InvoiceDocumentProps["seller"] = sellerProfile
    ? {
        legalName: sellerProfile.legalName,
        companyName: sellerProfile.companyName ?? undefined,
        gstin: sellerProfile.gstin ?? undefined,
        gstState: sellerProfile.gstState ?? undefined,
        address: sellerProfile.addressLine ?? undefined,
        city: sellerProfile.city ?? undefined,
        state: sellerProfile.state ?? undefined,
        pinCode: sellerProfile.pinCode ?? undefined,
      }
    : { legalName: order.store.name };

  // 7. Invoice type
  const invoiceType: "tax_invoice" | "bill_of_supply" =
    sellerProfile?.gstRegistered ? "tax_invoice" : "bill_of_supply";

  // 8. Line items
  const rawItems = order.items as { title: string; price: number; quantity: number }[];
  const items = rawItems.map((i) => ({
    description: i.title,
    quantity: i.quantity,
    unitPrice: i.price,
    total: i.price * i.quantity,
  }));

  // 9. Totals
  const subtotal = order.total;
  const GST_RATE = 18;
  const gstAmount = invoiceType === "tax_invoice" ? Math.round(subtotal * GST_RATE) / 100 : undefined;
  const grandTotal = subtotal + (gstAmount ?? 0);

  // 10. Invoice number
  const invoiceNumber = await generateInvoiceNumber();
  const invoiceDate = fmtDate(new Date());

  // 11. Render PDF
  let buffer: Buffer;
  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    buffer = await renderToBuffer(
      createElement(InvoiceDocument, {
        invoiceNumber,
        invoiceDate,
        invoiceType,
        seller,
        buyer,
        items,
        subtotal,
        gstAmount,
        gstRate: gstAmount != null ? GST_RATE : undefined,
        grandTotal,
      })
    );
  } catch (pdfErr) {
    console.error("[invoice] PDF render failed:", pdfErr);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  // 12. Upload to Cloudinary via upload_stream (more reliable than fetch+FormData for buffers)
  const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME)!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("[invoice] Missing Cloudinary env vars:", { cloudName: !!cloudName, apiKey: !!apiKey, apiSecret: !!apiSecret });
    return NextResponse.json({ error: "Server misconfiguration: Cloudinary credentials missing" }, { status: 500 });
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  let uploadResult: any;
  try {
    uploadResult = await new Promise<any>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "invoices", public_id: orderId, resource_type: "raw", type: "authenticated", overwrite: true, invalidate: true },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      const { Readable } = require("stream");
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  } catch (uploadErr) {
    console.error("[invoice-gen] upload FAILED:", uploadErr);
    return NextResponse.json({ error: "PDF upload failed" }, { status: 500 });
  }

  console.log("[invoice-gen] FULL uploadResult:", JSON.stringify({
    secure_url: uploadResult?.secure_url,
    public_id: uploadResult?.public_id,
    resource_type: uploadResult?.resource_type,
    bytes: uploadResult?.bytes,
  }));

  const invoiceUrl: string = uploadResult.secure_url;

  // 13. Persist on order
  await db.order.update({
    where: { id: orderId },
    data: { invoiceNumber, invoiceUrl, invoiceType, invoiceGenAt: new Date() },
  });

  return NextResponse.json({ invoiceUrl, invoiceNumber, invoiceType });
}
