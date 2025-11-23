// components/SelectTabsModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { X, Check } from "lucide-react";

type TabItem = { tabId: string; slug: string; enTitle: string; enDescription?: string };

export default function SelectTabsModal({
  initialSelected = [],
  onClose,
}: {
  initialSelected?: string[];
  onClose: (selected?: string[]) => void;
}) {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(initialSelected || []);

  useEffect(() => {
    let alive = true;
    fetch("/api/tab-translations?locale=en")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.data) setTabs(j.data || []);
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

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
      <div className="max-w-3xl w-full bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-lg font-semibold">Select Tabs to Tag</h3>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 text-sm bg-white/10 rounded" onClick={() => onClose(undefined)}>
              Cancel
            </button>
            <button className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded text-sm" onClick={() => onClose(selected)}>
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

          <div className="grid gap-2">
            {tabs.map((t) => {
              const slug = t.slug || t.enTitle;
              const checked = selected.includes(slug);
              return (
                <button
                  key={t.tabId}
                  onClick={() => toggle(slug)}
                  className={`flex items-center justify-between p-3 rounded border ${checked ? "border-blue-500 bg-white/5" : "border-white/10"} text-left`}
                >
                  <div>
                    <div className="font-medium">{t.enTitle}</div>
                    {t.enDescription && <div className="text-xs text-gray-400">{t.enDescription}</div>}
                  </div>
                  <div>{checked ? <Check className="w-4 h-4 text-green-400" /> : null}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
