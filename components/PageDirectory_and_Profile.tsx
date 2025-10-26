"use client";
import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type PageSummary = {
  id: string;
  title: string;
  description?: string | null;
  avatar?: string | null;
  ownerId?: string | null;
  status?: string;
  createdAt?: string | null;
};
type PageDetail = PageSummary & {
  owner?: { id: string; name?: string | null; avatar?: string | null } | null;
  updatedAt?: string | null;
};

export default function PageDirectory() {
  const [pages, setPages] = useState<PageSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch("/api/pages")
      .then((r) => r.json())
      .then((data) => { if (alive) setPages(data); })
      .catch(console.error)
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let alive = true;
    setLoadingDetail(true);
    fetch(`/api/pages/${selectedId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d) => { if (alive) setDetail(d); })
      .catch(console.error)
      .finally(() => alive && setLoadingDetail(false));
    return () => { alive = false; };
  }, [selectedId]);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Pages</h2>
          <div className="text-sm text-gray-600">{pages ? `${pages.length} pages` : "Loading..."}</div>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({length:6}).map((_,i) => <div key={i} className="h-28 bg-white rounded p-3 animate-pulse" />)}
          </div>
        ) : pages && pages.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {pages.map(p => (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className="text-left bg-white p-4 rounded-lg border hover:shadow transition">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-gray-200 overflow-hidden">
                    {p.avatar ? <img src={p.avatar} alt={p.title} className="w-full h-full object-cover" /> : <div className="text-sm text-gray-600 p-2">Pg</div>}
                  </div>
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-gray-500">{p.status}</div>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-600 line-clamp-2">{p.description ?? "No description"}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white p-6 rounded">No pages found</div>
        )}

        <AnimatePresence>
          {selectedId && (
            <motion.aside initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
              className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 overflow-auto">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold">{detail?.title ?? (loadingDetail ? "Loading..." : "Page")}</div>
                    <div className="text-sm text-gray-500">{detail?.status}</div>
                  </div>
                  <div>
                    <button onClick={() => setSelectedId(null)} className="px-3 py-2 rounded bg-gray-100">Close</button>
                  </div>
                </div>

                <div className="mt-4">
                  {loadingDetail ? (
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse"></div>
                      <div className="h-40 bg-gray-100 rounded animate-pulse"></div>
                    </div>
                  ) : detail ? (
                    <>
                      <div className="text-sm text-gray-700 mb-3">{detail.description ?? "No description."}</div>

                      <dl className="text-sm text-gray-700 space-y-2">
                        <div className="flex justify-between border rounded p-2"><dt className="text-gray-500">Owner</dt><dd>{detail.owner?.name ?? "-"}</dd></div>
                        <div className="flex justify-between border rounded p-2"><dt className="text-gray-500">Created</dt><dd>{detail.createdAt ?? "-"}</dd></div>
                        <div className="flex justify-between border rounded p-2"><dt className="text-gray-500">Updated</dt><dd>{detail.updatedAt ?? "-"}</dd></div>
                      </dl>

                      <div className="pt-4 border-t flex gap-2">
                        <button className="flex-1 rounded px-4 py-2 border">Follow</button>
                        <button className="rounded px-4 py-2 bg-blue-600 text-white">Edit</button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">No page data.</div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* backdrop */}
        <AnimatePresence>
          {selectedId && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} onClick={() => setSelectedId(null)} className="fixed inset-0 bg-black z-40" />}
        </AnimatePresence>
      </div>
    </div>
  );
}
