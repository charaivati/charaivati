"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  friends: string[];
  outgoing: string[];
  incoming: string[];
  following: string[];
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

/** Clean incoming text for UI display */
function sanitizeText(raw: any, maxLen = 80): string {
  if (raw == null) return "";
  let s = String(raw);
  s = s.replace(/[\x00-\x1F\x7F]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > maxLen) return s.slice(0, maxLen - 1).trim() + "…";
  return s;
}

/** Normalize raw server results into SearchResult[] */
function normalizeRawResults(rawResults: any[]): SearchResult[] {
  if (!Array.isArray(rawResults)) return [];
  return rawResults.map((r: any) => {
    const rawId = r?.id ?? r?._id ?? r?.uuid ?? r?.uid ?? r?.pageId ?? "";
    const id = String(rawId);
    const typeRaw = String(r?.type ?? r?.kind ?? r?.resultType ?? "").toLowerCase();
    const type: ResultType =
      typeRaw === "person" || typeRaw === "user" ? "person" : typeRaw === "page" ? "page" : "unknown";
    const name = sanitizeText(r?.name ?? r?.title ?? r?.displayName ?? r?.fullName ?? "");
    const subtitle = sanitizeText(r?.subtitle ?? r?.meta?.subtitle ?? r?.description ?? r?.role ?? "", 120);
    const avatarUrl = r?.avatarUrl ?? r?.image ?? r?.avatar ?? null;
    return { id, type, name, subtitle, avatarUrl, ...r };
  });
}

function looksLikeDevMockId(id: string) {
  if (!id) return true;
  if (/^u\d+$/.test(id) || /^p\d+$/.test(id)) return true;
  if (id.length <= 3) return true;
  return false;
}

export default function UnifiedSearch({
  placeholder = "Search people or pages…",
  onFollowPage,
  onSendFriend,
  onActionComplete,
  friendState = { friends: [], outgoing: [], incoming: [], following: [] },
  initialQuery = "",
  className = "mx-auto max-w-xl",
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [actionPendingIds, setActionPendingIds] = useState<Record<string, boolean>>({});

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  const [portalStyle, setPortalStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  function labelForItem(r: SearchResult) {
    if (!r?.id) return { label: null, disabled: true };
    if (r.type === "page") {
      if ((friendState?.following ?? []).includes(r.id)) return { label: "Following", disabled: true };
      return { label: "Follow", disabled: false };
    } else if (r.type === "person") {
      if ((friendState?.friends ?? []).includes(r.id)) return { label: "Friends", disabled: true };
      if ((friendState?.outgoing ?? []).includes(r.id)) return { label: "Requested", disabled: true };
      if ((friendState?.incoming ?? []).includes(r.id)) return { label: "Respond", disabled: false };
      return { label: "Add friend", disabled: false };
    }
    return { label: null, disabled: true };
  }

  async function fetchResultsRaw(q: string): Promise<SearchResult[]> {
    if (!q || q.trim().length === 0) return [];
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const raw = Array.isArray(data) ? data : data?.results ?? [];
        if (Array.isArray(raw) && raw.length > 0) return normalizeRawResults(raw);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return [];
    }

    try {
      const [usersRes, pagesRes] = await Promise.allSettled([
        fetch(`/api/users?q=${encodeURIComponent(q)}`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        }),
        fetch(`/api/user/pages?q=${encodeURIComponent(q)}`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        }),
      ]);

      const usersArr: any[] =
        usersRes.status === "fulfilled" && usersRes.value.ok
          ? await usersRes.value.json().catch(() => [])
          : usersRes.status === "fulfilled"
          ? await usersRes.value.json().catch(() => [])
          : [];

      const pagesJson =
        pagesRes.status === "fulfilled" ? await pagesRes.value.json().catch(() => ({ pages: [] })) : { pages: [] };

      const users = (Array.isArray(usersArr) ? usersArr : []).map((u: any) => ({ ...u, type: "person" }));
      const pages = Array.isArray(pagesJson) ? pagesJson : pagesJson?.pages ?? [];
      const pagesMapped = (Array.isArray(pages) ? pages : []).map((p: any) => ({ ...p, type: "page" }));

      const mergedRaw = [...users, ...pagesMapped];
      return normalizeRawResults(mergedRaw);
    } catch (err: any) {
      if (err?.name === "AbortError") return [];
      throw err;
    }
  }

  async function fetchResults(q: string) {
    if (!q || q.trim().length === 0) {
      setResults([]);
      setError(null);
      setLoading(false);
      setOpen(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const normalized = await fetchResultsRaw(q);
      setResults(normalized);
      setOpen(true);
      setHighlightIndex(normalized.length > 0 ? 0 : -1);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(String(err?.message ?? "Search failed"));
      setResults([]);
      setOpen(true);
      setHighlightIndex(-1);
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
        if (highlightIndex >= 0 && highlightIndex < results.length) selectResult(results[highlightIndex]);
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

  async function handleItemAction(r: SearchResult) {
    if (!r || !r.id) return;
    if (looksLikeDevMockId(r.id)) {
      console.warn("[UnifiedSearch] blocked action on dev/mock id:", r.id);
      alert("This item looks like a developer mock and cannot be acted on.");
      return;
    }

    const id = r.id;
    setActionPendingIds((s) => ({ ...s, [id]: true }));
    try {
      if (r.type === "page") {
        if (!onFollowPage) throw new Error("onFollowPage not provided");
        await onFollowPage(id);
        onActionComplete?.("page", id, "following");
      } else if (r.type === "person") {
        if (!onSendFriend) throw new Error("onSendFriend not provided");
        await onSendFriend(id);
        onActionComplete?.("person", id, "requested");
      }
    } catch (err: any) {
      console.error("UnifiedSearch item action failed", err);
      alert("Action failed: " + String(err?.message ?? "server error"));
    } finally {
      setActionPendingIds((s) => {
        const nxt = { ...s };
        delete nxt[id];
        return nxt;
      });
    }
  }

  // recalc dropdown position
  useEffect(() => {
    function compute() {
      const el = inputRef.current;
      if (!el) {
        setPortalStyle(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const top = Math.max(rect.bottom + 6 + window.scrollY, 0);
      const left = rect.left + window.scrollX;
      const width = Math.max(rect.width, 200);
      setPortalStyle({ top, left, width });
    }
    if (open && (results.length > 0 || loading || error)) {
      compute();
      window.addEventListener("resize", compute);
      window.addEventListener("scroll", compute, true);
      return () => {
        window.removeEventListener("resize", compute);
        window.removeEventListener("scroll", compute, true);
      };
    }
    setPortalStyle(null);
  }, [open, results, loading, error]);

  const inputEl = (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="sr-only">Search</label>
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
      </div>
    </div>
  );

  const dropdownEl =
    portalStyle && (open && (loading || error || results.length > 0)) ? (
      <div
        id="unified-search-listbox"
        role="listbox"
        style={{
          position: "absolute",
          top: portalStyle.top,
          left: portalStyle.left,
          width: portalStyle.width,
          zIndex: 9999,
        }}
      >
        <div className="mt-0 max-h-72 w-full overflow-auto rounded-md border border-white/6 bg-black/95 py-1 text-sm shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-gray-400">Searching…</div>}
          {error && !loading && <div className="px-3 py-2 text-xs text-red-400">Error: {error}</div>}
          {!loading && !error && results.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No results</div>}

          {results.map((r, idx) => {
            const isHighlighted = idx === highlightIndex;
            const actionState = labelForItem(r);
            const pending = Boolean(actionPendingIds[r.id]);
            return (
              <div
                id={`us-item-${idx}`}
                key={`${r.type}-${r.id}-${idx}`}
                role="option"
                aria-selected={isHighlighted}
                onMouseEnter={() => setHighlightIndex(idx)}
                onMouseLeave={() => setHighlightIndex(-1)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectResult(r)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-white/2 ${isHighlighted ? "bg-white/3" : ""}`}
              >
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-white/6 flex items-center justify-center text-xs font-medium text-white overflow-hidden">
                    {r.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={String(r.avatarUrl)} alt={r.name} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      (r.name || "?").slice(0, 1).toUpperCase()
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{sanitizeText(r.name)}</div>
                  {r.subtitle && (
                    <div className="mt-0.5 truncate text-xs text-gray-400">{sanitizeText(r.subtitle, 120)}</div>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {actionState.label ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemAction(r);
                      }}
                      disabled={actionState.disabled || pending}
                      className={`rounded-md border border-white/10 px-3 py-1 text-sm font-medium ${
                        actionState.disabled || pending ? "bg-white/3 text-gray-300" : "bg-white/5 text-white"
                      }`}
                    >
                      {pending ? "..." : actionState.label}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  return (
    <>
      {inputEl}
      {dropdownEl ? createPortal(dropdownEl, document.body) : null}
    </>
  );
}
