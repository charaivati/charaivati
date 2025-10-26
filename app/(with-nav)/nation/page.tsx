"use client";
import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = (searchParams?.get("tab") || "").toLowerCase().trim();
  const ctx = useLayerContext();

  const [active, setActive] = useState<"legislature" | "executive" | "judiciary" | "media">("legislature");
  const [country, setCountry] = useState<CountrySelection | null>(null);
  const [detected, setDetected] = useState<string | null>(null);
  const LS_KEY = "charaivati.selectedCountry";

  useEffect(() => {
    if (tabParam) {
      switch (tabParam) {
        case "executive":
          setActive("executive");
          break;
        case "judiciary":
          setActive("judiciary");
          break;
        case "media":
          setActive("media");
          break;
        default:
          setActive("legislature");
      }
      return;
    }

    const layerId = "layer-nation-birth";
    const ctxTab = ctx?.activeTabs?.[layerId];
    if (ctxTab) {
      const t = String(ctxTab).toLowerCase();
      if (t.includes("executive")) setActive("executive");
      else if (t.includes("judiciary")) setActive("judiciary");
      else if (t.includes("media")) setActive("media");
      else setActive("legislature");
    }
  }, [tabParam, ctx?.activeTabs]);

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

  function handleLeft() { router.push("/earth"); }
  function handleRight() { router.push("/local"); }

  return (
    <div className="min-h-screen bg-black text-white relative pb-16">
      <button onClick={handleLeft} aria-label="Back to earth" className="fixed top-4 left-4 z-50 p-2 rounded-full bg-white/6">
        <ArrowLeft size={18} />
        <span className="text-xs px-2 py-1 rounded-full bg-white/10">{detected ?? "India"}</span>
      </button>

      <button onClick={handleRight} aria-label="Go to local" className="fixed top-4 right-4 z-50 p-2 rounded-full bg-white/6">
        <span className="text-xs px-2 py-1 rounded-full bg-white/10">{detected ?? "India"}</span>
        <ArrowRight size={18} />
      </button>

      <div className="max-w-4xl mx-auto pt-8 px-4">
        <div className="max-w-3xl mx-auto">
          {active === "legislature" && <LegislatureTab value={country?.legislature ?? ""} onChange={(v: string) => updateCountry({ legislature: v })} />}
          {active === "executive" && <ExecutiveTab value={country?.executive ?? ""} onChange={(v: string) => updateCountry({ executive: v })} />}
          {active === "judiciary" && <JudiciaryTab value={country?.judiciary ?? ""} onChange={(v: string) => updateCountry({ judiciary: v })} />}
          {active === "media" && <MediaTab value={country?.media ?? ""} onChange={(v: string) => updateCountry({ media: v })} />}
        </div>

        <div className="max-w-3xl mx-auto mt-6 p-4 bg-black/40 rounded">
          <div className="text-sm text-gray-300 mb-2">Current country selection (stored locally)</div>
          <pre className="text-xs bg-white/6 p-3 rounded text-gray-200">{JSON.stringify(country, null, 2)}</pre>
          <div className="flex justify-end mt-3 gap-2">
            <button onClick={() => { localStorage.removeItem(LS_KEY); setCountry(null); setDetected(null); }} className="px-4 py-2 rounded bg-gray-700">Clear</button>
            <button onClick={() => { if (country) localStorage.setItem(LS_KEY, JSON.stringify(country)); alert("Saved"); }} className="px-4 py-2 rounded bg-green-600">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading nation view...</p>
        </div>
      </div>
    }>
      <NationPageContent />
    </Suspense>
  );
}
