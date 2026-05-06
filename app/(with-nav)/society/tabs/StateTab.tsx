"use client";

import React from "react";
import GovernanceTabTemplate from "./GovernanceTabTemplate";
import ManifestoSection from "./ManifestoSection";

const topics = [
  { id: "stateFinance", label: "State Finance" },
  { id: "healthcareSystems", label: "State Healthcare" },
  { id: "schoolSystems", label: "State Education" },
  { id: "infrastructure", label: "State Infrastructure" },
  { id: "environment", label: "Environment Policy" },
  { id: "transport", label: "State Transport" },
  { id: "policyImplementation", label: "Policy Execution" },
  { id: "landRecords", label: "Land & Records" },
];

export default function StateTab() {
  return (
    <div className="space-y-8">

      {/* 🟦 INPUT LAYER */}
      <GovernanceTabTemplate
        governanceLevel="State Governance"
        topics={topics}
      />

      {/* 🔻 SEMANTIC DIVIDER */}
      <div className="relative py-6">
  
  {/* Lines */}
  <div className="absolute inset-0 flex items-center">
    <div className="w-full border-t border-white/10" />
  </div>

  {/* Label */}
  <div className="relative flex justify-center">
    <span className="px-6 py-2 text-sm md:text-base font-semibold tracking-wide uppercase 
                     text-white bg-gradient-to-r from-indigo-500/20 to-purple-500/20 
                     border border-white/10 rounded-full backdrop-blur-sm">
      Promises vs Reality
    </span>
  </div>

</div>

      {/* 🟧 REFERENCE LAYER */}
      <ManifestoSection />

    </div>
  );
}