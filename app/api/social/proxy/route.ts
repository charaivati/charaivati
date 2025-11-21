// Route: /app/api/social/proxy.ts
import { NextRequest, NextResponse } from "next/server";

const CACHE_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

// Simple in-memory cache (replace with Redis for production)
const fileCache = new Map<string, { data: Uint8Array; timestamp: number }>();

/**
 * GET /api/social/proxy?id=FILE_ID&type=image|json|video
 * Proxies Google Drive file content through our server
 * Adds caching + correct headers + type support
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("id");
    const type = (searchParams.get("type") || "image").toLowerCase();

    if (!fileId) {
      return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
    }

    // return from memory cache if present
    const cached = fileCache.get(fileId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
      const contentType = type === "json" ? "application/json" : `${type}/*`;
      const blob = new Blob([cached.data]);
      return new NextResponse(blob, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": `public, max-age=${CACHE_DURATION}`,
          "CDN-Cache-Control": `max-age=${CACHE_DURATION}`,
          "X-Cache": "HIT",
        },
      });
    }

    // fetch from Google Drive (direct download)
    const driveUrl = `https://drive.google.com/uc?id=${fileId}`;
    const response = await fetch(driveUrl);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn("drive fetch failed:", response.status, text);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const uintData = new Uint8Array(arrayBuffer);

    // Save to memory cache
    fileCache.set(fileId, {
      data: uintData,
      timestamp: Date.now(),
    });

    const contentType =
      type === "json"
        ? "application/json"
        : response.headers.get("content-type") || "application/octet-stream";

    const blob = new Blob([uintData]);
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_DURATION}`,
        "CDN-Cache-Control": `max-age=${CACHE_DURATION}`,
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.json({ error: "Proxy failed" }, { status: 500 });
  }
}

/**
 * POST /api/social/proxy
 * action: "clear-cache"
 * fileId?: string
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, fileId } = body;

    // Example auth check placeholder:
    // if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (action === "clear-cache") {
      if (fileId) {
        fileCache.delete(fileId);
      } else {
        fileCache.clear();
      }

      return NextResponse.json({ ok: true, message: "Cache cleared" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Cache clear error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/**
 * OPTIONS /api/social/proxy
 * Returns cache stats
 */
export async function OPTIONS() {
  return NextResponse.json({
    cacheSize: fileCache.size,
    cacheStatus: "ok",
    cacheItems: Array.from(fileCache.keys()),
  });
}
