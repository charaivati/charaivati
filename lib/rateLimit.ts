// lib/rateLimit.ts
import { getRedisClient } from "@/lib/redis";

let loggedOutage = false;

export async function checkRateLimit(
  key: string,
  limit = 5,
  windowSec = 3600
) {
  // returns { ok: boolean, remaining: number, resetIn: seconds }
  const { client: redis, kind } = await getRedisClient();

  // No redis configured at all (e.g., no env vars in build) — be permissive
  if (!redis || kind === "none") {
    return { ok: true, remaining: limit, resetIn: windowSec };
  }

  const now = Math.floor(Date.now() / 1000);
  const bucket = `rl:${key}`;
  const member = `${now}:${Math.random()}`;

  try {
    let current: number;

    if (kind === "ioredis") {
      const tx = (redis as any).multi();
      tx.zadd(bucket, now, member);
      tx.zremrangebyscore(bucket, 0, now - windowSec);
      tx.zcard(bucket);
      tx.expire(bucket, windowSec + 10);

      const execResult = await tx.exec();

      if (!execResult || !Array.isArray(execResult) || execResult.length < 3) {
        return { ok: true, remaining: limit, resetIn: windowSec };
      }

      const zcardEntry = execResult[2] as [Error | null, number | string | null] | undefined;
      current = Number(zcardEntry?.[1] ?? 0) || 0;
    } else {
      // Upstash REST client (@upstash/redis): pipeline commands take the SAME
      // argument shapes as the main client, which for zadd is an object
      // `{ score, member }` — NOT ioredis's positional (key, score, member).
      const pipeline = (redis as any).pipeline();
      pipeline.zadd(bucket, { score: now, member });
      pipeline.zremrangebyscore(bucket, 0, now - windowSec);
      pipeline.zcard(bucket);
      pipeline.expire(bucket, windowSec + 10);

      const results = await pipeline.exec();
      current = Number(results?.[2]) || 0;
    }

    return {
      ok: current <= limit,
      remaining: Math.max(0, limit - current),
      resetIn: windowSec,
    };
  } catch (err) {
    if (isClientApiError(err)) {
      // The wrong API shape was used for the detected client kind — this is a
      // CODE BUG, not a Redis outage, and must not be silently swallowed the
      // way an outage is. Surface it loudly so it can never regress unnoticed.
      console.error(
        `[rateLimit] CODE ERROR — ${kind} client call failed (rate limiting is broken!):`,
        err
      );
      if (process.env.NODE_ENV !== "production") {
        throw err;
      }
      return { ok: true, remaining: limit, resetIn: windowSec };
    }

    // Genuine connectivity/outage — fail open, log once per process.
    if (!loggedOutage) {
      console.warn(`[rateLimit] Redis (${kind}) unreachable — failing open (permissive):`, err);
      loggedOutage = true;
    }
    return { ok: true, remaining: limit, resetIn: windowSec };
  }
}

/**
 * Heuristic: is this error caused by calling the wrong client API
 * (wrong arg shapes, missing methods) rather than a network/connectivity
 * failure? Code-shape bugs manifest as messages like "Cannot use 'in'
 * operator to search for 'score' in <number>", "X is not a function", etc.
 * Connectivity failures (DNS, ECONNREFUSED, timeouts, fetch failures — the
 * latter is itself a TypeError in undici/fetch) must NOT be classified here.
 */
function isClientApiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error ? (err as any).cause : undefined;
  const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : "";

  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network|timeout/i.test(`${msg} ${causeMsg}`)) {
    return false;
  }

  return /Cannot use 'in' operator|is not a function|is not iterable/i.test(msg);
}
