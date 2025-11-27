// AdminPageOfContent.tsx
// React + Next.js (app router) client component
// Place under: app/admin/page-of-content/page.tsx

"use client";

import React, { useEffect, useState } from "react";

// Small helper types (mirror Prisma)
type Page = { id: number; name: string; slug: string };
type Dashboard = { id: number; name: string; slug: string; pageId: number | null; url?: string };

export default function AdminPageOfContent() {
  const [pages, setPages] = useState<Page[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(false);

  // form state for new page
  const [newPageName, setNewPageName] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");

  // form state for new dashboard
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardSlug, setNewDashboardSlug] = useState("");
  const [newDashboardPageId, setNewDashboardPageId] = useState<number | null>(null);
  const [newDashboardUrl, setNewDashboardUrl] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [pRes, dRes] = await Promise.all([
        fetch("/api/admin/pages").then((r) => r.json()),
        fetch("/api/admin/dashboards").then((r) => r.json()),
      ]);
      setPages(pRes);
      setDashboards(dRes);
    } catch (err) {
      console.error(err);
      alert("Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function createPage(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name: newPageName.trim(), slug: newPageSlug.trim() };
    if (!payload.name || !payload.slug) return alert("Name + slug required");
    const res = await fetch("/api/admin/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      setNewPageName("");
      setNewPageSlug("");
      fetchAll();
    } else {
      const j = await res.json();
      alert(j.message || "failed");
    }
  }

  async function createDashboard(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name: newDashboardName.trim(), slug: newDashboardSlug.trim(), pageId: newDashboardPageId, url: newDashboardUrl.trim() };
    if (!payload.name || !payload.slug) return alert("Name + slug required");
    const res = await fetch("/api/admin/dashboards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      setNewDashboardName("");
      setNewDashboardSlug("");
      setNewDashboardPageId(null);
      setNewDashboardUrl("");
      fetchAll();
    } else {
      const j = await res.json();
      alert(j.message || "failed");
    }
  }

  async function assignDashboardToPage(dId: number, pageId: number | null) {
    const res = await fetch(`/api/admin/dashboards/${dId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId }) });
    if (res.ok) fetchAll(); else alert("failed to assign");
  }

  async function deleteDashboard(dId: number) {
    if (!confirm("Delete dashboard?")) return;
    const res = await fetch(`/api/admin/dashboards/${dId}`, { method: "DELETE" });
    if (res.ok) fetchAll(); else alert("failed to delete");
  }

  async function deletePage(pId: number) {
    if (!confirm("Delete page? This will unassign dashboards that belong to it.")) return;
    const res = await fetch(`/api/admin/pages/${pId}`, { method: "DELETE" });
    if (res.ok) fetchAll(); else alert("failed to delete");
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Page of Content — Admin</h1>

      <section className="grid grid-cols-2 gap-6 mb-8">
        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">Create page</h2>
          <form onSubmit={createPage} className="space-y-2">
            <input className="w-full p-2 border rounded" placeholder="Page name (e.g. sahayak)" value={newPageName} onChange={(e) => setNewPageName(e.target.value)} />
            <input className="w-full p-2 border rounded" placeholder="slug (e.g. sahayak)" value={newPageSlug} onChange={(e) => setNewPageSlug(e.target.value)} />
            <div className="flex gap-2">
              <button className="px-3 py-2 bg-slate-800 text-white rounded" type="submit">Create</button>
              <button className="px-3 py-2 border rounded" type="button" onClick={() => { setNewPageName(""); setNewPageSlug(""); }}>Reset</button>
            </div>
          </form>
        </div>

        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-2">Create dashboard/tab</h2>
          <form onSubmit={createDashboard} className="space-y-2">
            <input className="w-full p-2 border rounded" placeholder="Dashboard name (EPFO)" value={newDashboardName} onChange={(e) => setNewDashboardName(e.target.value)} />
            <input className="w-full p-2 border rounded" placeholder="slug (epfo)" value={newDashboardSlug} onChange={(e) => setNewDashboardSlug(e.target.value)} />
            <input className="w-full p-2 border rounded" placeholder="optional url (iframe / embeddable)" value={newDashboardUrl} onChange={(e) => setNewDashboardUrl(e.target.value)} />
            <label className="block text-sm">Assign to page</label>
            <select className="w-full p-2 border rounded" value={newDashboardPageId ?? ""} onChange={(e) => setNewDashboardPageId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">(none)</option>
              {pages.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.slug}</option>)}
            </select>
            <div className="flex gap-2">
              <button className="px-3 py-2 bg-slate-800 text-white rounded" type="submit">Create</button>
              <button className="px-3 py-2 border rounded" type="button" onClick={() => { setNewDashboardName(""); setNewDashboardSlug(""); setNewDashboardPageId(null); setNewDashboardUrl(""); }}>Reset</button>
            </div>
          </form>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Pages</h2>
        <div className="grid gap-3">
          {loading ? <div>Loading...</div> : pages.map((p) => (
            <div key={p.id} className="p-3 border rounded flex justify-between items-center">
              <div>
                <div className="font-medium">{p.name} <span className="text-sm text-slate-500">/{p.slug}</span></div>
                <div className="text-sm text-slate-600">Dashboards: {dashboards.filter(d => d.pageId === p.id).map(d => d.name).join(", ") || "—"}</div>
              </div>
              <div className="flex gap-2">
                <a className="px-2 py-1 border rounded" href={`/admin/pages/${p.slug}`} target="_blank">Open</a>
                <button className="px-2 py-1 border rounded" onClick={() => deletePage(p.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">All Dashboards / Tabs</h2>
        <div className="space-y-2">
          {dashboards.map((d) => (
            <div key={d.id} className="p-3 border rounded flex items-center justify-between">
              <div>
                <div className="font-medium">{d.name} <span className="text-sm text-slate-500">/{d.slug}</span></div>
                <div className="text-sm text-slate-600">Assigned to: {d.pageId ? (pages.find(p=>p.id===d.pageId)?.name ?? d.pageId) : "(none)"}</div>
                <div className="text-sm text-slate-600">URL: {d.url || '—'}</div>
              </div>

              <div className="flex items-center gap-2">
                <select value={d.pageId ?? ""} onChange={(e) => assignDashboardToPage(d.id, e.target.value ? Number(e.target.value) : null)} className="p-1 border rounded">
                  <option value="">(none)</option>
                  {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="px-2 py-1 border rounded" onClick={() => deleteDashboard(d.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
