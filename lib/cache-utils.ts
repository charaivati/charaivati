// ============================================================================
// FILE 5: lib/cache-utils.ts
// ============================================================================

/**
 * Clear cache for specific file or all files
 */
export async function clearProxyCache(fileId?: string): Promise<boolean> {
  try {
    const token = process.env.ADMIN_CACHE_TOKEN;
    if (!token) {
      console.error("ADMIN_CACHE_TOKEN not set in environment");
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
      console.error("Cache clear failed:", response.statusText);
      return false;
    }

    const data = await response.json();
    console.log("Cache cleared:", data.message);
    return true;
  } catch (error) {
    console.error("Failed to clear proxy cache:", error);
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    const response = await fetch("/api/social/proxy", {
      method: "OPTIONS",
    });

    if (!response.ok) {
      console.error("Failed to fetch cache stats");
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
  maxCacheSize: number;
  maxFileSizeMB: number;
  cacheStatus: string;
  timestamp: string;
}