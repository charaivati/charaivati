// app/api/cloudinary/sign/route.ts
// Returns public Cloudinary config so the client never hardcodes credentials.
// For signed uploads (private assets) you would generate a signature here using
// CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET — not needed for unsigned preset.
import { NextResponse } from "next/server";

export async function GET() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    return NextResponse.json(
      { error: "Cloudinary not configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({ cloudName, uploadPreset });
}
