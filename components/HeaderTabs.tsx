// components/HeaderTabs.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useLayerContext } from "@/components/LayerContext";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  onNavigate?: (layerId: string) => void;
};

export default function HeaderTabs({ onNavigate }: Props) {
  const ctx = useLayerContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-10">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  const activeLayerId = ctx.activeLayerId || "layer-self";
  const currentLayer = ctx.getLayerById(activeLayerId);

  if (!currentLayer || !currentLayer.tabs || currentLayer.tabs.length === 0) {
    return null;
  }

  // Determine active tab from context or URL param
  const tabParam = searchParams?.get("tab");
  let activeTabId = ctx.activeTabs[activeLayerId] || currentLayer.tabs[0]?.id;

  // If URL has tab param, try to match it
  if (tabParam && mounted) {
    const matchedTab = currentLayer.tabs.find((t) => {
      const tabLabel = String(t.label || "").toLowerCase().trim();
      const paramLabel = String(tabParam || "").toLowerCase().trim();
      return tabLabel === paramLabel || t.id.toLowerCase().includes(paramLabel);
    });
    if (matchedTab) {
      activeTabId = matchedTab.id;
    }
  }

  function handleTabClick(tabId: string) {
    const tab = ctx.getTabById(activeLayerId, tabId);
    if (!tab) return;

    // Update context
    ctx.setActiveTab(activeLayerId, tabId);

    // Build URL with tab parameter
    // Use tab.label as the query param (normalize to lowercase)
    const tabLabel = String(tab.label || "").toLowerCase();
    const baseRoute = tab.route || `/self`;
    
    // Ensure we're setting the ?tab parameter
    const separator = baseRoute.includes("?") ? "&" : "?";
    const urlWithTab = `${baseRoute}${separator}tab=${tabLabel}`;
    
    router.push(urlWithTab);
  }

  // Horizontal tabs for both mobile and desktop (always centered)
  return (
    <div className="flex items-center gap-1">
      {currentLayer.tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
              isActive
                ? "bg-white text-black shadow-lg"
                : "text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}