// lib/redis.ts
import type IORedisType from "ioredis";
import type { Redis as UpstashRedisType } from "@upstash/redis";

type AnyRedis = IORedisType | UpstashRedisType | null;

/**
 * Which kind of client is actually behind `client`. Callers (lib/rateLimit.ts)
 * MUST branch on this instead of duck-typing methods like `.multi` — both
 * ioredis and @upstash/redis expose `.multi`/`.pipeline`, but with different
 * argument shapes, so duck-typing silently picks the wrong API and every call
 * throws (caught and swallowed as a permissive "outage").
 */
export type RedisKind = "ioredis" | "upstash" | "none";

let cachedClient: AnyRedis | undefined;
let cachedKind: RedisKind | undefined;

/**
 * Return the redis client plus an explicit tag for which implementation it is.
 * Safe to call during build because:
 * - It prefers Upstash REST (no TCP)
 * - It only creates ioredis when REDIS_URL is provided and attempts a lazy connect,
 *   but swallows connect errors so builds won't fail.
 *
 * Logs once (per process) which client was detected so a regression to "no
 * redis configured" / "wrong client" can never go unnoticed silently again.
 */
export async function getRedisClient(): Promise<{ client: AnyRedis; kind: RedisKind }> {
  if (cachedClient !== undefined && cachedKind !== undefined) {
    return { client: cachedClient, kind: cachedKind };
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = process.env.REDIS_URL ?? process.env.REDIS_URI;

  if (process.env.NODE_ENV === "production" && !upstashUrl && !redisUrl) {
    // Do not throw by default; we log so operators see the misconfiguration.
    // eslint-disable-next-line no-console
    console.error(
      "[redis] WARNING: No UPSTASH_REDIS_REST_URL+TOKEN or REDIS_URL configured in production. Rate limiting and caches may be disabled."
    );
  }

  // Prefer Upstash REST
  if (upstashUrl && upstashToken) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Redis } = require("@upstash/redis");
    try {
      const r: UpstashRedisType = new Redis({ url: upstashUrl, token: upstashToken });
      cachedClient = r;
      cachedKind = "upstash";
      console.info("[redis] Detected client: Upstash REST — rate limiting ACTIVE");
      return { client: cachedClient, kind: cachedKind };
    } catch (e) {
      console.warn("[redis] upstash client init failed:", e);
      cachedClient = null;
      cachedKind = "none";
      console.warn("[redis] No usable client — rate limiting INACTIVE (permissive fallback)");
      return { client: null, kind: "none" };
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
      cachedKind = "ioredis";
      console.info("[redis] Detected client: ioredis (REDIS_URL) — rate limiting ACTIVE");
      return { client: cachedClient, kind: cachedKind };
    } catch (e) {
      console.warn("[redis] ioredis init failed:", e);
      cachedClient = null;
      cachedKind = "none";
      console.warn("[redis] No usable client — rate limiting INACTIVE (permissive fallback)");
      return { client: null, kind: "none" };
    }
  }

  cachedClient = null;
  cachedKind = "none";
  console.warn("[redis] No Redis configured (no UPSTASH_REDIS_REST_URL/TOKEN or REDIS_URL) — rate limiting INACTIVE (permissive fallback)");
  return { client: null, kind: "none" };
}
