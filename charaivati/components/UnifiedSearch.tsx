"use client";
import React, { useEffect, useRef, useState } from "react";

type PageResult = { id: string; title: string; description?: string | null; avatarUrl?: string | null };
type UserResult = { id: string; name?: string | null; slug?: string | null; avatarUrl?: string | null };
type Result = { type: "page"; data: PageResult } | { type: "user"; data: UserResult };

export default function UnifiedSearch({
  initialMode = "pages",
  placeholder,
  onFollowPage,
  onUnfollowPage,
  onSendFriend,
  friendState,
  pageFetchUrl = "/api/user/pages",
}: {
  initialMode?: "pages" | "people";
  placeholder?: string;
  onFollowPage: (pageId: string) => Promise<void>;
  onUnfollowPage?: (pageId: string) => Promise<void>;
  onSendFriend: (userId: string) => Promise<void>;
  friendState?: { friends?: string[]; outgoing?: string[]; incoming?: string[] };
  pageFetchUrl?: string;
}) {
  const [mode, setMode] = useState<"pages" | "people">(initialMode);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        if (mode === "pages") {
          const tried = [
            `${pageFetchUrl}?q=${encodeURIComponent(q)}`,
            `${pageFetchUrl}?query=${encodeURIComponent(q)}`,
            `/api/pages/search?q=${encodeURIComponent(q)}`,
          ];
          let res: Response | null = null;
          let lastJson: any = null;
          for (const url of tried) {
            try {
              res = await fetch(url, { credentials: "include" });
              const txt = await res.text();
              try { lastJson = JSON.parse(txt); } catch { lastJson = txt; }
              if (res.ok) break;
            } catch (err) {
              res = null;
            }
          }
          if (!res) {
            setResults([]);
            setOpen(false);
            return;
          }
          const pages: PageResult[] = (lastJson?.pages ?? lastJson?.data ?? (Array.isArray(lastJson) ? lastJson : [])).slice?.(0, 20) ?? [];
          setResults(pages.map((p: any) => ({ type: "page", data: p })));
          setOpen(true);
        } else {
          const url = `/api/users/search?q=${encodeURIComponent(q)}`;
          const res = await fetch(url, { credentials: "include" });
          const json = await res.json().catch(() => null);
          const users: UserResult[] = json?.users ?? json?.data ?? (Array.isArray(json) ? json : []);
          setResults((users ?? []).slice(0, 20).map((u: any) => ({ type: "user", data: u })));
          setOpen(true);
        }
      } catch (err) {
        console.error("UnifiedSearch error", err);
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 260);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [q, mode, pageFetchUrl]);

  function isFriend(userId: string) {
    return !!(friendState?.friends ?? []).includes(userId);
  }
  function isOutgoing(userId: string) {
    return !!(friendState?.outgoing ?? []).includes(userId);
  }
  function isIncoming(userId: string) {
    return !!(friendState?.incoming ?? []).includes(userId);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex gap-2 items-center mb-3">
        <div className="bg-white/6 rounded p-1 flex items-center">
          <button
            onClick={() => setMode("pages")}
            className={`px-3 py-1 text-sm rounded ${mode === "pages" ? "bg-white/10" : "hover:bg-white/5"}`}
          >
            Pages
          </button>
          <button
            onClick={() => setMode("people")}
            className={`ml-1 px-3 py-1 text-sm rounded ${mode === "people" ? "bg-white/10" : "hover:bg-white/5"}`}
          >
            People
          </button>
        </div>

        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); }}
          onFocus={() => { if (results.length) setOpen(true); }}
          placeholder={placeholder ?? (mode === "pages" ? "Search pages by title..." : "Search people by name...")}
          className="flex-1 p-2 rounded bg-black/40"
        />
        <button onClick={() => { if (mode === "pages" && results.length) {
            const item = results[0]; if (item?.type === "page") onFollowPage(item.data.id);
          } else if (mode === "people" && results.length) {
            const item = results[0]; if (item?.type === "user") onSendFriend(item.data.id);
          }}} className="px-3 py-1 rounded bg-green-600">
          {mode === "pages" ? "Follow" : "Add friend"}
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-40 rounded bg-black/60 border border-white/6 shadow max-h-72 overflow-auto p-1">
          {loading && <div className="p-3 text-sm text-gray-400">Searching…</div>}
          {!loading && results.length === 0 && <div className="p-3 text-sm text-gray-400">No matches found.</div>}

          {!loading && results.map((r, idx) => {
            if (r.type === "page") {
              const p = r.data;
              const following = false; // if you want to show followed state, pass page list and check here
              return (
                <div key={`page-${p.id}-${idx}`} className="flex items-center justify-between p-2 hover:bg-white/3 rounded cursor-pointer">
                  <div>
                    <div className="font-medium text-white">{p.title}</div>
                    {p.description && <div className="text-xs text-gray-400">{p.description}</div>}
                  </div>
                  <div className="flex gap-2">
                    {onUnfollowPage ? (
                      <button onClick={async (ev) => { ev.stopPropagation(); if (following) await onUnfollowPage(p.id); else await onFollowPage(p.id); }} className="px-2 py-1 rounded bg-white/10">
                        {following ? "Unfollow" : "Follow"}
                      </button>
                    ) : (
                      <button onClick={async (ev) => { ev.stopPropagation(); await onFollowPage(p.id); }} className="px-2 py-1 rounded bg-white/10">Follow</button>
                    )}
                  </div>
                </div>
              );
            } else {
              const u = r.data;
              const friend = isFriend(u.id);
              const outgoing = isOutgoing(u.id);
              const incoming = isIncoming(u.id);
              return (
                <div key={`user-${u.id}-${idx}`} className="flex items-center justify-between p-2 hover:bg-white/3 rounded">
                  <div className="flex items-center gap-3">
                    <img src={u.avatarUrl ?? "/avatar-placeholder.png"} alt="" className="w-8 h-8 rounded-full" />
                    <div>
                      <div className="font-medium text-white">{u.name ?? u.slug ?? u.id}</div>
                      <div className="text-xs text-gray-400">{u.slug ?? ""}</div>
                    </div>
                  </div>

                  <div>
                    {friend ? (
                      <button onClick={async () => { /* add unfriend if/when you support it */ }} className="px-3 py-1 rounded bg-white/10">Unfriend</button>
                    ) : outgoing ? (
                      <button className="px-3 py-1 rounded bg-gray-600">Requested</button>
                    ) : incoming ? (
                      <button className="px-3 py-1 rounded bg-white/10">They requested</button>
                    ) : (
                      <button onClick={async () => { await onSendFriend(u.id); }} className="px-3 py-1 rounded bg-green-600">Add friend</button>
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
