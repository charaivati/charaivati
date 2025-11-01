// components/LayerContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Layer & tab context
 *
 * - Each Layer has id, label, hint and tabs[]
 * - Each Tab has id, label, description and route (important!)
 *
 * This file is intentionally minimal and client-only.
 */

export type TabItem = {
  id: string;
  label: string;
  description?: string;
  route: string; // canonical route to navigate to when tab is clicked
};

export type LayerItem = {
  id: string;
  label: string;
  hint?: string;
  tabs: TabItem[];
};

type LayerCtxShape = {
  layers: LayerItem[];
  activeLayerId: string | null;
  activeTabs: Record<string, string>; // map layerId -> activeTabId
  setActiveLayerId: (id: string) => void;
  setActiveTab: (layerId: string, tabId: string) => void;
  // helper to find layer/tab
  getLayerById: (id: string) => LayerItem | undefined;
  getTabById: (layerId: string, tabId: string) => TabItem | undefined;
};

const defaultLayers: LayerItem[] = [
  {
    id: "layer-self",
    label: "Self",
    hint: "Personal",
    tabs: [
      { id: "self-personal", label: "Personal", description: "Personal", route: "/self" },
      { id: "self-social", label: "Social", description: "Friends & social", route: "/self?tab=social" },
      { id: "self-learn", label: "Learn", description: "Learning", route: "/self?tab=learn" },
      { id: "self-earn", label: "Earn", description: "Earning", route: "/self?tab=earn" },
    ],
  },
  {
    id: "layer-society-home",
    label: "Society",
    hint: "Local & State",
    tabs: [
      { id: "soc-panchayat", label: "Panchayat/Ward", route: "/society?tab=panchayat" },
      { id: "soc-legislative", label: "Legislative constituency", route: "/society?tab=legislative" },
      { id: "soc-parliamentary", label: "Parliamentary constituency", route: "/society?tab=parliamentary" },
      { id: "soc-state", label: "State", route: "/society?tab=state" },
    ],
  },
  {
    id: "layer-nation-birth",
    label: "Nation",
    hint: "Country-wide",
    tabs: [
      { id: "nat-legislature", label: "Legislature", route: "/nation?tab=legislature" },
      { id: "nat-executive", label: "Executive", route: "/nation?tab=executive" },
      { id: "nat-judiciary", label: "Judiciary", route: "/nation?tab=judiciary" },
      { id: "nat-media", label: "Media", route: "/nation?tab=media" },
    ],
  },
  {
    id: "layer-earth",
    label: "Earth",
    hint: "Global",
    tabs: [
      { id: "earth-worldview", label: "World View", route: "/earth?tab=worldview" },
      { id: "earth-humanstories", label: "Human stories", route: "/earth?tab=humanstories" },
      { id: "earth-collab", label: "Collaborate / Act Now", route: "/earth?tab=collaborate" },
      { id: "earth-knowledge", label: "Knowledge / Tools", route: "/earth?tab=knowledge" },
    ],
  },
  {
    id: "layer-universe",
    label: "Universe",
    hint: "Beyond",
    tabs: [
      { id: "uni-spirit", label: "Spirituality", route: "/universe?tab=spirituality" },
      { id: "uni-science", label: "Science", route: "/universe?tab=science" },
      { id: "uni-ideas", label: "Ideas", route: "/universe?tab=ideas" },
      { id: "uni-other", label: "Other", route: "/universe?tab=other" },
    ],
  },
];

const LayerContext = createContext<LayerCtxShape | undefined>(undefined);

export function useLayerContext() {
  const ctx = useContext(LayerContext);
  if (!ctx) throw new Error("useLayerContext must be used inside LayerProvider");
  return ctx;
}

export function LayerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  // initialise layers from defaults (could be loaded from API later)
  const [layers] = useState<LayerItem[]>(() => defaultLayers);

  // active layer logic: infer from path, fallback to first layer
  const inferred = useMemo(() => {
    const p = (pathname || "").toLowerCase();
    if (p.startsWith("/self") || p === "/") return "layer-self";
    if (p.startsWith("/society") || p.startsWith("/local")) return "layer-society-home";
    if (p.startsWith("/nation") || p.startsWith("/nation")) return "layer-nation-birth";
    if (p.startsWith("/earth")) return "layer-earth";
    if (p.startsWith("/universe")) return "layer-universe";
    return "layer-self";
  }, [pathname]);

  const [activeLayerId, setActiveLayerId] = useState<string | null>(inferred);

  // activeTabs per-layer persisted in localStorage (simple per-user persistence)
  const LS_KEY = "charaivati.activeTabs_v1";
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // ignore
    }
    // default: first tab of each layer
    const m: Record<string, string> = {};
    for (const l of defaultLayers) {
      m[l.id] = l.tabs?.[0]?.id ?? "";
    }
    return m;
  });

  // persist activeTabs when they change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(activeTabs));
    } catch (e) {
      // ignore
    }
  }, [activeTabs]);

  // if pathname changes cause inferred layer change - keep context in sync
  useEffect(() => {
    setActiveLayerId(inferred);
  }, [inferred]);

  function setActiveTab(layerId: string, tabId: string) {
    setActiveTabs((prev) => ({ ...prev, [layerId]: tabId }));
  }

  function getLayerById(id: string) {
    return layers.find((l) => l.id === id);
  }

  function getTabById(layerId: string, tabId: string) {
    const layer = getLayerById(layerId);
    return layer?.tabs.find((t) => t.id === tabId);
  }

  const ctxValue: LayerCtxShape = {
    layers,
    activeLayerId,
    activeTabs,
    setActiveLayerId,
    setActiveTab,
    getLayerById,
    getTabById,
  };

  return <LayerContext.Provider value={ctxValue}>{children}</LayerContext.Provider>;
}
