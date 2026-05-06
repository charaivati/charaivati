"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import BannerEditForm from "./BannerEditForm";
import type { StoreFilterItem } from "./FilterBar";
import type { StoreBannerData } from "./BannerZone";

interface Section { id: string; title: string }

interface ManageFiltersPanelProps {
  storeId: string;
  filters: StoreFilterItem[];
  sections: Section[];
  globalBanner: StoreBannerData | null;
  onClose: (updated: StoreFilterItem[], updatedGlobalBanner: StoreBannerData | null) => void;
}

export default function ManageFiltersPanel({ storeId, filters: initialFilters, sections, globalBanner: initialGlobalBanner, onClose }: ManageFiltersPanelProps) {
  const [filters, setFilters] = useState<StoreFilterItem[]>(initialFilters);
  const [globalBanner, setGlobalBanner] = useState<StoreBannerData | null>(initialGlobalBanner);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editNames, setEditNames] = useState<Record<string, string>>({});
  const [useGlobalBanner, setUseGlobalBanner] = useState<Record<string, boolean>>({});
  const [pendingSections, setPendingSections] = useState<Record<string, string[]>>({});
  const [newFilterName, setNewFilterName] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [showGlobalBannerEdit, setShowGlobalBannerEdit] = useState(false);

  useEffect(() => {
    const ugb: Record<string, boolean> = {};
    const en: Record<string, string> = {};
    const ps: Record<string, string[]> = {};
    initialFilters.forEach((f) => {
      ugb[f.id] = !f.bannerId;
      en[f.id] = f.name;
      ps[f.id] = f.sectionIds;
    });
    setUseGlobalBanner(ugb);
    setEditNames(en);
    setPendingSections(ps);
  }, [initialFilters]);

  function toggleExpand(filterId: string) {
    setExpandedId((prev) => (prev === filterId ? null : filterId));
  }

  async function addFilter() {
    if (!newFilterName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/store/${storeId}/filters`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ name: newFilterName.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setFilters((prev) => [...prev, data.filter]);
        setEditNames((prev) => ({ ...prev, [data.filter.id]: data.filter.name }));
        setUseGlobalBanner((prev) => ({ ...prev, [data.filter.id]: true }));
        setPendingSections((prev) => ({ ...prev, [data.filter.id]: [] }));
        setNewFilterName("");
      }
    } finally {
      setAdding(false);
    }
  }

  async function deleteFilter(filterId: string) {
    if (!confirm("Delete this filter?")) return;
    const res = await fetch(`/api/store/${storeId}/filters/${filterId}`, { method: "DELETE", credentials: "include" });
    if ((await res.json()).ok) {
      setFilters((prev) => prev.filter((f) => f.id !== filterId));
      if (expandedId === filterId) setExpandedId(null);
    }
  }

  async function saveFilter(filterId: string) {
    setSaving(filterId);
    const name = editNames[filterId] ?? "";
    const sectionIds = pendingSections[filterId] ?? [];
    const useGlobal = useGlobalBanner[filterId] ?? true;
    const currentBannerId = useGlobal ? null : (filters.find((f) => f.id === filterId)?.bannerId ?? null);
    try {
      await Promise.all([
        fetch(`/api/store/${storeId}/filters/${filterId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ name, bannerId: currentBannerId }),
        }),
        fetch(`/api/store/${storeId}/filters/${filterId}/sections`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ sectionIds }),
        }),
      ]);
      setFilters((prev) => prev.map((f) => f.id === filterId ? { ...f, name, sectionIds, bannerId: currentBannerId } : f));
      setExpandedId(null);
    } finally {
      setSaving(null);
    }
  }

  const inputCls = "w-full text-sm px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={() => onClose(filters, globalBanner)}>
      <div
        className="relative h-full w-full max-w-sm bg-gray-950 border-l border-gray-800 overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
          <h2 className="text-[17px] font-bold text-white">Manage Filters</h2>
          <button onClick={() => onClose(filters, globalBanner)} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-3">
          {/* Global banner */}
          <div className="p-3 rounded-xl border border-gray-800 bg-gray-900/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">Global Banner</span>
              <button onClick={() => setShowGlobalBannerEdit((v) => !v)} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                <Pencil size={11} /> {globalBanner ? "Edit" : "Add"}
              </button>
            </div>
            {globalBanner && <p className="text-xs text-gray-500 mt-1 truncate">{globalBanner.heading ?? globalBanner.imageUrl ?? "Banner set"}</p>}
            {showGlobalBannerEdit && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <BannerEditForm
                  storeId={storeId}
                  banner={globalBanner}
                  isGlobal={true}
                  onSaved={(b) => { setGlobalBanner(b); setShowGlobalBannerEdit(false); }}
                  onCleared={() => { setGlobalBanner(null); setShowGlobalBannerEdit(false); }}
                />
              </div>
            )}
          </div>

          {/* "All" — locked */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-800 bg-gray-900/30">
            <span className="text-sm text-gray-400 font-medium">All</span>
            <span className="text-[11px] font-mono text-gray-600 uppercase tracking-wider">Default view</span>
          </div>

          {/* Custom filters */}
          {filters.map((filter) => {
            const isExpanded = expandedId === filter.id;
            return (
              <div key={filter.id} className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button onClick={() => toggleExpand(filter.id)} className="flex-1 flex items-center gap-2 text-left">
                    <span className="text-sm font-medium text-white">{editNames[filter.id] ?? filter.name}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-gray-500 ml-auto" /> : <ChevronDown size={14} className="text-gray-500 ml-auto" />}
                  </button>
                  <button onClick={() => deleteFilter(filter.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                    <Trash2 size={13} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-800 space-y-3">
                    <div>
                      <label className="block text-[11px] font-mono font-semibold text-gray-500 uppercase tracking-[0.08em] mb-1.5">Filter Name</label>
                      <input value={editNames[filter.id] ?? filter.name} onChange={(e) => setEditNames((prev) => ({ ...prev, [filter.id]: e.target.value }))} className={inputCls} />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono font-semibold text-gray-500 uppercase tracking-[0.08em] mb-1.5">Banner</label>
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          checked={useGlobalBanner[filter.id] ?? true}
                          onChange={(e) => setUseGlobalBanner((prev) => ({ ...prev, [filter.id]: e.target.checked }))}
                          className="rounded border-gray-600"
                        />
                        <span className="text-sm text-gray-300">Use global banner</span>
                      </label>
                      {!(useGlobalBanner[filter.id] ?? true) && (
                        <BannerEditForm
                          storeId={storeId}
                          banner={filter.banner as StoreBannerData | null}
                          isGlobal={false}
                          onSaved={(b) => setFilters((prev) => prev.map((f) => f.id === filter.id ? { ...f, bannerId: b.id, banner: b } : f))}
                          onCleared={() => {
                            setFilters((prev) => prev.map((f) => f.id === filter.id ? { ...f, bannerId: null, banner: null } : f));
                            setUseGlobalBanner((prev) => ({ ...prev, [filter.id]: true }));
                          }}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono font-semibold text-gray-500 uppercase tracking-[0.08em] mb-1.5">Visible Sections</label>
                      {sections.length === 0 ? (
                        <p className="text-xs text-gray-600">No sections yet.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {sections.map((sec) => (
                            <label key={sec.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(pendingSections[filter.id] ?? []).includes(sec.id)}
                                onChange={(e) => setPendingSections((prev) => {
                                  const cur = prev[filter.id] ?? [];
                                  return { ...prev, [filter.id]: e.target.checked ? [...cur, sec.id] : cur.filter((id) => id !== sec.id) };
                                })}
                                className="rounded border-gray-600"
                              />
                              <span className="text-sm text-gray-300">{sec.title}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => saveFilter(filter.id)}
                      disabled={saving === filter.id}
                      className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {saving === filter.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add filter */}
          <div className="flex gap-2 pt-1">
            <input
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addFilter(); }}
              placeholder="New filter name…"
              className={inputCls + " flex-1"}
            />
            <button onClick={addFilter} disabled={adding || !newFilterName.trim()} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50">
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
