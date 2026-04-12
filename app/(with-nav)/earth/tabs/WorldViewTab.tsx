"use client";
// app/(with-nav)/earth/tabs/WorldViewTab.tsx — Planetary Systems dashboard

import React, { useState } from "react";
import SignalCard from "@/components/earth/SignalCard";
import SignalDetailDrawer from "@/components/earth/SignalDetailDrawer";
import ImpactLens from "@/components/earth/ImpactLens";
import { SIGNAL_DETAILS } from "@/components/earth/earthData";
import type { SignalDetail } from "@/components/earth/earthData";

export default function WorldViewTab() {
  const [activeSignal, setActiveSignal] = useState<SignalDetail | null>(null);

  return (
    <div className="space-y-6 text-white">

      {/* Planetary Systems Overview */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Planetary Systems Overview</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            These signals represent shared planetary conditions and collective system performance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SIGNAL_DETAILS.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onClick={() => setActiveSignal(signal)}
            />
          ))}
        </div>
      </section>

      {/* Your Impact Lens */}
      <ImpactLens region="West Bengal, India" />

      {/* Global selection footer */}
      <p className="text-xs text-gray-600 text-center pb-2">
        Region: World · Focus: Climate
      </p>

      {/* Signal detail drawer — rendered at this level, fixed-positioned */}
      <SignalDetailDrawer
        signal={activeSignal}
        onClose={() => setActiveSignal(null)}
      />
    </div>
  );
}
