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
 */
export async function getRedis(): Promise<AnyRedis> {
  if (cachedClient !== undefined) return cachedClient;

  // Prefer Upstash REST
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) {
    // lazy require so bundlers/edge/runtime don't include it unexpectedly
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Redis } = require("@upstash/redis");
    try {
      const r: UpstashRedisType = new Redis({ url: upstashUrl, token: upstashToken });
      // upstash client may not declare .on in types; use optional chaining on any
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
  const redisUrl = process.env.REDIS_URL ?? process.env.REDIS_URI;
  if (redisUrl) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IORedis = require("ioredis");
    try {
      // use lazyConnect so instance doesn't open a connection at construction in some envs
      const r: IORedisType = new IORedis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 2,
        enableAutoPipelining: true,
      });
      // cast to any to access .on and .connect without TS complaining
      (r as any).on?.("error", (err: any) => console.warn("[redis] ioredis error:", String(err)));
      (r as any).on?.("connect", () => console.info("[redis] connected via REDIS_URL"));

      // Try to connect but swallow errors (so build/static generation doesn't fail)
      try {
        // connect() exists at runtime; call it but ignore if it errors
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
