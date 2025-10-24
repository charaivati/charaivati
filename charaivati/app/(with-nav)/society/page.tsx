"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayerContext } from "@/components/LayerContext";

// lazy-loaded tab components
const PanchayatTab = dynamic(() => import("./tabs/PanchayatTab"), { ssr: false });
const LegislativeTab = dynamic(() => import("./tabs/LegislativeTab"), { ssr: false });
const ParliamentaryTab = dynamic(() => import("./tabs/ParliamentaryTab"), { ssr: false });
const StateTab = dynamic(() => import("./tabs/StateTab"), { ssr: false });

type LocalSelection = {
  country?: string;
  state?: string;
  parliamentary?: string;
  legislative?: string;
  panchayat?: string;
};

export default function LocalPage() {
  const router = useRouter();
  const ctx = useLayerContext();

  const [detected, setDetected] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalSelection | null>(null);
  const LS_KEY = "charaivati.selectedLocal";

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        setLocal(parsed);
        const detectedValue = parsed?.state ?? parsed?.country ?? parsed?.parliamentary ?? "Local";
        setDetected(detectedValue || null);
      } else {
        const prefill: LocalSelection = {
          country: "India",
          state: "Assam",
          parliamentary: "Jorhat",
          legislative: "Nazira",
          panchayat: "Amguri Gaon Panchayat",
        };
        setLocal(prefill);
        setDetected(prefill.state || null);
      }
    } catch (e) {
      console.warn("Could not read local selection", e);
      setLocal(null);
      setDetected(null);
    }
  }, []);

  function updateLocal(partial: Partial<LocalSelection>) {
    const merged = { ...(local || {}), ...partial };
    setLocal(merged);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
      const detectedValue = merged.state ?? merged.country ?? merged.parliamentary ?? null;
      setDetected(detectedValue || null);
    } catch (e) {
      console.warn("Could not persist selection", e);
    }
  }

  // navigation arrows
  function handleLeft() {
    router.push("/your_country"); // your country
  }
  function handleRight() {
    router.push("/user"); // or /self if you use /self
  }

  // --- FROM LayerContext: determine active tab for this layer
  // activeTabs is a map: { [layerId]: tabId }
  const layerId = "layer-society-home"; // canonical id for this page
  const activeTabId = ctx?.activeTabs?.[layerId] ?? ctx?.layers?.find((l) => l.id === layerId)?.tabs?.[0]?.id;

  // Basic mapping: decide which component to show based on tab id prefix or known ids
  // (Adjust the prefix checks to match the actual tab IDs you have in DB)
  const showPanchayat = String(activeTabId || "").toLowerCase().includes("panchayat") || String(activeTabId || "").startsWith("society-r1");
  const showLegislative = String(activeTabId || "").toLowerCase().includes("legislative") || String(activeTabId || "").startsWith("society-r2");
  const showParliamentary = String(activeTabId || "").toLowerCase().includes("parliament") || String(activeTabId || "").startsWith("society-r3");
  const showState = String(activeTabId || "").toLowerCase().includes("state") || String(activeTabId || "").startsWith("society-r4");

  return (
    <div className="min-h-screen bg-black text-white relative pb-16">
      <button onClick={handleLeft} aria-label="Back to your country" className="fixed top-4 left-4 z-50 p-2 rounded-full bg-white/6 ...">
        <ArrowLeft size={18} />
        <span className="text-xs px-2 py-1 rounded-full bg-white/10">{detected ?? "Choose"}</span>
      </button>

      <button onClick={handleRight} aria-label="Go to user page" className="fixed top-4 right-4 z-50 p-2 rounded-full bg-white/6 ...">
        <span className="text-xs px-2 py-1 rounded-full bg-white/10">{detected ?? "Choose"}</span>
        <ArrowRight size={18} />
      </button>

      <div className="max-w-4xl mx-auto pt-8 px-4">
        <div className="max-w-3xl mx-auto">
          {showPanchayat && <PanchayatTab value={local?.panchayat ?? ""} onChange={(v) => updateLocal({ panchayat: v })} />}
          {showLegislative && <LegislativeTab value={local?.legislative ?? ""} onChange={(v) => updateLocal({ legislative: v })} />}
          {showParliamentary && <ParliamentaryTab value={local?.parliamentary ?? ""} onChange={(v) => updateLocal({ parliamentary: v })} />}
          {showState && <StateTab value={local?.state ?? ""} onChange={(v) => updateLocal({ state: v })} />}
        </div>

        {/* preview / save UI stays the same */}
        <div className="max-w-3xl mx-auto mt-6 p-4 bg-black/40 rounded"> ... </div>
      </div>
    </div>
  );
}
