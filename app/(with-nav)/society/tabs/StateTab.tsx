"use client";

// CIVIC-2 — State view derives from the home ward's chain and shows the state
// rollup (replaced the topic-grid stub). ManifestoSection ("Promises vs
// Reality") is real content and stays below it.

import ChainRollupTab from "@/components/civic/ChainRollupTab";
import ManifestoSection from "./ManifestoSection";

export default function StateTab() {
  return (
    <div className="space-y-8">
      <ChainRollupTab unitType="state" label="State" />

      {/* Semantic divider */}
      <div className="relative py-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center">
          <span
            className="px-6 py-2 text-sm md:text-base font-semibold tracking-wide uppercase
                     text-white bg-gradient-to-r from-indigo-500/20 to-purple-500/20
                     border border-white/10 rounded-full backdrop-blur-sm"
          >
            Promises vs Reality
          </span>
        </div>
      </div>

      <ManifestoSection />
    </div>
  );
}
