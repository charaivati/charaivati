// app/(with-nav)/nation/page.tsx
"use client";
import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLayerContext } from "@/components/LayerContext";

const LegislatureTab = dynamic(() => import("./tabs/legislature"), { ssr: false });
const ExecutiveTab = dynamic(() => import("./tabs/executive"), { ssr: false });
const JudiciaryTab = dynamic(() => import("./tabs/judiciary"), { ssr: false });
const MediaTab = dynamic(() => import("./tabs/media"), { ssr: false });

type CountrySelection = {
  country?: string;
  legislature?: string;
  executive?: string;
  judiciary?: string;
  media?: string;
};

function NationPageContent() {
  const ctx = useLayerContext();
  const LS_KEY = "charaivati.selectedCountry";

  const [country, setCountry] = useState<CountrySelection | null>(null);
  const [detected, setDetected] = useState<string | null>(null);


  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        setCountry(parsed);
        setDetected(parsed?.country ?? "India");
      } else {
        const prefill: CountrySelection = {
          country: "India",
          legislature: "Parliament (Lok Sabha & Rajya Sabha)",
          executive: "Council of Ministers / Prime Minister",
          judiciary: "Supreme Court of India",
          media: "Press & News Media",
        };
        setCountry(prefill);
        setDetected(prefill.country ?? "India");
      }
    } catch (e) {
      console.warn("Could not read country selection", e);
      setCountry(null);
      setDetected(null);
    }
  }, []);

  function updateCountry(partial: Partial<CountrySelection>) {
    const merged = { ...(country || {}), ...partial };
    setCountry(merged);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn("Could not persist country selection", e);
    }
  }

  const layerId = "layer-nation-birth";
  const activeTabId =
    ctx?.activeTabs?.[layerId] ?? ctx?.layers?.find((l) => l.id === layerId)?.tabs?.[0]?.id;
  const showLegislature = String(activeTabId || "").toLowerCase().includes("legislature");
  const showExecutive = String(activeTabId || "").toLowerCase().includes("executive");
  const showJudiciary = String(activeTabId || "").toLowerCase().includes("judiciary");
  const showMedia = String(activeTabId || "").toLowerCase().includes("media");
  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Nation</h1>
        <p className="text-sm text-gray-400">
          National governance and institutions
          {detected && <span className="ml-2 text-gray-300">• {detected}</span>}
        </p>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Legislature */}
        {showLegislature && (
          <LegislatureTab
            value={country?.legislature ?? ""}
            onChange={(v: string) => updateCountry({ legislature: v })}
          />
        )}

        {/* Executive */}
        {showExecutive && (
          <ExecutiveTab
            value={country?.executive ?? ""}
            onChange={(v: string) => updateCountry({ executive: v })}
          />
        )}

        {/* Judiciary */}
        {showJudiciary && (
          <JudiciaryTab
            value={country?.judiciary ?? ""}
            onChange={(v: string) => updateCountry({ judiciary: v })}
          />
        )}

        {/* Media */}
        {showMedia && (
          <MediaTab
            value={country?.media ?? ""}
            onChange={(v: string) => updateCountry({ media: v })}
          />
        )}
      </div>

      {/* Debug Section */}
      {country && (
        <div className="mt-8 p-4 bg-white/5 rounded-lg border border-white/10">
          <div className="text-sm font-medium text-gray-400 mb-2">Country Selection</div>
          <div className="space-y-1 text-xs text-gray-300">
            {country.country && <div>Country: {country.country}</div>}
            {country.legislature && <div>Legislature: {country.legislature}</div>}
            {country.executive && <div>Executive: {country.executive}</div>}
            {country.judiciary && <div>Judiciary: {country.judiciary}</div>}
            {country.media && <div>Media: {country.media}</div>}
          </div>
        </div>
      )}
    </>
  );
}

export default function NationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-400">Loading nation view...</p>
          </div>
        </div>
      }
    >
      <NationPageContent />
    </Suspense>
  );
}