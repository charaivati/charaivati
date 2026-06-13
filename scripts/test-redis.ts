#!/usr/bin/env npx ts-node
/**
 * Test Redis connectivity and rate limiting functionality
 * Run: ALLOW_TEST_BYPASS=true npx ts-node --project tsconfig.scripts.json scripts/test-redis.ts
 */

import { checkRateLimit } from "@/lib/rateLimit";
import { getRedisClient } from "@/lib/redis";

async function main() {
  console.log("🔍 Testing Redis connectivity...\n");

  // 1. Check if Redis client is available
  const { client, kind } = await getRedisClient();
  if (!client || kind === "none") {
    console.log("❌ Redis client is NOT available");
    console.log("   This means rate limiting will be PERMISSIVE (all requests allowed)");
    console.log("   Environment variables:");
    console.log(`   - UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? "✓ set" : "❌ missing"}`);
    console.log(`   - UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? "✓ set" : "❌ missing"}`);
    return;
  }

  console.log("✅ Redis client connected successfully\n");

  // 2. Test rate limiting with a test key
  console.log("📊 Testing rate limit functionality (limit=3, window=60s):\n");

  const testKey = `test:redis:${Date.now()}`;
  const limit = 3;
  const window = 60;

  for (let i = 1; i <= 5; i++) {
    const result = await checkRateLimit(testKey, limit, window);
    console.log(`   Request ${i}: ${result.ok ? "✅ ALLOWED" : "❌ BLOCKED"} (remaining: ${result.remaining})`);
  }

  console.log("\n📈 Expected: Requests 1-3 allowed, requests 4-5 blocked");

  // 3. Test actual rate-limiting keys from UCTX-2
  console.log("\n🧪 Testing UCTX-2 rate limits:\n");

  const guestIp = "192.168.1.100";
  const userId = "test-user-" + Date.now();

  console.log(`Testing guest creation limit (3/10min):`);
  const guest1 = await checkRateLimit(`guest:create:${guestIp}`, 3, 600);
  console.log(`   Result: ${guest1.ok ? "✅ allowed" : "❌ blocked"}`);

  console.log(`\nTesting listen message limit (20/5min):`);
  const listen1 = await checkRateLimit(`listen:msg:${userId}`, 20, 300);
  console.log(`   Result: ${listen1.ok ? "✅ allowed" : "❌ blocked"}`);

  console.log(`\nTesting chat message limit (20/5min):`);
  const chat1 = await checkRateLimit(`chat:msg:${userId}`, 20, 300);
  console.log(`   Result: ${chat1.ok ? "✅ allowed" : "❌ blocked"}`);

  console.log("\n✨ Redis test complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
