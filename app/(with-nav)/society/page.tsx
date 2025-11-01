// app/(with-nav)/society/page.tsx
"use client";
import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLayerContext } from "@/components/LayerContext";
import FeatureGate from "@/components/FeatureGate";
import UserSearch from "@/components/UserSearch"; // if used earlier

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

export default function SocietyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = (searchParams?.get("tab") || "").toLowerCase().trim();
  const ctx = useLayerContext();
  const LS_KEY = "charaivati.selectedLocal";

  const [detected, setDetected] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalSelection | null>(null);

  // feature flags map: { "layer.society.panchayat": { enabled: true }, ... }
  const [flags, setFlags] = useState<Record<string, { enabled: boolean; meta?: any }> | null>(null);
  const [flagsLoading, setFlagsLoading] = useState(true);

  useEffect(() => {
    // load flags
    let alive = true;
    (async () => {
      try {
        setFlagsLoading(true);
        const res = await fetch("/api/feature-flags", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (json?.ok) setFlags(json.flags || {});
        else setFlags({});
      } catch (err) {
        console.warn("Failed to load feature flags", err);
        setFlags({});
      } finally {
        if (alive) setFlagsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
  const activeTabId =
    ctx?.activeTabs?.[layerId] ?? ctx?.layers?.find((l) => l.id === layerId)?.tabs?.[0]?.id;
  const showPanchayat = String(activeTabId || "").toLowerCase().includes("panchayat");
  const showLegislative = String(activeTabId || "").toLowerCase().includes("legislative");
  const showParliamentary = String(activeTabId || "").toLowerCase().includes("parliament");
  const showState = String(activeTabId || "").toLowerCase().includes("state");

  function handleLeft() {
    router.push("/nation");
  }
  function handleRight() {
    router.push("/local");
  }

  // flag key names (change as you wish — keep consistent in DB)
  const keys = {
    panchayat: "layer.society.panchayat",
    legislative: "layer.society.legislative",
    parliamentary: "layer.society.parliamentary",
    state: "layer.society.state",
    // a top-level toggle for entire society layer:
    layer: "layer.society",
  };

  // Helper: returns true if tab is allowed (layer gate AND per-tab gate)
  function isAllowed(perKey: string | null) {
    // if flags not loaded yet, be conservative: show nothing? We'll show placeholder while loading.
    if (!flags) return false;
    // if top-level layer disabled, hide everything
    const layerFlag = flags[keys.layer];
    if (layerFlag && !layerFlag.enabled) return false;
    if (!perKey) return true;
    const pk = flags[perKey];
    if (pk === undefined) {
      // if there's no explicit flag, default to enabled (safer for existing features)
      return true;
    }
    return !!pk.enabled;
  }

  // Fallback UI while flags are loading
  if (flagsLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading society features...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative pb-16">
      <button
        onClick={handleLeft}
        aria-label="Back to nation"
        className="fixed top-4 left-4 z-50 p-2 rounded-full bg-white/6"
      >
        <ArrowLeft size={18} />
        <span className="text-xs px-2 py-1 rounded-full bg-white/10">{detected ?? "Local"}</span>
      </button>

      <button
        onClick={handleRight}
        aria-label="Go to local"
        className="fixed top-4 right-4 z-50 p-2 rounded-full bg-white/6"
      >
        <span className="text-xs px-2 py-1 rounded-full bg-white/10">{detected ?? "Local"}</span>
        <ArrowRight size={18} />
      </button>

      <div className="max-w-4xl mx-auto pt-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Panchayat */}
          {showPanchayat && (
            <FeatureGate
              flagKey={keys.panchayat}
              flags={flags}
              showPlaceholder={true}
            >
              <PanchayatTab value={local?.panchayat ?? ""} onChange={(v) => updateLocal({ panchayat: v })} />
            </FeatureGate>
          )}

          {/* Legislative */}
          {showLegislative && (
            <FeatureGate
              flagKey={keys.legislative}
              flags={flags}
              showPlaceholder={true}
            >
              <LegislativeTab value={local?.legislative ?? ""} onChange={(v) => updateLocal({ legislative: v })} />
            </FeatureGate>
          )}

          {/* Parliamentary */}
          {showParliamentary && (
            <FeatureGate
              flagKey={keys.parliamentary}
              flags={flags}
              showPlaceholder={true}
            >
              <ParliamentaryTab value={local?.parliamentary ?? ""} onChange={(v) => updateLocal({ parliamentary: v })} />
            </FeatureGate>
          )}

          {/* State */}
          {showState && (
            <FeatureGate
              flagKey={keys.state}
              flags={flags}
              showPlaceholder={true}
            >
              <StateTab value={local?.state ?? ""} onChange={(v) => updateLocal({ state: v })} />
            </FeatureGate>
          )}
        </div>

        <div className="max-w-3xl mx-auto mt-6 p-4 bg-black/40 rounded">
          <div className="text-sm text-gray-300 mb-2">Preview / Save</div>
          <pre className="text-xs bg-white/6 p-3 rounded text-gray-200">{JSON.stringify(local, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
