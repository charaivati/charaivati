// app/(with-nav)/society/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLayerContext } from "@/components/LayerContext";

const LocalTab = dynamic(() => import("./tabs/LocalTab"), { ssr: false });
const LegislativeTab = dynamic(() => import("./tabs/LegislativeTab"), { ssr: false });
const ParliamentaryTab = dynamic(() => import("./tabs/ParliamentaryTab"), { ssr: false });
const StateTab = dynamic(() => import("./tabs/StateTab"), { ssr: false });

export default function SocietyPage() {
  const ctx = useLayerContext();
  const LS_KEY = "charaivati.selectedLocal";

  const [detected, setDetected] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalSelection | null>(null);

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

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Society</h1>
        <p className="text-sm text-gray-400">Governance topics and local civic responses</p>
      </div>

      <div className="space-y-6">
        {/* Panchayat */}
        {showPanchayat && (
          <PanchayatTab
            value={local?.panchayat ?? ""}
            onChange={(v) => updateLocal({ panchayat: v })}
          />
        )}

        {/* Legislative */}
        {showLegislative && (
          <LegislativeTab
            value={local?.legislative ?? ""}
            onChange={(v) => updateLocal({ legislative: v })}
          />
        )}

        {/* Parliamentary */}
        {showParliamentary && (
          <ParliamentaryTab
            value={local?.parliamentary ?? ""}
            onChange={(v) => updateLocal({ parliamentary: v })}
          />
        )}

        {/* State */}
        {showState && (
          <StateTab value={local?.state ?? ""} onChange={(v) => updateLocal({ state: v })} />
        )}
      </div>
    </>
  );
}
