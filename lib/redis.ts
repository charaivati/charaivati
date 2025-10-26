// lib/redis.ts
import type IORedisType from "ioredis";
import type { Redis as UpstashRedisType } from "@upstash/redis";

type AnyRedis = IORedisType | UpstashRedisType | null;

let cachedClient: AnyRedis | undefined;

/**
 * Return a redis client or null. Safe to call during build because:
 * - It prefers Upstash REST (no TCP)
 * - It only creates ioredis when REDIS_URL is provided and attempts a lazy connect,
 *   but swallow connect errors so builds won't fail.
 *
 * Note: In production we log loudly if no redis config exists so missing config
 * isn't silently ignored.
 */
export async function getRedis(): Promise<AnyRedis> {
  if (cachedClient !== undefined) return cachedClient;

  // Production guard: ensure team knows if redis isn't configured
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = process.env.REDIS_URL ?? process.env.REDIS_URI;

  if (process.env.NODE_ENV === "production" && !upstashUrl && !redisUrl) {
    // Do not throw by default; we log so operators see the misconfiguration.
    // If you prefer to fail-fast, replace console.error with throw new Error(...)
    // eslint-disable-next-line no-console
    console.error(
      "[redis] WARNING: No UPSTASH_REDIS_REST_URL+TOKEN or REDIS_URL configured in production. Rate limiting and caches may be disabled."
    );
  }

  // Prefer Upstash REST
  if (upstashUrl && upstashToken) {
    // lazy require
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Redis } = require("@upstash/redis");
    try {
      const r: UpstashRedisType = new Redis({ url: upstashUrl, token: upstashToken });
      (r as any).on?.("error", (e: any) => console.warn("[redis] upstash rest error:", e));
      (r as any).on?.("ready", () => console.info("[redis] using Upstash REST client"));
      cachedClient = r;
      return cachedClient;
    } catch (e) {
      console.warn("[redis] upstash client init failed:", e);
      cachedClient = null;
      return null;
    }
  }

  // Next, TCP ioredis if configured
  if (redisUrl) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IORedis = require("ioredis");
    try {
      const r: IORedisType = new IORedis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        enableAutoPipelining: true,
      });
      (r as any).on?.("error", (err: any) => console.warn("[redis] ioredis error:", String(err)));
      (r as any).on?.("connect", () => console.info("[redis] connected via REDIS_URL"));
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await ((r as any).connect?.() ?? Promise.resolve());
      } catch (e) {
        console.warn("[redis] ioredis connect failed (ignored):", String(e));
      }
      cachedClient = r;
      return cachedClient;
    } catch (e) {
      console.warn("[redis] ioredis init failed:", e);
      cachedClient = null;
      return null;
    }
  }

  cachedClient = null;
  return null;
}

/** Type guard for detecting ioredis at runtime (optional helper) */
export function isIORedis(client: AnyRedis): client is IORedisType {
  return !!client && typeof (client as any).multi === "function";
}
