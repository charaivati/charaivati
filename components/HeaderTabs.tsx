// components/HeaderTabs.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLayerContext } from "@/components/LayerContext";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  onNavigate?: (layerId: string) => void;
};

export default function HeaderTabs({ onNavigate }: Props) {
  const ctx = useLayerContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  // basic hooks (always declared)
  const [mounted, setMounted] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  // compute active layer and candidate active tab (no hooks here)
  const activeLayerId = ctx.activeLayerId || "layer-self";
  const currentLayer = ctx.getLayerById(activeLayerId);

  // determine activeTabId from context or URL param (safe even if currentLayer undefined)
  const tabParam = searchParams?.get("tab");
  let activeTabId = ctx.activeTabs[activeLayerId] || (currentLayer?.tabs?.[0]?.id ?? "");

  if (tabParam && mounted && currentLayer?.tabs) {
    const paramLower = String(tabParam || "").toLowerCase().trim();
    const matchedTab = currentLayer.tabs.find((t) => {
      const labelLower = String(t.label || "").toLowerCase().trim();
      return labelLower === paramLower;
    });
    if (matchedTab) activeTabId = matchedTab.id;
  }

  // ----- Always declare this effect (unconditionally) -----
  useEffect(() => {
    // center active tab if present
    const el = tabRefs.current[activeTabId];
    if (!el) return;
    if (el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      return;
    }
    // fallback centering if scrollIntoView not available
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = elRect.left - scrollerRect.left - (scrollerRect.width - elRect.width) / 2;
    scroller.scrollBy({ left: delta, behavior: "smooth" });
  }, [activeTabId]);

  // early returns that happen *after* all hooks were declared
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-10">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!currentLayer || !currentLayer.tabs || currentLayer.tabs.length === 0) {
    return null;
  }

  // click handler (uses refs & router)
  function handleTabClick(tabId: string) {
    const tab = ctx.getTabById(activeLayerId, tabId);
    if (!tab) return;

    ctx.setActiveTab(activeLayerId, tabId);

    const tabLabel = String(tab.label || "").toLowerCase();
    const baseRoute = tab.route || `/self`;
    const separator = baseRoute.includes("?") ? "&" : "?";
    const urlWithTab = `${baseRoute}${separator}tab=${encodeURIComponent(tabLabel)}`;
    router.push(urlWithTab);

    // scroll clicked tab into center immediately
    const el = tabRefs.current[tabId];
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    } else if (scrollerRef.current && el) {
      const scroller = scrollerRef.current;
      const scrollerRect = scroller.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const delta = elRect.left - scrollerRect.left - (scrollerRect.width - elRect.width) / 2;
      scroller.scrollBy({ left: delta, behavior: "smooth" });
    }
  }

  // render
  return (
    <div className="flex justify-center w-full">
      <div
        ref={scrollerRef}
        className="flex items-center gap-2 px-2 py-1 overflow-x-auto no-scrollbar"
        role="tablist"
        aria-label="Page tabs"
      >
        {currentLayer.tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              ref={(el: HTMLButtonElement | null) => {
                tabRefs.current[tab.id] = el; // callback ref returns void — type-safe
              }}
              onClick={() => handleTabClick(tab.id)}
              aria-selected={isActive}
              role="tab"
              className={`inline-flex items-center whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                isActive ? "bg-white text-black shadow-sm" : "text-gray-300 hover:text-white hover:bg-white/5"
              }`}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
