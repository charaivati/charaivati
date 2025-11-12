"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Plus, Save, X } from "lucide-react";

type Language = { code: string; name: string };
type Row = {
  tabId: string;
  slug: string;
  enTitle: string;
  enDescription?: string | null;
  translation?: { title: string; description?: string | null } | null;
};

export default function AdminTranslationsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [locale, setLocale] = useState("en");
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Record<string, { title: string; description: string }>>({});
  const [newRow, setNewRow] = useState<{ title: string; description: string } | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/verify");
      const json = await res.json();
      setIsAdmin(!!json?.admin);
    })();
  }, []);

  useEffect(() => {
    if (isAdmin === false) return;
    (async () => {
      const res = await fetch("/api/languages");
      const json = await res.json();
      if (json.ok) setLanguages(json.data);
    })();
  }, [isAdmin]);

  async function loadData() {
    if (!locale) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("locale", locale);
      const res = await fetch(`/api/tab-translations?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setRows(json.data || []);
        setEditing({});
      } else setError(json.error || "Failed to load");
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, locale]);

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
        title: prev[tabId]?.title ?? rows.find((r) => r.tabId === tabId)?.translation?.title ?? "",
        description:
          prev[tabId]?.description ?? rows.find((r) => r.tabId === tabId)?.translation?.description ?? "",
        [field]: value,
      },
    }));
  }

  function onNewEdit(field: "title" | "description", value: string) {
    setNewRow((prev) => ({
      title: prev?.title ?? "",
      description: prev?.description ?? "",
      [field]: value,
    }));
  }

  async function saveNew() {
    if (!newRow?.title.trim()) {
      alert("Title is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newRow.title, description: newRow.description }),
      });
      const json = await res.json();
      if (json.ok) {
        const newTabId = json.data.id;
        const newTab: Row = {
          tabId: newTabId,
          slug: json.data.slug,
          enTitle: newRow.title,
          enDescription: newRow.description,
          translation: null,
        };

        // If not English, save translation immediately
        if (locale !== "en") {
          const transRes = await fetch("/api/tab-translations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              locale,
              rows: [{ tabId: newTabId, title: newRow.title, description: newRow.description }],
            }),
          });
          const transJson = await transRes.json();
          if (transJson.ok) {
            newTab.translation = { title: newRow.title, description: newRow.description };
          }
        }

        setRows([newTab, ...rows]);
        setNewRow(null);
      } else {
        alert(json.error || "Failed to add word");
      }
    } catch (e) {
      alert(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    if (Object.keys(editing).length === 0 && !newRow) {
      alert("No changes to save");
      return;
    }

    setSaving(true);
    try {
      if (locale === "en") {
        const payload = Object.entries(editing).map(([tabId, e]) => ({
          id: tabId,
          title: e.title,
          description: e.description,
        }));
        if (payload.length > 0) {
          const res = await fetch("/api/admin/tabs", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: payload }),
          });
          const json = await res.json();
          if (!json.ok) throw new Error(json.error);
        }
      } else {
        const rowsToSave = Object.entries(editing).map(([tabId, e]) => ({
          tabId,
          title: e.title,
          description: e.description,
        }));
        if (rowsToSave.length > 0) {
          const res = await fetch("/api/tab-translations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale, rows: rowsToSave }),
          });
          const json = await res.json();
          if (!json.ok) throw new Error(json.error);
        }
      }
      await loadData();
      alert("Saved successfully!");
    } catch (e: any) {
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (isAdmin === false) return <div className="p-10 text-red-400">Access denied</div>;
  if (isAdmin === null) return <div className="p-10 text-gray-400">Verifying admin...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto text-white">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">🌐 Translations Manager</h2>
      </div>

      <div className="flex gap-4 mb-6">
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          className="bg-gray-900 border border-gray-700 px-3 py-2 rounded"
        >
          <option value="en">English</option>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search..."
          className="bg-gray-800 border border-gray-700 px-3 py-2 rounded flex-1"
        />
        <button
          onClick={saveAll}
          disabled={saving || (Object.keys(editing).length === 0 && !newRow)}
          className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save All"}
        </button>
      </div>

      {loading && <div className="text-gray-400">Loading...</div>}
      {error && <div className="text-red-400 mb-2">{error}</div>}

      <div className="overflow-auto border border-gray-800 rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-900">
            <tr>
              <th className="p-2 text-left">Slug</th>
              <th className="p-2 text-left w-1/4">English Title</th>
              <th className="p-2 text-left w-1/4">English Description</th>
              <th className="p-2 text-left w-1/4">{locale === "en" ? "Title" : `${locale} Title`}</th>
              <th className="p-2 text-left w-1/4">{locale === "en" ? "Description" : `${locale} Description`}</th>
            </tr>
          </thead>
          <tbody>
            {/* New Row Input */}
            {newRow && (
              <tr className="border-t border-gray-800 bg-gray-950">
                <td className="p-2 align-top text-gray-500">[new]</td>
                <td className="p-2">
                  <input
                    value={newRow.title}
                    onChange={(e) => onNewEdit("title", e.target.value)}
                    placeholder="Enter English title"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
                  />
                </td>
                <td className="p-2">
                  <input
                    value={newRow.description}
                    onChange={(e) => onNewEdit("description", e.target.value)}
                    placeholder="Optional description"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1"
                  />
                </td>
                <td colSpan={2} className="p-2 text-center text-gray-400">
                  {locale !== "en" && "Will be same as English for now"}
                </td>
                <td className="p-2 flex gap-1">
                  <button
                    onClick={saveNew}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setNewRow(null)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            )}

            {/* Existing Rows */}
            {visible.map((r) => {
              const edit = editing[r.tabId] ?? {
                title: r.translation?.title ?? "",
                description: r.translation?.description ?? "",
              };
              const isEdited = editing[r.tabId];
              return (
                <tr key={r.tabId} className={`border-t border-gray-800 ${isEdited ? "bg-gray-950" : ""}`}>
                  <td className="p-2 align-top text-gray-400 text-xs">{r.slug}</td>
                  <td className="p-2 align-top">{r.enTitle}</td>
                  <td className="p-2 align-top text-gray-300 text-sm">{r.enDescription}</td>
                  <td className="p-2">
                    <input
                      value={edit.title}
                      onChange={(e) => onEdit(r.tabId, "title", e.target.value)}
                      className={`w-full bg-gray-800 border rounded px-2 py-1 ${
                        isEdited ? "border-blue-500" : "border-gray-700"
                      }`}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      value={edit.description ?? ""}
                      onChange={(e) => onEdit(r.tabId, "description", e.target.value)}
                      className={`w-full bg-gray-800 border rounded px-2 py-1 ${
                        isEdited ? "border-blue-500" : "border-gray-700"
                      }`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add New Button */}
      {!newRow && (
        <button
          onClick={() => setNewRow({ title: "", description: "" })}
          className="mt-4 bg-green-600 hover:bg-green-700 px-4 py-2 rounded flex items-center gap-2"
        >
          <Plus size={16} />
          Add New Word
        </button>
      )}
    </div>
  );
}