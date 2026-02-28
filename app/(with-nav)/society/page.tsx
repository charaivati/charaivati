"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLayerContext } from "@/components/LayerContext";

/* =========================
   Types
========================= */

type LocalSelection = {
  country?: string;
  state?: string;
  parliamentary?: string;
  legislative?: string;
  panchayat?: string;
};

/* =========================
   Dynamic Tab Imports
   (Must match file names exactly)
========================= */

const PanchayatTab = dynamic(
  () => import("./tabs/PanchayatTab"),
  { ssr: false }
);

const LegislativeTab = dynamic(
  () => import("./tabs/LegislativeTab"),
  { ssr: false }
);

const ParliamentaryTab = dynamic(
  () => import("./tabs/ParliamentaryTab"),
  { ssr: false }
);

const StateTab = dynamic(
  () => import("./tabs/StateTab"),
  { ssr: false }
);

/* =========================
   Component
========================= */

export default function SocietyPage() {
  const ctx = useLayerContext();
  const LS_KEY = "charaivati.selectedLocal";

  const [local, setLocal] = useState<LocalSelection | null>(null);

  /* =========================
     Load Selection From LocalStorage
  ========================= */

  useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem(LS_KEY)
          : null;

      if (raw) {
        const parsed: LocalSelection = JSON.parse(raw);
        setLocal(parsed);
      } else {
        // Default prefill (safe fallback)
        const prefill: LocalSelection = {
          country: "India",
          state: "Assam",
          parliamentary: "Jorhat",
          legislative: "Nazira",
          panchayat: "Amguri Gaon Panchayat",
        };

        setLocal(prefill);
        localStorage.setItem(LS_KEY, JSON.stringify(prefill));
      }
    } catch (e) {
      console.warn("Could not read local selection", e);
      setLocal(null);
    }
  }, []);

  /* =========================
     Update Local Selection
  ========================= */

  function updateLocal(partial: Partial<LocalSelection>) {
    const merged = { ...(local || {}), ...partial };
    setLocal(merged);

    try {
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn("Could not persist selection", e);
    }
  }

  /* =========================
     Determine Active Tab
  ========================= */

  const layerId = "layer-society-home";

  const activeTabId =
    ctx?.activeTabs?.[layerId] ??
    ctx?.layers?.find((l) => l.id === layerId)?.tabs?.[0]?.id;

  const active = String(activeTabId || "").toLowerCase();

  const showPanchayat = active.includes("panchayat");
  const showLegislative = active.includes("legislative");
  const showParliamentary = active.includes("parliament");
  const showState = active.includes("state");

  /* =========================
     Render
  ========================= */

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Society</h1>
        <p className="text-sm text-gray-400">
          Governance topics and local civic responses
        </p>
      </div>

      <div className="space-y-6">
        {showPanchayat && (
          <PanchayatTab
            value={local?.panchayat ?? ""}
            onChange={(v: string) =>
              updateLocal({ panchayat: v })
            }
          />
        )}

        {showLegislative && (
          <LegislativeTab
            value={local?.legislative ?? ""}
            onChange={(v: string) =>
              updateLocal({ legislative: v })
            }
          />
        )}

        {showParliamentary && (
          <ParliamentaryTab
            value={local?.parliamentary ?? ""}
            onChange={(v: string) =>
              updateLocal({ parliamentary: v })
            }
          />
        )}

        {showState && (
          <StateTab
            value={local?.state ?? ""}
            onChange={(v: string) =>
              updateLocal({ state: v })
            }
          />
        )}
      </div>
    </>
  );
}
