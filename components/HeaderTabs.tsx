// components/HeaderTabs.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useLayerContext } from "./LayerContext";

export default function HeaderTabs({ onNavigate }: { onNavigate?: (layerId: string) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const ctx = useLayerContext();

  // Wait until after mount to prevent SSR/client mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Derive active layer from pathname
  const activeLayerId = React.useMemo(() => {
    if (!pathname) return ctx.layers?.[0]?.id ?? "layer-self";
    if (pathname.startsWith("/user") || pathname.startsWith("/self")) return "layer-self";
    if (pathname.startsWith("/society") || pathname.startsWith("/local")) return "layer-society-home";
    if (pathname.startsWith("/nation") || pathname.startsWith("/your_country") || pathname.startsWith("/yourcountry")) return "layer-nation-birth";
    if (pathname.startsWith("/earth")) return "layer-earth";
    if (pathname.startsWith("/universe")) return "layer-universe";
    return ctx.activeLayerId ?? ctx.layers?.[0]?.id ?? "layer-self";
  }, [pathname, ctx.activeLayerId, ctx.layers]);

  // Sync context with derived layer
  useEffect(() => {
    if (activeLayerId && ctx.activeLayerId !== activeLayerId) {
      ctx.setActiveLayerId(activeLayerId);
    }
  }, [activeLayerId, ctx]);

  const activeLayer = ctx.layers.find((l) => l.id === activeLayerId) ?? ctx.layers[0];

  // Get tab from URL param
  const tabParam = searchParams?.get("tab")?.toLowerCase() || "";

  // Determine active tab: URL param > context > first tab
  const activeTabId = tabParam || ctx.activeTabs[activeLayer?.id] || activeLayer?.tabs?.[0]?.id || "";

  function routeForLayer(layerId: string, tab?: string) {
    const tabQuery = tab ? `?tab=${encodeURIComponent(tab)}` : "";
    switch (layerId) {
      case "layer-self":
        return `/self${tabQuery}`;
      case "layer-society-home":
      case "layer-society-work":
        return `/society${tabQuery}`;
      case "layer-nation-birth":
      case "layer-nation-work":
        return `/nation${tabQuery}`;
      case "layer-earth":
        return `/earth${tabQuery}`;
      case "layer-universe":
        return `/universe${tabQuery}`;
      default:
        return `/self${tabQuery}`;
    }
  }

  function handleTabClick(tabId: string) {
    if (!activeLayer) return;

    // Update context
    ctx.setActiveTab(activeLayer.id, tabId);

    // Navigate with tab param
    const route = routeForLayer(activeLayer.id, tabId);
    router.push(route);

    // Callback
    onNavigate?.(activeLayer.id);
  }

  if (!activeLayer || !activeLayer.tabs?.length) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Layer label + hint (kept aligned with content) */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium text-sm text-white">{activeLayer.label ?? "Layer"}</div>
          {activeLayer.hint && <div className="text-xs text-gray-400">{activeLayer.hint}</div>}
        </div>
      </div>

      {/* Tabs container - use same max width/padding as page content so centers line up */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2">
          <div className="flex items-center gap-2 flex-nowrap">
            {activeLayer.tabs.map((tab) => {
              const tabId = String(tab.id || "").toLowerCase();
              const activeLower = String(activeTabId || "").toLowerCase();

              const isActive = mounted && (
                tabId === activeLower ||
                activeLower.includes(tabId) ||
                tabId.includes(activeLower)
              );

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tabId)}
                  title={tab.description ?? tab.label}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                    transition-all duration-200
                    ${isActive
                      ? "bg-red-700 text-white shadow-lg scale-105"
                      : "bg-white/6 text-gray-300 hover:bg-white/12 hover:text-white"
                    }
                  `}
                >
                  {tab.label}
                </button>
              );
            })}

            {/* Add button */}
            <button
              onClick={() => router.push("/add-layer")}
              className="px-3 py-2 rounded-full bg-white/6 hover:bg-white/12 text-gray-400 hover:text-white text-sm transition-all"
              aria-label="Add new layer"
              title="Add custom layer"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
