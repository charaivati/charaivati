// ============================================================================
// FILE 2: app/api/social/proxy/route.ts
// ============================================================================
import { NextRequest, NextResponse } from "next/server";

const CACHE_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds
const MAX_CACHE_SIZE = 500;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface CacheEntry {
  data: Uint8Array;
  timestamp: number;
  contentType: string;
  size: number;
}

const fileCache = new Map<string, CacheEntry>();

function getMemoryUsage(): number {
  let total = 0;
  fileCache.forEach((entry) => {
    total += entry.size;
  });
  return total;
}

function pruneCache(): void {
  if (fileCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(fileCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toDelete; i++) {
      fileCache.delete(entries[i][0]);
    }
    console.log(`[Cache] Pruned: removed ${toDelete} entries, ${fileCache.size} remaining`);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("id");
    const type = (searchParams.get("type") || "image").toLowerCase();

    if (!fileId) {
      return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
    }

    // Validate fileId format (prevent injection)
    if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      console.warn(`[Proxy] Invalid fileId format: ${fileId}`);
      return NextResponse.json({ error: "Invalid file ID format" }, { status: 400 });
    }

    // Check memory cache first
    const cached = fileCache.get(fileId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
      console.log(`[Cache] HIT for ${fileId}`);
      const blob = new Blob([cached.data]);
      return new NextResponse(blob, {
        headers: {
          "Content-Type": cached.contentType,
          "Cache-Control": `public, max-age=${CACHE_DURATION}, immutable`,
          "CDN-Cache-Control": `max-age=${CACHE_DURATION}`,
          "X-Cache": "HIT",
          "Content-Length": String(cached.size),
        },
      });
    }

    // Fetch from Google Drive
    const driveUrl = `https://drive.google.com/uc?id=${fileId}`;
    const response = await fetch(driveUrl, {
      headers: {
        "User-Agent": "Charaivati-Social/1.0",
      },
    });

    if (!response.ok) {
      console.warn(`[Drive] Fetch failed for ${fileId}: ${response.status}`);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const uintData = new Uint8Array(arrayBuffer);
    const contentType = type === "json" ? "application/json" : response.headers.get("content-type") || `${type}/*`;

    // Cache if under size limit
    if (arrayBuffer.byteLength < MAX_FILE_SIZE) {
      fileCache.set(fileId, {
        data: uintData,
        timestamp: Date.now(),
        contentType,
        size: arrayBuffer.byteLength,
      });
      pruneCache();
      console.log(`[Cache] MISS + stored for ${fileId} (${(arrayBuffer.byteLength / 1024).toFixed(2)}KB)`);
    }

    const blob = new Blob([uintData]);
    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_DURATION}, immutable`,
        "CDN-Cache-Control": `max-age=${CACHE_DURATION}`,
        "X-Cache": "MISS",
        "Content-Length": String(arrayBuffer.byteLength),
      },
    });
  } catch (err) {
    console.error("[Proxy] Error:", err);
    return NextResponse.json({ error: "Proxy failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin token from Authorization header
    const authHeader = req.headers.get("Authorization");
    const adminToken = process.env.ADMIN_CACHE_TOKEN;

    if (!adminToken) {
      console.error("[Cache] ADMIN_CACHE_TOKEN not configured");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const expectedAuth = `Bearer ${adminToken}`;
    if (authHeader !== expectedAuth) {
      console.warn("[Cache] Unauthorized clear request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, fileId } = body;

    if (action === "clear-cache") {
      if (fileId) {
        fileCache.delete(fileId);
        console.log(`[Cache] Cleared file: ${fileId}`);
        return NextResponse.json({ ok: true, message: `Cleared cache for ${fileId}` });
      } else {
        const size = fileCache.size;
        fileCache.clear();
        console.log(`[Cache] Cleared all (was ${size} entries)`);
        return NextResponse.json({ ok: true, message: "Cleared all cache" });
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[Cache] Clear error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  const memoryUsage = getMemoryUsage();
  return NextResponse.json(
    {
      cacheSize: fileCache.size,
      memoryUsageMB: (memoryUsage / 1024 / 1024).toFixed(2),
      maxCacheSize: MAX_CACHE_SIZE,
      maxFileSizeMB: MAX_FILE_SIZE / 1024 / 1024,
      cacheStatus: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS",
      },
    }
  );
}