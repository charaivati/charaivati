"use client";

// CIVIC-2 — Parliamentary constituency view derives from the home ward's
// chain and shows the parliamentary rollup. Replaced the topic-grid stub.

import ChainRollupTab from "@/components/civic/ChainRollupTab";

export default function ParliamentaryTab() {
  return <ChainRollupTab unitType="parliamentary" label="Parliamentary constituency" />;
}
