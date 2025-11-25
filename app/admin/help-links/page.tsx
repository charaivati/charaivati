// app/admin/help-links/page.tsx
"use client";

import React, { useEffect, useState } from "react";

export default function AdminHelpLinksPage() {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ pageSlug: "", country: "India", title: "", url: "", notes: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
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

  useEffect(() => { load(); }, []);

  const submit = async () => {
    setErr(null);
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/help-links/${editingId}` : `/api/help-links`;
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "failed");
      setForm({ pageSlug: "", country: "India", title: "", url: "", notes: "" });
      setEditingId(null);
      await load();
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  const startEdit = (l:any) => {
    setForm({ pageSlug: l.pageSlug, country: l.country, title: l.title, url: l.url, notes: l.notes || "" });
    setEditingId(l.id);
  };

  const del = async (id:string) => {
    if (!confirm("Delete?")) return;
    try {
      const r = await fetch(`/api/help-links/${id}`, { method: "DELETE" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "delete failed");
      await load();
    } catch (e:any) {
      alert(e.message || String(e));
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Manage Help Links (Admin)</h1>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <input placeholder="pageSlug (epfo)" value={form.pageSlug} onChange={e=>setForm({...form,pageSlug:e.target.value})} className="p-2" />
        <input placeholder="country" value={form.country} onChange={e=>setForm({...form,country:e.target.value})} className="p-2" />
        <input placeholder="title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="p-2" />
        <input placeholder="url" value={form.url} onChange={e=>setForm({...form,url:e.target.value})} className="p-2 col-span-2" />
        <input placeholder="notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="p-2 col-span-3" />
      </div>
      <div className="flex gap-2 mb-6">
        <button onClick={submit} className="px-3 py-2 bg-green-600 text-white rounded">{editingId ? "Save" : "Create"}</button>
        <button onClick={()=>{setForm({pageSlug:"",country:"India",title:"",url:"",notes:""});setEditingId(null)}} className="px-3 py-2 bg-gray-600 text-white rounded">Reset</button>
      </div>
      {err && <div className="text-red-500 mb-4">{err}</div>}

      <div>
        {loading ? <div>Loading...</div> : (
          <table className="w-full text-sm">
            <thead><tr><th>pageSlug</th><th>title</th><th>country</th><th>url</th><th>actions</th></tr></thead>
            <tbody>
              {links.map(l=>(
                <tr key={l.id} className="border-b">
                  <td className="px-2 py-1">{l.pageSlug}</td>
                  <td className="px-2 py-1">{l.title}</td>
                  <td className="px-2 py-1">{l.country}</td>
                  <td className="px-2 py-1"><a href={l.url} target="_blank" rel="noreferrer">{l.url}</a></td>
                  <td className="px-2 py-1">
                    <button onClick={()=>startEdit(l)} className="text-blue-600 mr-2">Edit</button>
                    <button onClick={()=>del(l.id)} className="text-red-600">Delete</button>
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
