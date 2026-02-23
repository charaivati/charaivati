// app/(with-nav)/earth/page.tsx
"use client";
import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLayerContext } from "@/components/LayerContext";

const WorldViewTab = dynamic(() => import("./tabs/WorldViewTab"), { ssr: false });
const HumanStoriesTab = dynamic(() => import("./tabs/HumanStoriesTab"), { ssr: false });
const CollaborateTab = dynamic(() => import("./tabs/CollaborateTab"), { ssr: false });
const KnowledgeTab = dynamic(() => import("./tabs/KnowledgeTab"), { ssr: false });

type GlobalSelection = { region?: string; focus?: string };

function EarthPageContent() {
  const ctx = useLayerContext();
  const LS_KEY = "charaivati.selectedGlobal";

  const [selection, setSelection] = useState<GlobalSelection | null>(null);
  const [detected, setDetected] = useState<string | null>(null);


  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        setSelection(parsed);
        setDetected(parsed?.region ?? "World");
      } else {
        const prefill: GlobalSelection = { region: "World", focus: "Climate" };
        setSelection(prefill);
        setDetected(prefill.region ?? "World");
      }
    } catch (e) {
      console.warn("Could not read global selection", e);
      setSelection(null);
      setDetected("World");
    }
  }, []);

  function updateSelection(partial: Partial<GlobalSelection>) {
    const merged = { ...(selection || {}), ...partial };
    setSelection(merged);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn(e);
    }
  }

  const layerId = "layer-earth";
  const activeTabId =
    ctx?.activeTabs?.[layerId] ?? ctx?.layers?.find((l) => l.id === layerId)?.tabs?.[0]?.id;
  const showWorldView = String(activeTabId || "").toLowerCase().includes("worldview");
  const showHuman = String(activeTabId || "").toLowerCase().includes("human");
  const showCollaborate = String(activeTabId || "").toLowerCase().includes("collab");
  const showKnowledge = String(activeTabId || "").toLowerCase().includes("knowledge");
  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Earth</h1>
        <p className="text-sm text-gray-400">
          Global perspectives and collective action
          {detected && <span className="ml-2 text-gray-300">• {detected}</span>}
        </p>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* World View */}
        {showWorldView && (
          <WorldViewTab selection={selection} onChange={(v: any) => updateSelection(v)} />
        )}

        {/* Human Stories */}
        {showHuman && (
          <HumanStoriesTab selection={selection} onChange={(v: any) => updateSelection(v)} />
        )}

        {/* Collaborate */}
        {showCollaborate && (
          <CollaborateTab selection={selection} onChange={(v: any) => updateSelection(v)} />
        )}

        {/* Knowledge */}
        {showKnowledge && (
          <KnowledgeTab selection={selection} onChange={(v: any) => updateSelection(v)} />
        )}
      </div>

      {/* Debug Section */}
      {selection && (
        <div className="mt-8 p-4 bg-white/5 rounded-lg border border-white/10">
          <div className="text-sm font-medium text-gray-400 mb-2">Global Selection</div>
          <div className="space-y-1 text-xs text-gray-300">
            {selection.region && <div>Region: {selection.region}</div>}
            {selection.focus && <div>Focus: {selection.focus}</div>}
          </div>
        </div>
      )}
    </>
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