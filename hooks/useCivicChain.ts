"use client";

// CIVIC-2 — the caller's home-unit ancestor chain, fetched once per mount.
// One panchayat/ward selection fills every higher layer: find("assembly") /
// find("parliamentary") / find("state") / find("country") resolve the unit
// whose rollup that layer's page should show.

import { useEffect, useState } from "react";

export type ChainUnit = { id: string; type: string; name: string };

export function useCivicChain() {
  const [chain, setChain] = useState<ChainUnit[] | null>(null);
  const [homeUnitId, setHomeUnitId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/civic/home-unit")
      .then((r) => (r.ok ? r.json() : { homeUnitId: null, chain: [] }))
      .then((d) => {
        setHomeUnitId(d.homeUnitId ?? null);
        setChain(d.chain ?? []);
      })
      .catch(() => setChain([]))
      .finally(() => setLoading(false));
  }, []);

  const find = (type: string) => chain?.find((u) => u.type === type) ?? null;

  return { loading, homeUnitId, chain: chain ?? [], find };
}
