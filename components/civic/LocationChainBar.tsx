"use client";

// CIVIC-4 — always-visible summary of the caller's civic chain (Country →
// State → Assembly → Panchayat/Ward), shown once above all four Society tabs
// so the resolved location isn't buried inside just the Panchayat/Ward tab.
// Country defaults to "India" (the only seeded country) even before a home
// unit is set. Change/add reuses the existing controls rather than inventing
// new ones: UnitPicker (search + propose-new) when no home unit is set yet,
// HomeUnitSelect (dropdown, 90-day lock) once one is.

import { useState } from "react";
import { useCivicChain } from "@/hooks/useCivicChain";
import UnitPicker from "./UnitPicker";
import HomeUnitSelect from "./HomeUnitSelect";

const DEFAULT_COUNTRY = "India";

export default function LocationChainBar() {
  const { loading, homeUnitId, autoPlaced, find, reload } = useCivicChain();
  const [changing, setChanging] = useState(false);

  if (loading) {
    return (
      <div
        className="h-16 rounded-2xl animate-pulse mb-6"
        style={{ background: "rgba(255,255,255,0.06)" }}
      />
    );
  }

  const chips = [
    { label: "Country", value: find("country")?.name ?? DEFAULT_COUNTRY },
    { label: "State", value: find("state")?.name ?? "Not set" },
    { label: "Assembly", value: find("assembly")?.name ?? "Not mapped" },
    { label: "Panchayat/Ward", value: find("ward")?.name ?? find("panchayat")?.name ?? "Not set" },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 mb-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {chips.map((c) => (
          <div key={c.label}>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">{c.label}</div>
            <div
              className={`text-sm font-semibold ${
                c.value === "Not set" || c.value === "Not mapped" ? "text-gray-500" : "text-white"
              }`}
            >
              {c.value}
            </div>
          </div>
        ))}
        {homeUnitId && (
          <button
            onClick={() => setChanging((v) => !v)}
            className="ml-auto text-xs font-semibold text-indigo-300 hover:text-indigo-200 underline"
          >
            {changing ? "Cancel" : "Change area"}
          </button>
        )}
      </div>

      {homeUnitId && changing && (
        <div className="mt-3">
          <HomeUnitSelect
            theme="dark"
            homeUnitId={homeUnitId}
            autoPlaced={autoPlaced}
            onChanged={() => {
              setChanging(false);
              reload();
            }}
          />
        </div>
      )}

      {!homeUnitId && (
        <div className="mt-3">
          <UnitPicker
            theme="dark"
            autoApply
            onSet={() => reload()}
          />
        </div>
      )}
    </div>
  );
}
