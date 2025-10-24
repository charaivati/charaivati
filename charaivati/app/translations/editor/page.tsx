// app/translations/editor/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Row = {
  tabId: string;
  slug: string;
  enTitle: string;
  enDescription?: string | null;
  translation?: { id: string; title: string; description?: string | null } | null;
};

export default function TranslationsEditorPage() {
  const [locale, setLocale] = useState("hi");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Record<string, { title: string; description: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // load rows
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("locale", locale);
        const res = await fetch(`/api/tab-translations?${params.toString()}`, { credentials: "include" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setError(json?.error || "Failed to fetch translations");
          return;
        }
        if (!alive) return;
        setRows(json.data || []);
        setEditing({}); // reset edits
      } catch (e: any) {
        setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [locale]);

  // filtered rows
  const visible = useMemo(() => {
    if (!filter) return rows;
    const q = filter.toLowerCase();
    return rows.filter(
      (r) =>
        r.enTitle.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.translation?.title ?? "").toLowerCase().includes(q)
    );
  }, [rows, filter]);

  function onEdit(tabId: string, field: "title" | "description", value: string) {
    setEditing((prev) => ({
      ...prev,
      [tabId]: {
        title:
          prev[tabId]?.title ??
          (rows.find((r) => r.tabId === tabId)?.translation?.title ?? ""),
        description:
          prev[tabId]?.description ??
          (rows.find((r) => r.tabId === tabId)?.translation?.description ?? ""),
        [field]: value,
      },
    }));
  }

  // validate duplicates before save: check duplicate translated titles
  function findDuplicates(): string[] {
    const titleCounts = new Map<string, number>();
    // build final titles (existing translation overwritten by edits)
    for (const r of rows) {
      const edit = editing[r.tabId];
      const finalTitle = (edit?.title ?? r.translation?.title ?? "").trim();
      if (!finalTitle) continue;
      titleCounts.set(finalTitle, (titleCounts.get(finalTitle) || 0) + 1);
    }
    return Array.from(titleCounts.entries()).filter(([_, c]) => c > 1).map(([t]) => t);
  }

  async function saveAll() {
    setError(null);
    const dups = findDuplicates();
    if (dups.length) {
      setError("Duplicate translation titles detected: " + dups.join(", "));
      return;
    }

    // build payload
    const payloadRows = rows
      .map((r) => {
        const edit = editing[r.tabId];
        if (!edit) return null;
        const title = (edit.title ?? "").trim();
        return { tabId: r.tabId, title, description: edit.description ?? null };
      })
      .filter(Boolean);

    if (payloadRows.length === 0) {
      setError("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/tab-translations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ locale, rows: payloadRows }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || "Save failed");
        return;
      }
      // refresh
      setEditing({});
      // reload rows from server
      const params = new URLSearchParams();
      params.set("locale", locale);
      const r2 = await fetch(`/api/tab-translations?${params.toString()}`, { credentials: "include" });
      const j2 = await r2.json().catch(() => null);
      if (j2?.ok) setRows(j2.data || []);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-xl mb-4">Translations editor</h2>

      <div className="flex gap-3 items-center mb-4">
        <label>Locale:</label>
        <input value={locale} onChange={(e) => setLocale(e.target.value)} className="border px-2 py-1 rounded" />
        <button onClick={() => { /* effect will reload */ }} className="px-3 py-1 bg-gray-800 rounded">Load</button>

        <div className="ml-auto flex items-center gap-2">
          <input placeholder="filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="border px-2 py-1 rounded" />
          <button onClick={() => { setFilter(""); }} className="px-3 py-1 bg-gray-800 rounded">Clear</button>
        </div>
      </div>

      {error && <div className="mb-3 text-red-400">{error}</div>}
      {loading && <div>Loading…</div>}

      <div className="overflow-auto border rounded">
        <table className="min-w-full">
          <thead className="bg-gray-900 text-left">
            <tr>
              <th className="p-2">Slug</th>
              <th className="p-2">English title</th>
              <th className="p-2">English description</th>
              <th className="p-2">Translation title ({locale})</th>
              <th className="p-2">Translation description</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const edit = editing[r.tabId] ?? { title: r.translation?.title ?? "", description: r.translation?.description ?? "" };
              return (
                <tr key={r.tabId} className="border-t">
                  <td className="p-2 align-top">{r.slug}</td>
                  <td className="p-2 align-top">{r.enTitle}</td>
                  <td className="p-2 align-top"><small>{r.enDescription}</small></td>
                  <td className="p-2">
                    <input
                      value={edit.title}
                      onChange={(e) => onEdit(r.tabId, "title", e.target.value)}
                      className="w-full border px-2 py-1 rounded bg-black/20"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      value={edit.description ?? ""}
                      onChange={(e) => onEdit(r.tabId, "description", e.target.value)}
                      className="w-full border px-2 py-1 rounded bg-black/20"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-3">
        <button onClick={saveAll} disabled={saving} className="px-4 py-2 bg-green-600 rounded">
          {saving ? "Saving…" : "Save translations"}
        </button>
        <button onClick={() => { setEditing({}); }} className="px-4 py-2 bg-gray-700 rounded">Reset edits</button>
        <div className="ml-auto text-sm text-gray-400">Showing {visible.length} rows (of {rows.length})</div>
      </div>
    </div>
  );
}
