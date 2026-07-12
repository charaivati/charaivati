"use client";

// CIVIC-2 — one component behind the Society Legislative/Parliamentary/State
// tabs: resolve the unit of the given type from the caller's home-unit chain
// and render its rollup. No home area set → point at the Panchayat/Ward tab
// (the one selection everything derives from). Chain has no unit of this
// type → say so honestly instead of showing an empty board.

import { useCivicChain } from "@/hooks/useCivicChain";
import RollupBoard from "@/components/civic/RollupBoard";

export default function ChainRollupTab({
  unitType,
  label,
}: {
  unitType: "assembly" | "parliamentary" | "state" | "country";
  label: string;
}) {
  const { loading, homeUnitId, find } = useCivicChain();

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 rounded-xl animate-pulse" style={{ width: "50%", background: "rgba(255,255,255,0.10)" }} />
        <div className="h-24 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.10)" }} />
      </div>
    );
  }

  if (!homeUnitId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <h3 className="text-lg font-semibold">Set your home area first</h3>
        <p className="text-sm text-gray-300 mt-1">
          Your {label.toLowerCase()} is derived from your ward or panchayat. Pick
          it in the <span className="font-semibold">Panchayat/Ward</span> tab and
          everything here fills in automatically.
        </p>
      </div>
    );
  }

  const unit = find(unitType);
  if (!unit) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <h3 className="text-lg font-semibold">{label} not mapped yet</h3>
        <p className="text-sm text-gray-300 mt-1">
          Your home area isn&apos;t linked to a {label.toLowerCase()} in our data
          yet. Coverage is expanding — your local board keeps working meanwhile.
        </p>
      </div>
    );
  }

  return (
    <RollupBoard
      unitId={unit.id}
      subheading={`Your ${label.toLowerCase()}, derived from your home area — what its local areas are demanding.`}
    />
  );
}
