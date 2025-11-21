// ============================================================================
// FILE 6: lib/cache-utils.ts (HELPER FUNCTIONS)
// ============================================================================
export async function clearProxyCache(fileId?: string): Promise<boolean> {
  try {
    const token = process.env.ADMIN_CACHE_TOKEN;
    if (!token) {
      console.error("ADMIN_CACHE_TOKEN not set");
      return false;
    }

    const response = await fetch("/api/social/proxy", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "clear-cache",
        fileId: fileId || null,
      }),
    });

    if (!response.ok) {
      console.error("Failed to clear cache:", response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to clear proxy cache:", error);
    return false;
  }
}

export async function getCacheStats() {
  try {
    const response = await fetch("/api/social/proxy", {
      method: "OPTIONS",
    });

    if (!response.ok) {
      console.error("Failed to fetch cache stats:", response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to get cache stats:", error);
    return null;
  }
}

export interface CacheStats {
  cacheSize: number;
  memoryUsageMB: string;
  maxCacheEntries: number;
  cacheStatus: string;
  timestamp: string;
}
