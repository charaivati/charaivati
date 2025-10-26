"use client";
import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLayerContext } from "@/components/LayerContext";

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

function SocietyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = (searchParams?.get("tab") || "").toLowerCase().trim();
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

  const layerId = "layer-society-home";
  const activeTabId = ctx?.activeTabs?.[layerId] ?? ctx?.layers?.find((l) => l.id === layerId)?.tabs?.[0]?.id;
  const showPanchayat = String(activeTabId || "").toLowerCase().includes("panchayat");
  const showLegislative = String(activeTabId || "").toLowerCase().includes("legislative");
  const showParliamentary = String(activeTabId || "").toLowerCase().includes("parliament");
  const showState = String(activeTabId || "").toLowerCase().includes("state");

  function handleLeft() { router.push("/nation"); }
  function handleRight() { router.push("/local"); }

  return (
    <div className="min-h-screen bg-black text-white relative pb-16">
      <button onClick={handleLeft} aria-label="Back to nation" className="fixed top-4 left-4 z-50 p-2 rounded-full bg-white/6">
        <ArrowLeft size={18} />
        <span className="text-xs px-2 py-1 rounded-full bg-white/10">{detected ?? "Local"}</span>
      </button>

      <button onClick={handleRight} aria-label="Go to local" className="fixed top-4 right-4 z-50 p-2 rounded-full bg-white/6">
        <span className="text-xs px-2 py-1 rounded-full bg-white/10">{detected ?? "Local"}</span>
        <ArrowRight size={18} />
      </button>

      <div className="max-w-4xl mx-auto pt-8 px-4">
        <div className="max-w-3xl mx-auto">
          {showPanchayat && <PanchayatTab value={local?.panchayat ?? ""} onChange={(v) => updateLocal({ panchayat: v })} />}
          {showLegislative && <LegislativeTab value={local?.legislative ?? ""} onChange={(v) => updateLocal({ legislative: v })} />}
          {showParliamentary && <ParliamentaryTab value={local?.parliamentary ?? ""} onChange={(v) => updateLocal({ parliamentary: v })} />}
          {showState && <StateTab value={local?.state ?? ""} onChange={(v) => updateLocal({ state: v })} />}
        </div>

        <div className="max-w-3xl mx-auto mt-6 p-4 bg-black/40 rounded">
          <div className="text-sm text-gray-300 mb-2">Preview / Save</div>
          <pre className="text-xs bg-white/6 p-3 rounded text-gray-200">{JSON.stringify(local, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

export default function SocietyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading society…</div>}>
      <SocietyPageContent />
    </Suspense>
  );
}
