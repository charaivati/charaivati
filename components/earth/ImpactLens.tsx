"use client";
// components/earth/ImpactLens.tsx — location-aware personal context block

import React from "react";
import { SIGNAL_DETAILS, REGIONAL_DATA } from "./earthData";
import type { SignalId } from "./earthData";

interface ImpactLensProps {
  region?: string;
}

function deltaLabel(delta: number): { text: string; color: string } {
  if (delta > 0) return { text: `+${delta} vs global`, color: "text-emerald-400" };
  if (delta < 0) return { text: `${delta} vs global`, color: "text-red-400" };
  return { text: "on par with global", color: "text-gray-500" };
}

export default function ImpactLens({ region = "West Bengal, India" }: ImpactLensProps) {
  const regional = REGIONAL_DATA[region] ?? REGIONAL_DATA["West Bengal, India"];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Teal left accent stripe */}
      <div className="flex">
        <div className="w-1 flex-shrink-0 bg-gradient-to-b from-teal-500 to-cyan-600 rounded-l-xl" />
        <div className="flex-1 p-4">
          {/* Heading */}
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-white">Your Impact Lens</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Based on your region:{" "}
              <span className="text-gray-200 font-medium">{region}</span>
            </p>
          </div>

          {/* Signal rows */}
          <div className="space-y-2 mb-4">
            {SIGNAL_DETAILS.map((s) => {
              const regionalVal = regional[s.id as SignalId];
              const delta = regionalVal - s.value;
              const { text, color } = deltaLabel(delta);
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-300 truncate flex-1">{s.name}</span>
                  <span className="text-white font-semibold flex-shrink-0">{regionalVal}%</span>
                  <span className={`${color} flex-shrink-0 w-28 text-right`}>{text}</span>
                </div>
              );
            })}
          </div>

          {/* AI insight */}
          <p className="text-xs text-gray-400 leading-relaxed border-t border-white/5 pt-3">
            Your region faces above-average climate risk and below-average food resilience.
            Biodiversity restoration efforts in the Sundarbans could have outsized local impact.
          </p>
        </div>
      </div>
    </div>
  );
}
