// app/(with-nav)/earth/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLayerContext } from "@/components/LayerContext";

const WorldViewTab = dynamic(() => import("./tabs/WorldViewTab"), { ssr: false });
const HumanStoriesTab = dynamic(() => import("./tabs/HumanStoriesTab"), { ssr: false });
const CollaborateTab = dynamic(() => import("./tabs/CollaborateTab"), { ssr: false });
const KnowledgeTab = dynamic(() => import("./tabs/KnowledgeTab"), { ssr: false });

type GlobalSelection = { region?: string; focus?: string; };

export default function EarthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = (searchParams?.get("tab") || "").toLowerCase().trim();
  const ctx = useLayerContext();

  const [active, setActive] = useState<"worldview" | "human" | "collaborate" | "knowledge">("worldview");
  const [selection, setSelection] = useState<GlobalSelection | null>(null);
  const [detected, setDetected] = useState<string | null>(null);
  const LS_KEY = "charaivati.selectedGlobal";

  useEffect(() => {
    if (tabParam) {
      switch (tabParam) {
        case "human":
        case "human-stories":
          setActive("human");
          break;
        case "collaborate":
        case "act":
        case "act-now":
          setActive("collaborate");
          break;
        case "knowledge":
        case "tools":
          setActive("knowledge");
          break;
        default:
          setActive("worldview");
      }
      return;
    }

    // fallback to LayerContext
    const layerId = "layer-earth";
    const ctxTab = ctx?.activeTabs?.[layerId];
    if (ctxTab) {
      const t = String(ctxTab).toLowerCase();
      if (t.includes("human")) setActive("human");
      else if (t.includes("collaborate") || t.includes("act")) setActive("collaborate");
      else if (t.includes("knowledge") || t.includes("tools")) setActive("knowledge");
      else setActive("worldview");
    }
  }, [tabParam, ctx?.activeTabs]);

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

  function handleLeft() { router.push("/universe"); }
  function handleRight() { router.push("/nation"); }

  return (
    <div className="min-h-screen bg-black text-white relative pb-16">
      <button onClick={handleLeft} aria-label="Back to universe" className="fixed top-4 left-4 z-50 p-2 rounded-full bg-white/6">
        <ArrowLeft size={18} />
        <span className="text-xs px-2 py-1 rounded-full bg-white/10">{detected ?? "World"}</span>
      </button>

      <button onClick={handleRight} aria-label="Go to nation" className="fixed top-4 right-4 z-50 p-2 rounded-full bg-white/6">
        <span className="text-xs px-2 py-1 rounded-full bg-white/10">{detected ?? "World"}</span>
        <ArrowRight size={18} />
      </button>

      <div className="max-w-4xl mx-auto pt-8 px-4">
        <div className="max-w-3xl mx-auto">
          {active === "worldview" && <WorldViewTab selection={selection} onChange={(v: any) => updateSelection(v)} />}
          {active === "human" && <HumanStoriesTab selection={selection} onChange={(v: any) => updateSelection(v)} />}
          {active === "collaborate" && <CollaborateTab selection={selection} onChange={(v: any) => updateSelection(v)} />}
          {active === "knowledge" && <KnowledgeTab selection={selection} onChange={(v: any) => updateSelection(v)} />}
        </div>

        <div className="max-w-3xl mx-auto mt-6 p-4 bg-black/40 rounded">
          <div className="text-sm text-gray-300 mb-2">Global selection (stored locally)</div>
          <pre className="text-xs bg-white/6 p-3 rounded text-gray-200">{JSON.stringify(selection, null, 2)}</pre>
          <div className="flex justify-end mt-3 gap-2">
            <button onClick={() => { localStorage.removeItem(LS_KEY); setSelection(null); setDetected("World"); }} className="px-4 py-2 rounded bg-gray-700">Clear</button>
            <button onClick={() => { if (selection) localStorage.setItem(LS_KEY, JSON.stringify(selection)); alert("Saved"); }} className="px-4 py-2 rounded bg-green-600">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
