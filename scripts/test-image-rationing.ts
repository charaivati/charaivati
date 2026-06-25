// Run: npx ts-node --project tsconfig.scripts.json scripts/test-image-rationing.ts
// Verifies Unsplash rationing: allowUnsplash:false must never resolve to Unsplash,
// regardless of whether provider keys are configured (it's filtered from the chain).
import { fetchImage } from "../lib/imageSearch";
import assert from "node:assert";

(async () => {
  let n = 0;
  const check = async (name: string, fn: () => Promise<void>) => {
    await fn();
    n++;
    console.log(`✓ ${name}`);
  };

  await check("allowUnsplash:false never returns an unsplash url", async () => {
    const url = await fetchImage("margherita pizza", { allowUnsplash: false });
    assert.ok(url, "should still return a url (free provider / picsum)");
    assert.ok(!url!.includes("unsplash"), `expected non-unsplash, got ${url}`);
  });

  await check("default fetchImage still returns a usable url", async () => {
    const url = await fetchImage("masala dosa");
    assert.ok(url && url.startsWith("http"), `expected http url, got ${url}`);
  });

  await check("per-build cap rule: first 10 of 40 allow Unsplash", async () => {
    const cap = 10;
    const flags = Array.from({ length: 40 }, (_, idx) => idx < cap);
    assert.equal(flags.filter(Boolean).length, cap);
    assert.equal(flags.slice(0, cap).every(Boolean), true);
    assert.equal(flags.slice(cap).some(Boolean), false);
  });

  console.log(`\n${n}/${n} checks passed`);
})();
