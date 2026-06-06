"use client";
// components/business/MarketSizingPanel.tsx
// BIZDOC-4: TAM/SAM/SOM display with user-adjustable percentages.
//
// MATH CONTRACT: ALL arithmetic is computed in this component (JS), never by AI.
// The model supplies populationBasis, samPct, somPct, and rationale.
// User adjustments are debounced and persisted to DB via PATCH /api/business/idea/market-sizing.
// On reload the sizing prop comes from DB so persisted adjustments survive refresh.

import React, { useEffect, useRef, useState } from "react";

export interface MarketAssumption {
  id: string;
  label: string;
  pct: number;
  rationale: string;
  validationTask: string;
  successThreshold: string;
}

export interface MarketSizingData {
  tam: number;
  sam: number;
  som: number;
  populationBasis: number;
  populationDescription: string;
  samPct: number;
  samRationale: string;
  somPct: number;
  somRationale: string;
  assumptions: MarketAssumption[];
}

function formatNumber(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)} L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

type SaveState = "idle" | "saving" | "saved";

interface Props {
  sizing: MarketSizingData;
  ideaId: string;
  isGuest: boolean;
}

export default function MarketSizingPanel({ sizing, ideaId, isGuest }: Props) {
  // Initialize from persisted DB values (which already reflect any prior adjustments)
  const [samPct, setSamPct] = useState(Math.round(sizing.samPct * 100));
  const [somPct, setSomPct] = useState(Math.round(sizing.somPct * 100));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Math in code — same contract as runMarketSizing.ts
  const tam = sizing.populationBasis;
  const sam = Math.round(tam * (samPct / 100));
  const som = Math.round(sam * (somPct / 100));

  // Dynamic assumption labels — always match current slider values, never stale
  const samLabel = `${samPct}% of the market is reachable`;
  const somLabel = `${somPct}% of reachable market captured in year 1`;
  const displayedAssumptions = sizing.assumptions.map((a) => {
    if (a.id === "sam") return { ...a, label: samLabel };
    if (a.id === "som") return { ...a, label: somLabel };
    return a;
  });

  function persistSliderChange(newSam: number, newSom: number) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveState("saving");

    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/business/idea/market-sizing", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ideaId, samPct: newSam, somPct: newSom }),
        });
        if (res.ok) {
          setSaveState("saved");
          savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000);
        } else {
          setSaveState("idle");
        }
      } catch {
        setSaveState("idle");
      }
    }, 800);
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  function handleSamChange(v: number) {
    setSamPct(v);
    persistSliderChange(v, somPct);
  }

  function handleSomChange(v: number) {
    setSomPct(v);
    persistSliderChange(samPct, v);
  }

  return (
    <div className="rounded-2xl bg-indigo-950/60 border border-indigo-800/40 p-4 space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-indigo-300 font-semibold text-base">Market Sizing</span>
          <span className="text-xs bg-indigo-800/50 text-indigo-300 px-2 py-0.5 rounded-full">ASSUMPTION</span>
        </div>
        {saveState === "saving" && (
          <span className="text-xs text-slate-500 animate-pulse">Saving…</span>
        )}
        {saveState === "saved" && (
          <span className="text-xs text-green-500">✓ Saved</span>
        )}
      </div>

      <p className="text-slate-400 text-xs leading-relaxed">
        {sizing.populationDescription}
      </p>

      {/* TAM/SAM/SOM numbers — computed in code */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "TAM", value: tam, desc: "Total market" },
          { label: "SAM", value: sam, desc: `${samPct}% reachable` },
          { label: "SOM", value: som, desc: `${somPct}% year 1` },
        ].map(({ label, value, desc }) => (
          <div key={label} className="bg-slate-800/60 rounded-xl p-3 text-center">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className="text-lg font-bold text-white">{formatNumber(value)}</div>
            <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
          </div>
        ))}
      </div>

      {/* Adjustable assumptions */}
      <div className="space-y-3">
        <AssumptionSlider
          label={`SAM assumption: ${samPct}% of market is reachable`}
          rationale={sizing.samRationale}
          value={samPct}
          onChange={handleSamChange}
          min={1}
          max={80}
        />
        <AssumptionSlider
          label={`SOM assumption: ${somPct}% captured in year 1`}
          rationale={sizing.somRationale}
          value={somPct}
          onChange={handleSomChange}
          min={1}
          max={50}
        />
      </div>

      {/* Validation tasks — labels stay current with slider */}
      <div className="space-y-2 pt-1">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Validate these assumptions
        </div>
        {displayedAssumptions.map((a) => (
          <div key={a.id} className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-3 space-y-1">
            <div className="flex items-start gap-2">
              <span className="text-amber-400 text-xs mt-0.5">⚡</span>
              <div>
                <div className="text-amber-200 text-xs font-medium">{a.label}</div>
                <div className="text-slate-300 text-xs mt-1">{a.validationTask}</div>
                <div className="text-slate-500 text-xs mt-0.5">Pass: {a.successThreshold}</div>
              </div>
            </div>
          </div>
        ))}
        {isGuest && (
          <p className="text-xs text-slate-500 italic">
            Sign in to save these as validation tasks in your todo list.
          </p>
        )}
        {!isGuest && (
          <p className="text-xs text-slate-500">
            These have been added to your <a href="/self?tab=todo" className="text-indigo-400 underline">todo list</a>.
          </p>
        )}
      </div>
    </div>
  );
}

interface SliderProps {
  label: string;
  rationale: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}

function AssumptionSlider({ label, rationale, value, onChange, min, max }: SliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-300">{label}</span>
        <span className="text-xs text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-indigo-500 cursor-pointer"
      />
      <p className="text-xs text-slate-500 italic">{rationale}</p>
    </div>
  );
}
