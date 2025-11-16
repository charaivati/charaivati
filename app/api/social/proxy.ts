import { NextRequest, NextResponse } from "next/server";

const CACHE_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds
const fileCache = new Map<string, { data: Buffer; timestamp: number }>();

/**
 * GET /api/social/proxy?id=FILE_ID&type=image|json|video&token=ACCESS_TOKEN
 * Fetches from Google Drive using authenticated API
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("id");
    const type = (searchParams.get("type") || "image").toLowerCase();
    const token = searchParams.get("token"); // Must be provided

    if (!fileId) {
      console.warn("[Proxy] Missing file ID");
      return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
    }

    console.log(`[Proxy] GET ${fileId} | type=${type}`);

    // Check cache
    const cached = fileCache.get(fileId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
      console.log(`[Proxy] CACHE HIT ${fileId}`);
      const contentType = type === "json" ? "application/json" : `${type}/*`;
      const uint8 = new Uint8Array(cached.data);

      return new NextResponse(uint8, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": `public, max-age=${CACHE_DURATION}`,
          "X-Cache": "HIT",
        },
      });
    }

    // Fetch using the new 2024 Google Drive thumbnail format (no auth needed!)
    const driveUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
    console.log(`[Proxy] Fetching from: ${driveUrl}`);

    const response = await fetch(driveUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.error(`[Proxy] Fetch failed ${response.status}`);
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Failed to fetch file (${response.status})`,
          fileId,
          hint: text.substring(0, 200),
        },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const buffer = Buffer.from(uint8Array);

    // Cache the file
    fileCache.set(fileId, {
      data: buffer,
      timestamp: Date.now(),
    });

    console.log(`[Proxy] SUCCESS ${fileId} | Size: ${buffer.length} bytes`);

    const contentType =
      type === "json"
        ? "application/json"
        : response.headers.get("content-type") || "application/octet-stream";

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_DURATION}`,
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    console.error("[Proxy] Error:", err);
    return NextResponse.json(
      { error: "Proxy failed", details: String(err).substring(0, 200) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/social/proxy - Clear cache
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, fileId } = body;

    if (action === "clear-cache") {
      if (fileId) {
        fileCache.delete(fileId);
        console.log(`[Proxy] Cache cleared for: ${fileId}`);
      } else {
        const size = fileCache.size;
        fileCache.clear();
        console.log(`[Proxy] Entire cache cleared (was ${size} items)`);
      }
      return NextResponse.json({ ok: true, message: "Cache cleared" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[Proxy] POST error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/**
 * OPTIONS /api/social/proxy - Get cache stats
 */
export async function OPTIONS() {
  return NextResponse.json({
    cacheSize: fileCache.size,
    cacheStatus: "ok",
    cacheItems: Array.from(fileCache.keys()),
  });
}