"use client";
// app/(with-nav)/earth/tabs/KnowledgeTab.tsx — placeholder

import React from "react";
import { SectionCard } from "@/components/self/shared";

export default function KnowledgeTab() {
  return (
    <div className="text-white">
      <SectionCard className="p-6">
        <h2 className="text-base font-semibold text-white mb-1">Knowledge &amp; Tools</h2>
        <p className="text-xs text-gray-400 mb-6">
          Data sources, research, and tools for understanding planetary systems.
        </p>
        <div className="rounded-xl border border-white/5 bg-white/3 px-5 py-8 text-center">
          <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
            Resources coming soon. This section will aggregate data sources, research papers, and interactive tools.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
