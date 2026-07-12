"use client";

// CIVIC-1 — the Society "Panchayat/Ward" tab is the desktop home of the local
// issue board. Replaces the old GovernanceTabTemplate topic-grid stub (whose
// "observations" were never persisted). Bootstrap: fetch the caller's home
// unit → render their board; no home unit yet → render the picker.
//
// Address auto-placement: the picker runs with autoApply, so a user with a
// saved address that confidently matches one ward/panchayat lands on their
// board with zero clicks. HomeUnitSelect above the board is the correction
// path — a dropdown to confirm or change (manual changes carry the 90-day lock).

import { useEffect, useState } from "react";
import IssueBoard from "@/components/civic/IssueBoard";
import UnitPicker from "@/components/civic/UnitPicker";
import HomeUnitSelect from "@/components/civic/HomeUnitSelect";
import AreaRatings from "@/components/civic/AreaRatings";

export default function LocalTab() {
  const [homeUnitId, setHomeUnitId] = useState<string | null>(null);
  const [autoPlaced, setAutoPlaced] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/civic/home-unit")
      .then((r) => (r.ok ? r.json() : { homeUnitId: null }))
      .then((d) => {
        setHomeUnitId(d.homeUnitId ?? null);
        setAutoPlaced(d.autoPlaced === true);
      })
      .catch(() => setHomeUnitId(null))
      .finally(() => setLoading(false));
  }, []);

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
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <UnitPicker
          theme="dark"
          autoApply
          onSet={(id, meta) => {
            setHomeUnitId(id);
            setAutoPlaced(meta?.auto === true);
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <HomeUnitSelect
        theme="dark"
        homeUnitId={homeUnitId}
        autoPlaced={autoPlaced}
        onChanged={(id) => {
          setHomeUnitId(id);
          setAutoPlaced(false);
        }}
      />
      <AreaRatings unitId={homeUnitId} theme="dark" />
      <IssueBoard unitId={homeUnitId} theme="dark" />
    </div>
  );
}
