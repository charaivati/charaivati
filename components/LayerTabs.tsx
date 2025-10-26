// components/LayerTabs.tsx
"use client";

import React from "react";
import type { TabItem } from "./LayerContext";

/**
 * Renders an array of tabs (id,label) and calls onSelect(tabId) when clicked.
 * Keeps a small local active state for visuals; the parent should update context.
 */

export default function LayerTabs({
  layerId,
  tabs,
  onSelect,
  compact = false,
}: {
  layerId: string;
  tabs: TabItem[];
  onSelect?: (tabId: string) => void;
  compact?: boolean;
}) {
  const [activeId, setActiveId] = React.useState<string | null>(() => tabs?.[0]?.id ?? null);

  React.useEffect(() => {
    if (tabs && tabs.length) setActiveId((prev) => prev ?? tabs[0].id);
  }, [tabs]);

  function handleClick(tabId: string) {
    setActiveId(tabId);
    onSelect?.(tabId);
  }

  return (
    <div className={`flex items-center gap-3 ${compact ? "text-sm" : "text-base"} flex-wrap`}>
      {(tabs ?? []).map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            onClick={() => handleClick(t.id)}
            title={t.description ?? t.label}
            className={`px-3 py-2 rounded-full transition flex items-center gap-2 ${
              active ? "bg-red-700 text-white shadow" : "bg-white/6 hover:bg-white/12"
            }`}
          >
            {t.label}
          </button>
        );
      })}

      <button
        onClick={() => {
          // add-layer behaviour: replace with your actual route
          window.location.href = "/add-layer";
        }}
        className="px-3 py-2 rounded-full bg-white/6 hover:bg-white/12 text-sm"
        aria-label="Add"
      >
        +
      </button>
    </div>
  );
}
