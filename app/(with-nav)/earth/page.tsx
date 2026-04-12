// app/(with-nav)/earth/page.tsx
"use client";

import React, { Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useLayerContext } from "@/components/LayerContext";

const WorldViewTab = dynamic(() => import("./tabs/WorldViewTab"), { ssr: false });
const HumanStoriesTab = dynamic(() => import("./tabs/HumanStoriesTab"), { ssr: false });
const CollaborateTab = dynamic(() => import("./tabs/CollaborateTab"), { ssr: false });
const KnowledgeTab = dynamic(() => import("./tabs/KnowledgeTab"), { ssr: false });

type EarthTab = "worldview" | "human" | "collab" | "knowledge";

function normalizeTab(raw: string): EarthTab {
  const s = raw.toLowerCase();
  if (s.includes("human")) return "human";
  if (s.includes("collab")) return "collab";
  if (s.includes("knowledge")) return "knowledge";
  return "worldview";
}

function EarthPageContent() {
  const ctx = useLayerContext();
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab") ?? "";

  const active = useMemo<EarthTab>(() => {
    if (tabParamRaw) return normalizeTab(tabParamRaw);
    const savedTabId = ctx.activeTabs["layer-earth"] ?? "";
    return normalizeTab(savedTabId);
  }, [tabParamRaw, ctx.activeTabs]);

  return (
    <div className="max-w-3xl mx-auto">
      {active === "worldview" && <WorldViewTab />}
      {active === "human"     && <HumanStoriesTab />}
      {active === "collab"    && <CollaborateTab />}
      {active === "knowledge" && <KnowledgeTab />}
    </div>
  );
}

export default function EarthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-400">Loading Earth view...</p>
          </div>
        </div>
      }
    >
      <EarthPageContent />
    </Suspense>
  );
}
