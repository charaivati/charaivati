"use client";

// CIVIC-1 — the Society "Panchayat/Ward" tab is the desktop home of the local
// issue board. Home-unit set/change now lives in the shared LocationChainBar
// above the tabs (CIVIC-4) — this tab just needs the resolved id to render
// the resident's board.

import { useCivicChain } from "@/hooks/useCivicChain";
import IssueBoard from "@/components/civic/IssueBoard";
import AreaRatings from "@/components/civic/AreaRatings";

export default function LocalTab() {
  const { loading, homeUnitId } = useCivicChain();

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 rounded animate-pulse" style={{ width: "50%", background: "rgba(255,255,255,0.10)" }} />
        <div className="h-24 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.10)" }} />
        <div className="h-24 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.10)" }} />
      </div>
    );
  }

  if (!homeUnitId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <h3 className="text-lg font-semibold">Set your home area above ↑</h3>
        <p className="text-sm text-gray-300 mt-1">
          Pick your ward or panchayat in the location bar above — your board
          shows up here as soon as it&apos;s set.
        </p>
      </div>
    );
  }

  return (
    <div>
      <AreaRatings unitId={homeUnitId} theme="dark" />
      <IssueBoard unitId={homeUnitId} theme="dark" />
    </div>
  );
}
