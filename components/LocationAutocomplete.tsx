"use client";

import React, { useEffect, useRef, useState } from "react";

// Shared type between frontend and backend
export interface LocationItem {
  id: number;
  name: string;
  level: number;
  parentId?: number | null;
}

// Props for this autocomplete
interface LocationAutocompleteProps {
  level: number;
  parentId?: number | null;
  value: LocationItem | null;
  onChange: (val: LocationItem | null) => void;
  placeholder?: string;
  allowCreate?: boolean;
  id?: string;
}

export default function LocationAutocomplete({
  level,
  parentId,
  value,
  onChange,
  placeholder = "Search…",
  allowCreate = false,
  id,
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const controller = useRef<AbortController | null>(null);

  // Fetch results when query or parent changes
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    async function search() {
      try {
        controller.current?.abort();
        const ctrl = new AbortController();
        controller.current = ctrl;
        setLoading(true);
        setOpen(true);

        const url = `/api/location/search?q=${encodeURIComponent(query)}&level=${level}${
          parentId ? `&parentId=${parentId}` : ""
        }`;

        const res = await fetch(url, { signal: ctrl.signal });
        const data = (await res.json()) as LocationItem[];

        setResults(data || []);
      } catch (err) {
        if ((err as any).name !== "AbortError") console.error(err);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [query, parentId, level]);

  function selectItem(item: LocationItem | null) {
    onChange(item);
    setOpen(false);
    setQuery(item?.name || "");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(results.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && results[highlight]) {
        selectItem(results[highlight]);
      } else if (allowCreate && query.trim()) {
        selectItem({
          id: Date.now(),
          name: query.trim(),
          level,
          parentId,
        });
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query || value?.name || ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(-1);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full p-2 rounded border border-slate-300 bg-white text-black placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {open && (
        <ul
          ref={listRef}
          id={id || `list-${level}`}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded border border-slate-300 bg-white p-1 text-sm text-black shadow-md"
        >
          {loading && <li className="p-2 text-slate-400 text-sm">Searching…</li>}

          {!loading && results.length === 0 && (
            <li className="p-2 text-slate-400 text-sm">
              No results found.
              {allowCreate && query.trim().length > 1 && (
                <button
                  onClick={() =>
                    selectItem({
                      id: Date.now(),
                      name: query.trim(),
                      level,
                      parentId,
                    })
                  }
                  className="ml-1 underline text-blue-600"
                >
                  Create “{query.trim()}”
                </button>
              )}
            </li>
          )}

          {!loading &&
            results.map((r, i) => (
              <li
                key={r.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectItem(r);
                }}
                className={`cursor-pointer rounded px-2 py-1 ${
                  i === highlight ? "bg-blue-100" : ""
                } hover:bg-blue-50`}
              >
                {r.name}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
