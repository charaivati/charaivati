// Merge per-image menu-extraction results into one structure.
// Sections are combined by case-insensitive title (items concatenated);
// scalar fields take the first non-empty value across images.

type Item = { title?: string; [k: string]: unknown };
type Section = { title?: string; items?: Item[] };
type Step1 = {
  storeName?: string | null;
  sections?: Section[];
  phone?: string | null;
  address?: string | null;
  hours?: string | null;
};

export function mergeMenuSections(parsed: Step1[]): {
  storeName: string | null;
  sections: { title: string; items: Item[] }[];
  phone: string | null;
  address: string | null;
  hours: string | null;
} {
  const sectionMap = new Map<string, { title: string; items: Item[] }>();
  for (const p of parsed) {
    for (const sec of p.sections ?? []) {
      const key = String(sec.title ?? "").trim().toLowerCase() || `__${sectionMap.size}`;
      const existing = sectionMap.get(key);
      if (existing) existing.items.push(...(sec.items ?? []));
      else sectionMap.set(key, { title: sec.title ?? "Menu", items: [...(sec.items ?? [])] });
    }
  }
  const firstOf = (k: keyof Step1) =>
    (parsed.map((p) => p[k]).find((v) => v != null && v !== "") as string | undefined) ?? null;
  return {
    storeName: firstOf("storeName"),
    sections: [...sectionMap.values()],
    phone: firstOf("phone"),
    address: firstOf("address"),
    hours: firstOf("hours"),
  };
}
