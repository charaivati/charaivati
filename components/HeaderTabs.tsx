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

  const [mounted, setMounted] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  
  // Touch tracking
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  const activeLayerId = ctx.activeLayerId || "layer-self";
  const currentLayer = ctx.getLayerById(activeLayerId);

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

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for swipe events from layout header
  useEffect(() => {
    const handleSwipe = (e: Event) => {
      const customEvent = e as CustomEvent;
      console.log("[HeaderTabs] Swipe received:", customEvent.detail.direction);
      
      if (customEvent.detail.direction === "left") {
        goToNextTab();
      } else {
        goToPrevTab();
      }
    };

    window.addEventListener("headerSwipe", handleSwipe);
    return () => window.removeEventListener("headerSwipe", handleSwipe);
  }, [currentLayer, activeTabId]);

  // Center selected tab
  useEffect(() => {
    const el = tabRefs.current[activeTabId];
    if (!el || !scrollerRef.current) return;

    const relativeLeft = el.offsetLeft;
    const centerTarget = relativeLeft - scrollerRef.current.clientWidth / 2 + el.offsetWidth / 2;
    const nudge = Math.min(56, Math.floor(el.offsetWidth / 2) + 12);
    let target = Math.max(0, Math.floor(centerTarget - nudge));
    const maxScroll = Math.max(0, scrollerRef.current.scrollWidth - scrollerRef.current.clientWidth);
    if (target > maxScroll) target = maxScroll;

    scrollerRef.current.scrollTo({ left: target, behavior: "smooth" });
  }, [activeTabId]);

  function handleTabClick(tabId: string) {
    const tab = ctx.getTabById(activeLayerId, tabId);
    if (!tab) return;

    ctx.setActiveTab(activeLayerId, tabId);
    const tabLabel = String(tab.label || "").toLowerCase();
    const baseRoute = tab.route || `/self`;
    const separator = baseRoute.includes("?") ? "&" : "?";
    const urlWithTab = `${baseRoute}${separator}tab=${encodeURIComponent(tabLabel)}`;
    router.push(urlWithTab);
  }

  function goToNextTab() {
    const tabs = currentLayer?.tabs ?? [];
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    if (idx >= 0 && idx < tabs.length - 1) {
      handleTabClick(tabs[idx + 1].id);
    }
  }

  function goToPrevTab() {
    const tabs = currentLayer?.tabs ?? [];
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    if (idx > 0) {
      handleTabClick(tabs[idx - 1].id);
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current || e.changedTouches.length !== 1) return;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - touchStart.current.x;
    const dy = endY - touchStart.current.y;
    const dt = Date.now() - touchStart.current.time;

    touchStart.current = null;

    // Thresholds
    const MIN_DISTANCE = 20;
    const MAX_TIME = 1000;
    const MAX_VERTICAL = 50;

    // Check if it's a valid horizontal swipe
    if (
      Math.abs(dx) > MIN_DISTANCE &&
      Math.abs(dx) > Math.abs(dy) &&
      Math.abs(dy) < MAX_VERTICAL &&
      dt < MAX_TIME
    ) {
      if (dx > 0) {
        goToPrevTab();
      } else {
        goToNextTab();
      }
    }
  };

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

  return (
    <div 
      className="w-full flex justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "manipulation" }}
    >
      <div
        className="overflow-x-auto no-scrollbar flex justify-center w-full"
        ref={scrollerRef}
        role="tablist"
        aria-label="Page tabs"
      >
        <div className="flex items-end justify-center gap-4 px-4 py-0 min-w-max h-12">
          {currentLayer.tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                onClick={() => handleTabClick(tab.id)}
                aria-selected={isActive}
                role="tab"
                className={`inline-flex items-center justify-center whitespace-nowrap px-5 text-sm font-medium transition-all h-9 self-end ${
                  isActive ? "bg-black text-white rounded-none -mb-px" : "text-white/80 hover:text-white"
                }`}
                type="button"
                style={{ lineHeight: "2rem" }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}