// app/user/tabs/EarningTab.tsx
"use client";
import React, { useEffect, useState } from "react";

type PageItem = {
  id: string;
  title: string;
  description?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
};

async function safeFetchJson(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, rawText: text, json: null };
  }
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

export default function EarningTab() {
  const [pages, setPages] = useState<PageItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    safeFetchJson("/api/user/pages", { method: "GET", credentials: "include" })
      .then((r) => {
        if (!alive) return;
        if (r.ok && r.json?.ok) setPages(r.json.pages || []);
        else {
          setPages([]);
          setError(r.json?.error || r.rawText || `Status ${r.status}`);
        }
      })
      .catch((e) => {
        console.error("fetch pages error", e);
        setPages([]);
        setError("Could not load pages");
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  async function addPage() {
    setError(null);
    const title = newTitle.trim();
    const description = newDesc.trim();
    if (!title) { setError("Please enter a title"); return; }

    // client-side duplicate-check
    if (pages?.some(p => p.title.toLowerCase() === title.toLowerCase())) {
      setError("You already have a page with this title");
      return;
    }

    const temp: PageItem = {
      id: `temp-${Date.now()}`,
      title,
      description,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };

    // optimistic update
    setPages(prev => prev ? [temp, ...prev] : [temp]);
    setAdding(true);

    try {
      const resp = await safeFetchJson("/api/user/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, description }),
      });

      if (!resp.ok) {
        const m = resp.json?.error || resp.rawText || `Status ${resp.status}`;
        throw new Error(m);
      }
      if (!resp.json?.ok) throw new Error(resp.json?.error || "Unknown error");

      const created = resp.json.page as PageItem;
      // replace temp with the real server page
      setPages(prev => prev ? prev.map(p => p.id === temp.id ? created : p) : [created]);
      setNewTitle("");
      setNewDesc("");
    } catch (err: any) {
      console.error("add page error", err);
      // rollback optimistic
      setPages(prev => prev ? prev.filter(p => p.id !== temp.id) : []);
      setError(err?.message || "Failed to add page");
    } finally {
      setAdding(false);
    }
  }

  // Helper you can wire later to remove a page
  async function deletePage(id: string) {
    // Implement and call your DELETE route when ready.
    // Example (not implemented server-side yet):
    // await fetch(`/api/user/pages/${id}`, { method: 'DELETE', credentials: 'include' });
    setPages(prev => prev ? prev.filter(p => p.id !== id) : prev);
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Earning Overview</h3>

      <p className="text-sm text-gray-300 mb-4">Steps today: 100 • Sleep: 3h • Water: 0.5L</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {loading ? (
          <div className="col-span-2 p-4 bg-white/6 rounded">Loading pages…</div>
        ) : (pages && pages.length > 0 ? (
          pages.map((b) => (
            <div key={b.id} className="p-4 bg-black/40 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{b.title}</div>
                  {b.description && <div className="text-sm text-gray-400 mt-2">{b.description}</div>}
                  <div className="text-xs text-gray-500 mt-2">Created {new Date(b.createdAt).toLocaleString()}</div>
                </div>

                {/* Actions (extend: navigate to page, edit, delete) */}
                <div className="flex flex-col gap-2 text-right">
                  <button className="text-xs px-2 py-1 rounded bg-white/6">View</button>
                  <button onClick={() => deletePage(b.id)} className="text-xs px-2 py-1 rounded bg-red-600">Delete</button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 p-4 bg-white/6 rounded">No pages yet — add one below.</div>
        ))}
      </div>

      <div className="p-4 bg-black/40 rounded mb-4">
        <div className="mb-2 text-sm text-gray-300">Create a new page/business</div>

        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Page or business name"
          className="w-full p-2 rounded bg-white/6 mb-2"
        />
        <textarea
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Short description (optional)"
          className="w-full p-2 rounded bg-white/6 mb-2"
          rows={3}
        />
        {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={() => { setNewTitle(""); setNewDesc(""); setError(null); }} className="px-4 py-2 rounded bg-gray-700" disabled={adding}>
            Cancel
          </button>
          <button onClick={addPage} className="px-4 py-2 rounded bg-green-600" disabled={adding}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
