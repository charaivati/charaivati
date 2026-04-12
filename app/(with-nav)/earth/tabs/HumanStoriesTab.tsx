"use client";
// app/(with-nav)/earth/tabs/HumanStoriesTab.tsx — placeholder

import React from "react";
import { SectionCard } from "@/components/self/shared";

export default function HumanStoriesTab() {
  return (
    <div className="text-white">
      <SectionCard className="p-6">
        <h2 className="text-base font-semibold text-white mb-1">Human Stories</h2>
        <p className="text-xs text-gray-400 mb-6">
          Stories from people and places shaping our planet.
        </p>
        <div className="rounded-xl border border-white/5 bg-white/3 px-5 py-8 text-center">
          <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            Stories coming soon. This section will feature real narratives from communities around the world.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
