// app/(with-nav)/society/page.tsx
"use client";
import React from "react";
import dynamic from "next/dynamic";
import { useLayerContext } from "@/components/LayerContext";

const LocalTab = dynamic(() => import("./tabs/LocalTab"), { ssr: false });
const LegislativeTab = dynamic(() => import("./tabs/LegislativeTab"), { ssr: false });
const ParliamentaryTab = dynamic(() => import("./tabs/ParliamentaryTab"), { ssr: false });
const StateTab = dynamic(() => import("./tabs/StateTab"), { ssr: false });

export default function SocietyPage() {
  const ctx = useLayerContext();

  const layerId = "layer-society-home";
  const activeTabId =
    ctx?.activeTabs?.[layerId] ?? ctx?.layers?.find((l) => l.id === layerId)?.tabs?.[0]?.id;
  const normalized = String(activeTabId || "").toLowerCase();

  const showLocal = normalized.includes("panchayat") || normalized.includes("local");
  const showLegislative = normalized.includes("legislative");
  const showParliamentary = normalized.includes("parliament");
  const showState = normalized.includes("state");

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Society</h1>
        <p className="text-sm text-gray-400">Governance topics and local civic responses</p>
      </div>

      <div className="space-y-6">
        {showLocal && <LocalTab />}
        {showLegislative && <LegislativeTab />}
        {showParliamentary && <ParliamentaryTab />}
        {showState && <StateTab />}
      </div>
    </>
  );
}
