"use client";

// CIVIC-2 — Legislative constituency view derives from the home ward's chain
// and shows the assembly rollup. Replaced the GovernanceTabTemplate topic-grid
// stub (its observations were never persisted).

import ChainRollupTab from "@/components/civic/ChainRollupTab";

export default function LegislativeTab() {
  return <ChainRollupTab unitType="assembly" label="Legislative constituency" />;
}
