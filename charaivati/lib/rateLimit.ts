// lib/rateLimit.ts
import IORedis from 'ioredis';
const redis = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export async function checkRateLimit(key: string, limit = 5, windowSec = 3600) {
  // returns { ok: boolean, remaining: number, resetIn: seconds }
  const now = Math.floor(Date.now() / 1000);
  const bucket = `rl:${key}`;

  const tx = redis.multi();
  tx.zadd(bucket, now, `${now}:${Math.random()}`);
  tx.zremrangebyscore(bucket, 0, now - windowSec);
  tx.zcard(bucket);
  tx.expire(bucket, windowSec + 10);
  const [, , count] = await tx.exec() as any[];

  const current = parseInt(count as string, 10);
  return {
    ok: current <= limit,
    remaining: Math.max(0, limit - current),
    resetIn: windowSec
  };
}
