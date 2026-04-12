// components/SelectTabsModal.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X, Check, Search } from "lucide-react";

type TabItem = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  category?: string | null;
  position?: number | null;
  translations?: Array<{ locale: string; title: string }>;
};

type SkillItem = {
  id: string;
  name: string;
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
  const [tabs, setTabs]           = useState<TabItem[]>([]);
  const [skills, setSkills]       = useState<SkillItem[]>([]);
  const [loadingTabs, setLoadingTabs]     = useState(true);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [selected, setSelected]   = useState<string[]>(initialSelected || []);
  const [tabSearch, setTabSearch]     = useState("");
  const [skillSearch, setSkillSearch] = useState("");

  useEffect(() => {
    let alive = true;

    fetch("/api/tabs")
      .then((r) => r.json())
      .then((j) => { if (alive) setTabs(j?.ok && Array.isArray(j.tabs) ? j.tabs : []); })
      .catch(() => alive && setTabs([]))
      .finally(() => alive && setLoadingTabs(false));

    fetch("/api/skills")
      .then((r) => r.json())
      .then((j) => { if (alive) setSkills(j?.ok && Array.isArray(j.skills) ? j.skills : []); })
      .catch(() => alive && setSkills([]))
      .finally(() => alive && setLoadingSkills(false));

    return () => { alive = false; };
  }, []);

  const toggle = (value: string) =>
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );

  // ── Tabs: filter + group ──────────────────────────────────────────────────
  const groupedTabs = useMemo(() => {
    const q = tabSearch.trim().toLowerCase();
    const arr = tabs
      .map((t) => {
        const localized = (t.translations || []).find((tr) => tr.locale === locale)?.title;
        return { ...t, displayTitle: localized || t.title || t.slug };
      })
      .filter((t) =>
        !q ||
        t.displayTitle.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q)
      )
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    const g: Record<string, typeof arr> = {};
    for (const t of arr) {
      const cat = t.category || "Other";
      if (!g[cat]) g[cat] = [];
      g[cat].push(t);
    }
    return g;
  }, [tabs, tabSearch, locale]);

  // ── Skills: filter ────────────────────────────────────────────────────────
  const filteredSkills = useMemo(() => {
    const q = skillSearch.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) => s.name.toLowerCase().includes(q));
  }, [skills, skillSearch]);

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl bg-gray-900 rounded-xl border border-gray-700 shadow-2xl flex flex-col" style={{ height: "min(80vh, 640px)" }}>

        {/* ── Modal header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700 shrink-0">
          <h3 className="text-sm font-semibold text-white">Select Tags</h3>
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <span className="text-xs text-gray-300 px-2 py-0.5 bg-gray-700 rounded-full">
                {selected.length} selected
              </span>
            )}
            <button
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors"
              onClick={() => onClose(undefined)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
              onClick={() => onClose(selected)}
            >
              Save
            </button>
            <button onClick={() => onClose(selected)} className="p-1.5 text-gray-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Two columns ── */}
        <div className="grid grid-cols-2 divide-x divide-gray-700 flex-1 min-h-0">

          {/* ── Left: Website Tabs ── */}
          <div className="flex flex-col min-h-0">
            {/* Column header + search */}
            <div className="px-3 py-2.5 border-b border-gray-700 shrink-0 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Website Tabs</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                <input
                  value={tabSearch}
                  onChange={(e) => setTabSearch(e.target.value)}
                  placeholder="Search tabs…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 outline-none focus:border-gray-500 transition-colors"
                />
              </div>
            </div>
            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1 p-3 space-y-4">
              {loadingTabs && <p className="text-gray-600 text-xs py-2">Loading…</p>}
              {!loadingTabs && tabs.length === 0 && <p className="text-gray-600 text-xs py-2">No tabs found</p>}
              {!loadingTabs && Object.keys(groupedTabs).length === 0 && tabs.length > 0 && (
                <p className="text-gray-600 text-xs py-2">No results</p>
              )}

              {Object.entries(groupedTabs).map(([category, items]) => (
                <div key={category}>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">{category}</p>
                  <div className="space-y-1">
                    {items.map((t) => {
                      const checked = selected.includes(t.slug);
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggle(t.slug)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                            checked
                              ? "bg-blue-600/20 border border-blue-500 text-white"
                              : "bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white"
                          }`}
                        >
                          <span className="text-xs truncate">{t.displayTitle}</span>
                          {checked && <Check className="w-3 h-3 text-blue-400 shrink-0 ml-2" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Skills ── */}
          <div className="flex flex-col min-h-0">
            {/* Column header + search */}
            <div className="px-3 py-2.5 border-b border-gray-700 shrink-0 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Skills</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                <input
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="Search skills…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 outline-none focus:border-gray-500 transition-colors"
                />
              </div>
            </div>
            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1 p-3 space-y-1">
              {loadingSkills && <p className="text-gray-600 text-xs py-2">Loading…</p>}
              {!loadingSkills && skills.length === 0 && (
                <p className="text-gray-600 text-xs py-2">No skills found yet.</p>
              )}
              {!loadingSkills && filteredSkills.length === 0 && skills.length > 0 && (
                <p className="text-gray-600 text-xs py-2">No results</p>
              )}

              {filteredSkills.map((skill) => {
                const checked = selected.includes(skill.name);
                return (
                  <button
                    key={skill.id}
                    onClick={() => toggle(skill.name)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                      checked
                        ? "bg-indigo-600/20 border border-indigo-500 text-white"
                        : "bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white"
                    }`}
                  >
                    <span className="text-xs truncate">{skill.name}</span>
                    {checked && <Check className="w-3 h-3 text-indigo-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
