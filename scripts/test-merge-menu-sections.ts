// Run: npx ts-node --project tsconfig.scripts.json scripts/test-merge-menu-sections.ts
import { mergeMenuSections } from "../lib/store/mergeMenuSections";
import assert from "node:assert";

let n = 0;
const check = (name: string, fn: () => void) => {
  fn();
  n++;
  console.log(`✓ ${name}`);
};

check("sections with same title (diff case) merge, items concatenated", () => {
  const out = mergeMenuSections([
    { sections: [{ title: "Drinks", items: [{ title: "Tea" }] }] },
    { sections: [{ title: "drinks", items: [{ title: "Coffee" }] }] },
  ]);
  assert.equal(out.sections.length, 1);
  assert.deepEqual(out.sections[0].items.map((i) => i.title), ["Tea", "Coffee"]);
});

check("distinct titles stay separate", () => {
  const out = mergeMenuSections([
    { sections: [{ title: "Starters", items: [{ title: "Soup" }] }] },
    { sections: [{ title: "Mains", items: [{ title: "Curry" }] }] },
  ]);
  assert.equal(out.sections.length, 2);
});

check("scalars take first non-empty across images", () => {
  const out = mergeMenuSections([
    { storeName: "", phone: null, sections: [] },
    { storeName: "Cafe X", phone: "123", address: "Main St", sections: [] },
  ]);
  assert.equal(out.storeName, "Cafe X");
  assert.equal(out.phone, "123");
  assert.equal(out.address, "Main St");
  assert.equal(out.hours, null);
});

check("missing/empty section title doesn't collapse unrelated sections", () => {
  const out = mergeMenuSections([
    { sections: [{ items: [{ title: "A" }] }] },
    { sections: [{ items: [{ title: "B" }] }] },
  ]);
  assert.equal(out.sections.length, 2); // empty titles get unique __idx keys
});

check("empty input is safe", () => {
  const out = mergeMenuSections([]);
  assert.deepEqual(out.sections, []);
  assert.equal(out.storeName, null);
});

check("missing sections/items arrays don't throw", () => {
  const out = mergeMenuSections([{ storeName: "Y" }, { sections: [{ title: "Z" }] }]);
  assert.equal(out.sections.length, 1);
  assert.deepEqual(out.sections[0].items, []);
});

console.log(`\n${n}/${n} checks passed`);
