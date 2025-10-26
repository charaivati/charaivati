import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/hash";
import { createSessionToken, setSessionCookie, COOKIE_NAME } from "@/lib/session";
import { createClient } from "redis";

type ReqBody = { email?: string; password?: string };

/* CONFIG: tune to your needs */
const IP_WINDOW_SECONDS = 60 * 60; // 1 hour
const IP_MAX_ATTEMPTS = 200;

const EMAIL_WINDOW_SECONDS = 15 * 60; // 15 minutes
const EMAIL_MAX_ATTEMPTS = 5;

const LOCKOUT_BASE_SECONDS = 30; // base lockout (exponential backoff)
const LOCKOUT_MAX_SECONDS = 24 * 60 * 60; // cap to 24 hours

/* Redis client (lazy init) */
let redisClient: ReturnType<typeof createClient> | null = null;
async function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL || "";
  if (!url) {
    console.warn("[login][redis] ⚠️ No REDIS_URL set — using in-memory fallback rate limiting.");
    return null;
  }

  redisClient = createClient({ url });
  redisClient.on("error", (e) => console.error("[login][redis] error", e));

  try {
    await redisClient.connect();
    console.log(`[login][redis] ✅ Connected to Redis at ${url}`);
  } catch (err) {
    console.error("[login][redis] ❌ Connection failed, fallback to in-memory limiter:", err);
    redisClient = null;
    return null;
  }

  return redisClient;
}

/* Helpers */
async function incrWithExpire(client: any, key: string, expireSeconds: number) {
  // safe wrapper: try to increment, then set expire if first time
  const val = await client.incr(key);
  if (val === 1) await client.expire(key, expireSeconds);
  return Number(val);
}
function calcLockoutSeconds(attempts: number) {
  const extra = Math.max(0, attempts - EMAIL_MAX_ATTEMPTS);
  if (extra <= 0) return LOCKOUT_BASE_SECONDS;
  const secs = LOCKOUT_BASE_SECONDS * Math.pow(2, extra - 1);
  return Math.min(secs, LOCKOUT_MAX_SECONDS);
}

/* In-memory fallback for dev (not recommended for prod) */
const inMemoryStore: Record<string, { count: number; expiresAt: number }> = {};
function inMemoryIncr(key: string, windowSeconds: number) {
  const now = Date.now();
  const rec = inMemoryStore[key];
  if (!rec || rec.expiresAt <= now) {
    inMemoryStore[key] = { count: 1, expiresAt: now + windowSeconds * 1000 };
    return 1;
  }
  rec.count += 1;
  return rec.count;
}
function inMemoryGetTTL(key: string) {
  const rec = inMemoryStore[key];
  if (!rec) return 0;
  return Math.max(0, Math.ceil((rec.expiresAt - Date.now()) / 1000));
}
function inMemoryDel(key: string) {
  delete inMemoryStore[key];
}

/* Main handler */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({} as ReqBody))) as ReqBody;
    if (!body?.email || !body?.password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // NOTE: x-forwarded-for and similar headers can be spoofed unless your proxy is trusted.
    // Ensure your hosting / proxy (NGINX / Vercel / Cloudflare) sets these and that your app trusts them.
    const ipRaw =
      req.headers.get("x-forwarded-for") ??
      req.headers.get("x-real-ip") ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";
    const ip = String(ipRaw).split(",")[0].trim();

    // sanitize ip for redis key use (replace colon for IPv6)
    const ipKeySafe = ip.replace(/:/g, "_");

    const email = String(body.email).trim().toLowerCase();

    const redis = await getRedis();

    /* 1) IP throttle */
    const ipKey = `login:ip:${ipKeySafe}`;
    let ipCount = 0, ipTTL = 0;
    if (redis) {
      try {
        ipCount = await incrWithExpire(redis, ipKey, IP_WINDOW_SECONDS);
        ipTTL = (await redis.ttl(ipKey)) ?? 0;
      } catch (e) {
        console.error("[login][redis] ip throttle error, falling back to memory", e);
        ipCount = inMemoryIncr(ipKey, IP_WINDOW_SECONDS);
        ipTTL = inMemoryGetTTL(ipKey);
      }
    } else {
      ipCount = inMemoryIncr(ipKey, IP_WINDOW_SECONDS);
      ipTTL = inMemoryGetTTL(ipKey);
    }
    if (ipCount > IP_MAX_ATTEMPTS) {
      const retryAfter = Math.max(1, ipTTL || 60);
      const r = NextResponse.json(
        { ok: false, error: "too_many_requests", message: "Too many requests from this network. Try later." },
        { status: 429 }
      );
      r.headers.set("Retry-After", String(retryAfter));
      return r;
    }

    /* 2) Email attempt counter (light) */
    const emailAttemptKey = `login:email:${email}`;
    let emailAttempts = 0, emailTTL = 0;
    if (redis) {
      try {
        emailAttempts = await incrWithExpire(redis, emailAttemptKey, EMAIL_WINDOW_SECONDS);
        emailTTL = (await redis.ttl(emailAttemptKey)) ?? 0;
      } catch (e) {
        console.error("[login][redis] email attempt error, using in-memory fallback", e);
        emailAttempts = inMemoryIncr(emailAttemptKey, EMAIL_WINDOW_SECONDS);
        emailTTL = inMemoryGetTTL(emailAttemptKey);
      }
    } else {
      emailAttempts = inMemoryIncr(emailAttemptKey, EMAIL_WINDOW_SECONDS);
      emailTTL = inMemoryGetTTL(emailAttemptKey);
    }

    if (emailAttempts > EMAIL_MAX_ATTEMPTS) {
      const lockKey = `login:lock:${email}`;
      if (redis) {
        try {
          const lockExists = await redis.get(lockKey);
          if (lockExists) {
            const lockTTL = (await redis.ttl(lockKey)) ?? EMAIL_WINDOW_SECONDS;
            const r = NextResponse.json(
              { ok: false, error: "account_locked", message: "Too many failed attempts. Try later." },
              { status: 429 }
            );
            r.headers.set("Retry-After", String(lockTTL));
            return r;
          }
          const lockSeconds = calcLockoutSeconds(emailAttempts);
          await redis.set(lockKey, "1", { EX: lockSeconds });
          const r = NextResponse.json(
            { ok: false, error: "account_locked", message: "Too many failed attempts. Try later." },
            { status: 429 }
          );
          r.headers.set("Retry-After", String(lockSeconds));
          return r;
        } catch (e) {
          console.error("[login][redis] lock set failed, fallback to memory", e);
          // fallthrough to memory below
        }
      }

      // In-memory lockout fallback
      const lockRecKey = `login:lock:${email}`;
      const rec = (inMemoryStore as any)[lockRecKey];
      const now = Date.now();
      if (rec && rec.expiresAt > now) {
        const ttl = Math.ceil((rec.expiresAt - now) / 1000);
        const r = NextResponse.json(
          { ok: false, error: "account_locked", message: "Too many failed attempts. Try later." },
          { status: 429 }
        );
        r.headers.set("Retry-After", String(ttl));
        return r;
      }
      const lockSeconds = calcLockoutSeconds(emailAttempts);
      inMemoryStore[lockRecKey] = { count: 1, expiresAt: Date.now() + lockSeconds * 1000 };
      const r = NextResponse.json(
        { ok: false, error: "account_locked", message: "Too many failed attempts. Try later." },
        { status: 429 }
      );
      r.headers.set("Retry-After", String(lockSeconds));
      return r;
    }

    /* 3) Credential checks (Prisma + verifyPassword) */
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      // increment fail counter
      const failKey = `login:fail:${email}`;
      if (redis) {
        try {
          const fails = await incrWithExpire(redis, failKey, EMAIL_WINDOW_SECONDS);
          if (fails >= EMAIL_MAX_ATTEMPTS) {
            const lockSeconds = calcLockoutSeconds(fails);
            await redis.set(`login:lock:${email}`, "1", { EX: lockSeconds }).catch(() => {});
          }
        } catch (e) {
          console.error("[login][redis] fail incr error", e);
        }
      } else {
        const fails = inMemoryIncr(failKey, EMAIL_WINDOW_SECONDS);
        if (fails >= EMAIL_MAX_ATTEMPTS) {
          const lockRecKey = `login:lock:${email}`;
          const lockSeconds = calcLockoutSeconds(fails);
          inMemoryStore[lockRecKey] = { count: 1, expiresAt: Date.now() + lockSeconds * 1000 };
        }
      }
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({ error: "Please verify your email first" }, { status: 403 });
    }

    const ok = await verifyPassword(body.password!, user.passwordHash);
    if (!ok) {
      // bad password -> increment fail counters
      const failKey = `login:fail:${email}`;
      if (redis) {
        try {
          const fails = await incrWithExpire(redis, failKey, EMAIL_WINDOW_SECONDS);
          if (fails >= EMAIL_MAX_ATTEMPTS) {
            const lockSeconds = calcLockoutSeconds(fails);
            await redis.set(`login:lock:${email}`, "1", { EX: lockSeconds }).catch(() => {});
          }
        } catch (e) {
          console.error("[login][redis] fail incr error", e);
        }
      } else {
        const fails = inMemoryIncr(failKey, EMAIL_WINDOW_SECONDS);
        if (fails >= EMAIL_MAX_ATTEMPTS) {
          const lockRecKey = `login:lock:${email}`;
          const lockSeconds = calcLockoutSeconds(fails);
          inMemoryStore[lockRecKey] = { count: 1, expiresAt: Date.now() + lockSeconds * 1000 };
        }
      }
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    /* 4) Success — clear counters and create session */
    if (redis) {
      try {
        await redis.del(`login:email:${email}`).catch(() => {});
        await redis.del(`login:fail:${email}`).catch(() => {});
        await redis.del(`login:lock:${email}`).catch(() => {});
      } catch (e) {
        // don't fail login just because cleanup failed
        console.error("[login][redis] cleanup failed", e);
      }
    } else {
      inMemoryDel(`login:email:${email}`);
      inMemoryDel(`login:fail:${email}`);
      inMemoryDel(`login:lock:${email}`);
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email ?? undefined,
    });

    // successful response
    let res = NextResponse.json({ ok: true, redirect: "/self" });

    // helper to set the cookie (should set HttpOnly/secure depending on env)
    res = setSessionCookie(res, token);

    // optional fallback header for dev/debug (usually not needed if setSessionCookie writes cookie)
    // try {
    //   const headerVal = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
    //   res.headers.set("Set-Cookie", headerVal);
    // } catch {}

    return res;
  } catch (err) {
    console.error("[login] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
