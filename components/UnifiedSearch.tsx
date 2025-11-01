// components/UnifiedSearch.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

type ResultType = "person" | "page" | "unknown";

export type SearchResult = {
  id: string;
  type: ResultType;
  name: string;
  subtitle?: string;
  avatarUrl?: string | null;
  [k: string]: any;
};

type FriendState = {
  friends: string[]; // user ids that are friends
  outgoing: string[]; // outgoing friend requests
  incoming: string[]; // incoming friend requests
  following: string[]; // page ids that current user follows
};

type Props = {
  placeholder?: string;
  onFollowPage?: (pageId: string) => Promise<void> | void;
  onSendFriend?: (userId: string) => Promise<void> | void;
  onActionComplete?: (kind: "page" | "person", id: string, status: "following" | "requested" | "friends") => void;
  friendState?: FriendState | null;
  initialQuery?: string;
  className?: string;
};

const DEBOUNCE_MS = 250;

export default function UnifiedSearch({
  placeholder = "Search people or pages…",
  onFollowPage,
  onSendFriend,
  onActionComplete,
  friendState = { friends: [], outgoing: [], incoming: [], following: [] },
  initialQuery = "",
  className = "",
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  // helpers
  function pickActionTarget(): { type: ResultType | "query"; id?: string; name?: string } | null {
    if (highlightIndex >= 0 && highlightIndex < results.length) {
      const r = results[highlightIndex];
      return { type: r.type, id: r.id, name: r.name };
    }
    if (results.length > 0) {
      const lower = query.trim().toLowerCase();
      const exact = results.find((r) => r.name?.toLowerCase() === lower);
      if (exact) return { type: exact.type, id: exact.id, name: exact.name };
    }
    return null;
  }

  // get current action button state for given target
  function actionButtonStateFor(target: { type: any; id?: string } | null) {
    if (!target || !target.id) return { label: null, disabled: false };
    if (target.type === "page") {
      if ((friendState?.following ?? []).includes(target.id)) return { label: "Following", disabled: true };
      return { label: "Follow", disabled: false };
    } else if (target.type === "person") {
      if ((friendState?.friends ?? []).includes(target.id)) return { label: "Friends", disabled: true };
      if ((friendState?.outgoing ?? []).includes(target.id)) return { label: "Requested", disabled: true };
      if ((friendState?.incoming ?? []).includes(target.id)) return { label: "Respond", disabled: false };
      return { label: "Add friend", disabled: false };
    }
    return { label: null, disabled: false };
  }

  async function fetchResults(q: string) {
    if (!q || q.trim().length === 0) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      // Expect /api/search?q=...
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Search failed (${res.status})`);
      }
      const data = await res.json().catch(() => null);
      const rawResults = Array.isArray(data?.results) ? data.results : [];

      const normalized: SearchResult[] = rawResults.map((r: any) => ({
        id: String(r.id ?? r._id ?? ""),
        type: (r.type === "person" || r.type === "page") ? r.type : "unknown",
        name: r.name ?? r.title ?? "",
        subtitle: r.subtitle ?? r.meta?.subtitle ?? "",
        avatarUrl: r.avatarUrl ?? r.image ?? null,
        ...r,
      }));

      setResults(normalized);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("UnifiedSearch fetch error", err);
      setError(String(err?.message ?? "Search failed"));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    if (!query || query.trim().length === 0) {
      setResults([]);
      setOpen(false);
      setHighlightIndex(-1);
      setLoading(false);
      setError(null);
      return;
    }

    debounceRef.current = window.setTimeout(() => {
      fetchResults(query);
      setOpen(true);
      setHighlightIndex(-1);
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open && e.key === "ArrowDown") {
        setOpen(true);
        return;
      }
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(-1, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < results.length) {
          selectResult(results[highlightIndex]);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
        setHighlightIndex(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, highlightIndex]);

  function selectResult(r: SearchResult) {
    setQuery(r.name);
    setOpen(false);
    const idx = results.findIndex((x) => x.id === r.id);
    setHighlightIndex(idx);
  }

  async function handleAction() {
    const target = pickActionTarget();
    if (!target || !target.id) return;
    setActionPending(true);
    try {
      if (target.type === "page") {
        if (!onFollowPage) throw new Error("onFollowPage not provided");
        await onFollowPage(target.id);
        onActionComplete?.("page", target.id, "following");
      } else if (target.type === "person") {
        if (!onSendFriend) throw new Error("onSendFriend not provided");
        await onSendFriend(target.id);
        onActionComplete?.("person", target.id, "requested");
      }
    } catch (err: any) {
      console.error("Action failed", err);
      setError(String(err?.message ?? "Action failed"));
      setTimeout(() => setError(null), 3000);
    } finally {
      setActionPending(false);
    }
  }

  const actionTarget = pickActionTarget();
  const actionState = actionButtonStateFor(actionTarget);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="sr-only">Search</label>

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
            }}
            placeholder={placeholder}
            className="block w-full rounded-md border border-white/10 bg-black/70 px-3 py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/10"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="unified-search-listbox"
            aria-activedescendant={highlightIndex >= 0 ? `us-item-${highlightIndex}` : undefined}
          />
        </div>

        <div className="flex items-center space-x-2">
          {actionState.label && (
            <button
              type="button"
              onClick={handleAction}
              disabled={actionState.disabled || actionPending}
              className={`rounded-md border border-white/10 px-3 py-1 text-sm font-medium ${actionState.disabled ? "bg-white/3 text-gray-300" : "bg-white/5 text-white"}`}
            >
              {actionPending ? "..." : actionState.label}
            </button>
          )}
        </div>
      </div>

      {open && (results.length > 0 || loading || error) && (
        <div id="unified-search-listbox" role="listbox" className="mt-2 max-h-72 w-full overflow-auto rounded-md border border-white/6 bg-black/95 py-1 text-sm shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>}
          {error && !loading && <div className="px-3 py-2 text-xs text-red-400">Error: {error}</div>}
          {!loading && results.length === 0 && !error && <div className="px-3 py-2 text-xs text-gray-500">No results</div>}

          {results.map((r, idx) => {
            const isHighlighted = idx === highlightIndex;
            return (
              <div
                id={`us-item-${idx}`}
                key={`${r.type}-${r.id}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseEnter={() => setHighlightIndex(idx)}
                onMouseLeave={() => setHighlightIndex(-1)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectResult(r)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-white/2 ${isHighlighted ? "bg-white/3" : ""}`}
              >
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-white/6 flex items-center justify-center text-xs font-medium text-white">
                    {r.avatarUrl ? <img src={r.avatarUrl} alt={r.name} className="h-8 w-8 rounded-full object-cover" /> : (r.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    <div className="ml-3 shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-gray-300/80">
                      {r.type === "person" ? "Person" : r.type === "page" ? "Page" : "Other"}
                    </div>
                  </div>
                  {r.subtitle && <div className="mt-0.5 truncate text-xs text-gray-400">{r.subtitle}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
