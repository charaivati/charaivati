"use client";

// CIVIC-1 — the Society "Panchayat/Ward" tab is the desktop home of the local
// issue board. Replaces the old GovernanceTabTemplate topic-grid stub (whose
// "observations" were never persisted). Bootstrap: fetch the caller's home
// unit → render their board; no home unit yet → render the picker.

import { useEffect, useState } from "react";
import IssueBoard from "@/components/civic/IssueBoard";
import UnitPicker from "@/components/civic/UnitPicker";

export default function LocalTab() {
  const [homeUnitId, setHomeUnitId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/civic/home-unit")
      .then((r) => (r.ok ? r.json() : { homeUnitId: null }))
      .then((d) => setHomeUnitId(d.homeUnitId ?? null))
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
        <UnitPicker theme="dark" onSet={(id) => setHomeUnitId(id)} />
      </div>
    );
  }

  return <IssueBoard unitId={homeUnitId} theme="dark" />;
}
