---
module: redis-cache
type: library
source: lib/redis.ts, lib/cache-utils.ts, lib/rateLimit.ts
depends_on: []
used_by: [auth, social, all-api-routes-with-rate-limiting]
stability: stable
status: active
---

# Module: Redis Cache

## Purpose
Provides caching and rate limiting infrastructure backed by Redis. Two Redis clients are available — Upstash (HTTP-based, serverless-friendly) and ioredis (TCP-based, traditional). Rate limiting is built on top of Redis counters with TTL windows.

## Responsibilities
- Provide a Redis client instance for caching and rate limiting
- Cache expensive or frequently-read data with TTL
- Enforce per-user, per-IP, and per-endpoint rate limits
- Abstract cache read/write patterns via `lib/cache-utils.ts`

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Cache key + value + TTL (for writes) |
| In | Cache key (for reads) |
| In | Rate limit key (userId or IP) + window config |
| Out | Cached value or null (cache miss) |
| Out | Rate limit result: allowed boolean + remaining count |

## Dependencies
- **Upstash Redis** — external; credentials from `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **ioredis** — external; connection string from Redis `REDIS_URL` or similar (TODO: confirm env var name)
- No internal module dependencies

## Reverse Dependencies (what breaks if this changes)
- Rate limiting is applied at the API layer in `lib/rateLimit.ts`. If Redis is unavailable, the fallback behavior (fail open vs fail closed) determines whether the platform stays up or rejects all requests. TODO: Confirm fail-open vs fail-closed behavior.
- Cached data has TTL but no active invalidation in most cases. Stale cache can cause users to see outdated data until the TTL expires.
- If `lib/redis.ts` is changed to export a different client interface, all callers using `.get()`, `.set()`, `.incr()` etc. must be updated.

## Runtime Flow

### Cache read
1. Caller imports client from `lib/redis.ts`
2. Calls `redis.get(key)`
3. On miss: caller computes value, calls `redis.set(key, value, 'EX', ttl)`
4. On hit: returns cached value, skips computation

### Rate limiting
1. API route calls `checkRateLimit(userId, endpoint)` from `lib/rateLimit.ts`
2. Function calls `redis.incr(rateKey)` — increments counter for the window
3. If counter is 1 (first request in window), sets TTL via `redis.expire()`
4. Compares counter to limit
5. Returns `{ allowed: boolean, remaining: number }`
6. API returns `429 Too Many Requests` if not allowed

## Key Exports

| Export | File | Role |
|---|---|---|
| `redis` | lib/redis.ts | Primary Redis client (Upstash or ioredis) |
| `checkRateLimit()` | lib/rateLimit.ts | Check and increment rate limit counter |
| (cache helpers) | lib/cache-utils.ts | Typed cache read/write wrappers |

## Environment Variables Required
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- TODO: Confirm ioredis connection env var name

## Database Models Used
None — Redis is a separate data store. No Prisma models involved.

## Risks & Fragile Areas
- Two Redis clients exist (Upstash and ioredis). Their usage is not clearly separated by role. TODO: Confirm which is used for rate limiting and which for caching, and whether they point to the same Redis instance.
- In serverless (Vercel) environments, ioredis TCP connections can exhaust the connection limit. Upstash (HTTP) is preferred for serverless. If ioredis is used in serverless, connection leaks will occur under load.
- Cache-aside pattern (read → miss → compute → write) has a race condition under concurrent requests. Multiple requests can simultaneously miss, compute, and overwrite the cache. This is generally acceptable but worth noting for expensive computations.
- No cache invalidation mechanism observed beyond TTL expiry. Changes to user or store data are not immediately reflected in cached responses.

## Backlinks
- [[auth.md]] — rate limiting on login and OTP endpoints
- [[social.md]] — post creation rate limits
- [[START_HERE.md]] — Redis listed in tech stack
