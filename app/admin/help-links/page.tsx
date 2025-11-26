// app/admin/help-links/page.tsx
"use client";

import React, { useEffect, useState } from "react";

type TabItem = { tabId: string; slug: string; enTitle: string; translation?: { title?: string } };

export default function AdminHelpLinksPage() {
  const [links, setLinks] = useState<any[]>([]);
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>({ pageSlug: "", country: "India", title: "", url: "", notes: "", slugTags: [] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/help-links");
      const j = await r.json();
      setLinks(j?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
    fetch("/api/tab-translations?locale=en").then(r => r.json()).then(j => {
      if (j?.ok) setTabs(j.data || []);
    }).catch(() => setTabs([]));
  }, []);

  const submit = async () => {
    setErr(null);
    try {
      const payload = {
        pageSlug: form.pageSlug || null,
        country: form.country,
        title: form.title,
        url: form.url,
        notes: form.notes,
        slugTags: form.slugTags || [],
      };
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/help-links/${editingId}` : `/api/help-links`;
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "failed");
      setForm({ pageSlug: "", country: "India", title: "", url: "", notes: "", slugTags: [] });
      setEditingId(null);
      await loadLinks();
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  const startEdit = (l: any) => {
    setForm({ pageSlug: l.pageSlug || "", country: l.country || "All", title: l.title, url: l.url, notes: l.notes || "", slugTags: l.slugTags || [] });
    setEditingId(l.id);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete link?")) return;
    try {
      const r = await fetch(`/api/help-links/${id}`, { method: "DELETE" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "delete failed");
      await loadLinks();
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl mb-4">Manage Help Links (Admin)</h1>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input value={form.pageSlug} onChange={e => setForm({ ...form, pageSlug: e.target.value })} placeholder="pageSlug (epfo)" className="p-2 border" />
        <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="country" className="p-2 border" />
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="title" className="p-2 border col-span-3 md:col-span-1" />
        <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="url" className="p-2 border col-span-3" />
        <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="notes" className="p-2 border col-span-3" />
      </div>

      <div className="mb-4">
        <div className="text-sm font-medium mb-2">Tag to tabs (select):</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-auto border p-2 rounded">
          {tabs.map(t => {
            const checked = (form.slugTags || []).includes(t.slug);
            return (
              <label key={t.slug} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={checked} onChange={(e) => {
                  const next = new Set(form.slugTags || []);
                  if (e.target.checked) next.add(t.slug); else next.delete(t.slug);
                  setForm({ ...form, slugTags: Array.from(next) });
                }} />
                <span>{t.translation?.title ?? t.enTitle ?? t.slug}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={submit} className="px-3 py-2 bg-green-600 text-white rounded">{editingId ? "Save" : "Create"}</button>
        <button onClick={() => { setForm({ pageSlug: "", country: "India", title: "", url: "", notes: "", slugTags: [] }); setEditingId(null); }} className="px-3 py-2 bg-gray-600 text-white rounded">Reset</button>
      </div>

      {err && <div className="text-red-500 mb-4">{err}</div>}

      <div>
        {loading ? <div>Loading...</div> : (
          <table className="w-full text-sm border-collapse">
            <thead><tr className="text-left"><th className="px-2 py-1">page</th><th className="px-2 py-1">title</th><th className="px-2 py-1">country</th><th className="px-2 py-1">url</th><th className="px-2 py-1">tags</th><th className="px-2 py-1">actions</th></tr></thead>
            <tbody>
              {links.map(l => (
                <tr key={l.id} className="border-t">
                  <td className="px-2 py-1">{l.pageSlug}</td>
                  <td className="px-2 py-1">{l.title}</td>
                  <td className="px-2 py-1">{l.country}</td>
                  <td className="px-2 py-1"><a href={l.url} target="_blank" rel="noreferrer" className="text-blue-600">{l.url}</a></td>
                  <td className="px-2 py-1">{(l.slugTags || []).join(", ")}</td>
                  <td className="px-2 py-1">
                    <button onClick={() => startEdit(l)} className="text-blue-600 mr-2">Edit</button>
                    <button onClick={() => remove(l.id)} className="text-red-600">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
