"use client";

import { useState, useEffect } from "react";
import { Stage } from "../_constants/stages";

export interface JourneyState {
  stage: Stage;
  lang: string;
  country: string;
  countryName: string;
  coords: { lat: number; lng: number } | null;
}

const STORAGE_KEY = "charaivati_journey";

const DEFAULT: JourneyState = {
  stage: Stage.UNIVERSE,
  lang: "en",
  country: "",
  countryName: "",
  coords: null,
};

export function useJourneyState() {
  const [state, setState] = useState<JourneyState>(DEFAULT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<JourneyState>;
      // Warp is transient — resume from EARTH if refreshed mid-travel
      if (parsed.stage === Stage.TRAVEL) parsed.stage = Stage.EARTH;
      setState((s) => ({ ...s, ...parsed }));
    } catch {}
  }, []);

  function persist(next: JourneyState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  function update(patch: Partial<JourneyState>) {
    setState((s) => {
      const next = { ...s, ...patch };
      persist(next);
      return next;
    });
  }

  return {
    state,
    setStage: (stage: Stage) => update({ stage }),
    setLang: (lang: string) => update({ lang }),
    setCountry: (
      country: string,
      countryName: string,
      coords: { lat: number; lng: number } | null
    ) => update({ country, countryName, coords }),
  };
}
