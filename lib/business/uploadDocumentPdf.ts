// lib/business/uploadDocumentPdf.ts
// Uploads a PDF buffer to Cloudinary and returns the secure_url.
// Mirrors the pattern in app/api/orders/[orderId]/invoice/route.tsx.
//
// PDFs are stored as type:"upload" (public) under folder "biz-docs/".
// public_id format: biz-docs/{docId}
// Callers own access control — the pdfUrl is served only through server-side
// routes that validate ownership or a shareToken.

import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

export async function uploadDocumentPdf(
  buffer: Buffer,
  docId: string
): Promise<string> {
  const cloudName = (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??
    process.env.CLOUDINARY_CLOUD_NAME)!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Missing Cloudinary credentials");
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "biz-docs",
        public_id: docId,
        resource_type: "raw",
        type: "upload",
        overwrite: true,
        invalidate: true,
      },
      (error, res) => {
        if (error) reject(error);
        else resolve(res);
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });

  return result.secure_url as string;
}
