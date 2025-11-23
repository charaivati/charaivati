// components/SelectTabsModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Check } from "lucide-react";

type TabItem = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  category?: string | null;
  position?: number | null;
  translations?: Array<{ locale: string; title: string }>;
};

export default function SelectTabsModal({
  initialSelected = [],
  onClose,
  locale = "en",
}: {
  initialSelected?: string[];
  onClose: (selected?: string[]) => void;
  locale?: string;
}) {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(initialSelected || []);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/tabs")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok && Array.isArray(j.tabs)) setTabs(j.tabs);
        else setTabs([]);
      })
      .catch(() => setTabs([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (slug: string) => {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  };

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const arr = tabs
      .map((t) => {
        const localized = (t.translations || []).find((tr) => tr.locale === locale)?.title;
        const title = localized || t.title || t.slug;
        return { ...t, displayTitle: title };
      })
      .filter((t) => {
        if (!q) return true;
        return (
          (t.displayTitle || "").toLowerCase().includes(q) ||
          (t.slug || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return arr;
  }, [tabs, filter, locale]);

  const grouped = useMemo(() => {
    const g: Record<string, TabItem[]> = {};
    for (const t of visible) {
      const cat = t.category || "Other";
      g[cat] = g[cat] || [];
      g[cat].push(t);
    }
    return g;
  }, [visible]);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
      <div className="max-w-3xl w-full bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Select Tabs to Tag</h3>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search tabs or categories..."
              className="ml-2 text-sm p-2 rounded bg-white/10 border border-white/20 text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm bg-white/10 rounded" onClick={() => onClose(undefined)}>
              Cancel
            </button>
            <button
              className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded text-sm"
              onClick={() => onClose(selected)}
            >
              Save
            </button>
            <button onClick={() => onClose(selected)} className="p-2 text-gray-300">
              <X />
            </button>
          </div>
        </div>

        <div className="p-4 max-h-[60vh] overflow-auto">
          {loading && <div className="text-gray-400">Loading tabs…</div>}
          {!loading && tabs.length === 0 && <div className="text-gray-400">No tabs found</div>}

          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-4">
              <div className="font-semibold text-white/90 mb-2">{category}</div>
              <div className="grid gap-2">
                {items.map((t) => {
                  const checked = selected.includes(t.slug);
                  const displayTitle = (t.translations || []).find((tr) => tr.locale === locale)?.title || t.title || t.slug;
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggle(t.slug)}
                      className={`w-full flex items-center justify-between p-3 rounded text-left ${
                        checked ? "border border-blue-500 bg-white/5" : "border border-white/10"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-white">{displayTitle}</div>
                        {t.description && <div className="text-xs text-gray-400">{t.description}</div>}
                        <div className="text-xs text-gray-500 mt-1">{t.slug}</div>
                      </div>
                      <div>{checked ? <Check className="w-4 h-4 text-green-400" /> : null}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
