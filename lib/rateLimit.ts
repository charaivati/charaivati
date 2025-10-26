// lib/rateLimit.ts
import { getRedis, isIORedis } from "@/lib/redis";

export async function checkRateLimit(
  key: string,
  limit = 5,
  windowSec = 3600
) {
  // returns { ok: boolean, remaining: number, resetIn: seconds }
  const redis = await getRedis();

  // If no redis available (e.g., no env vars in build), be permissive
  if (!redis) {
    return {
      ok: true,
      remaining: limit,
      resetIn: windowSec,
    };
  }

  // If it's ioredis (supports multi/exec), use transaction
  if (isIORedis(redis)) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const bucket = `rl:${key}`;

      const tx = (redis as any).multi();
      tx.zadd(bucket, now, `${now}:${Math.random()}`);
      tx.zremrangebyscore(bucket, 0, now - windowSec);
      tx.zcard(bucket);
      tx.expire(bucket, windowSec + 10);

      const execResult = await tx.exec();

      if (!execResult || !Array.isArray(execResult) || execResult.length < 3) {
        return {
          ok: true,
          remaining: limit,
          resetIn: windowSec,
        };
      }

      const zcardEntry = execResult[2] as [Error | null, number | string | null] | undefined;
      const rawCount = zcardEntry?.[1] ?? 0;
      const current = Number(rawCount) || 0;

      return {
        ok: current <= limit,
        remaining: Math.max(0, limit - current),
        resetIn: windowSec,
      };
    } catch (err) {
      console.warn("[rateLimit] redis (ioredis) error:", err);
      return { ok: true, remaining: limit, resetIn: windowSec };
    }
  }

  // Fallback for Upstash REST (no multi/exec): best-effort using available commands
  try {
    const now = Math.floor(Date.now() / 1000);
    const bucket = `rl:${key}`;

    // Upstash REST client's API may differ; use zadd/zremrangebyscore/zcard/expire sequentially
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await (redis as any).zadd?.(bucket, now, `${now}:${Math.random()}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await (redis as any).zremrangebyscore?.(bucket, 0, now - windowSec);
    const zcard = await (redis as any).zcard?.(bucket);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await (redis as any).expire?.(bucket, windowSec + 10);

    const current = Number(zcard) || 0;
    return {
      ok: current <= limit,
      remaining: Math.max(0, limit - current),
      resetIn: windowSec,
    };
  } catch (err) {
    console.warn("[rateLimit] upstash redis error:", err);
    return { ok: true, remaining: limit, resetIn: windowSec };
  }
}
