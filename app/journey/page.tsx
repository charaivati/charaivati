"use client";

import { Suspense, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";

import { Stage } from "./_constants/stages";
import { useJourneyState } from "./_hooks/useJourneyState";

// Typed dynamic imports — each scene declares its own props interface
const UniverseScene = dynamic<{ onLangSelected: (code: string) => void }>(
  () => import("./_scenes/UniverseScene"),
  { ssr: false }
);
const TravelScene = dynamic<{ lang: string }>(
  () => import("./_scenes/TravelScene"),
  { ssr: false }
);
const EarthScene = dynamic<{
  onLocationConfirmed: (
    country: string,
    countryName: string,
    coords: { lat: number; lng: number } | null
  ) => void;
}>(
  () => import("./_scenes/EarthScene"),
  { ssr: false }
);
const LandmassScene = dynamic<{ countryName: string; lang: string }>(
  () => import("./_scenes/LandmassScene"),
  { ssr: false }
);
const SelfScene = dynamic<{ lang: string }>(
  () => import("./_scenes/SelfScene"),
  { ssr: false }
);

const Dark = <div style={{ position: "absolute", inset: 0, background: "#050508" }} />;

export default function JourneyPage() {
  const { state, setStage, setLang, setCountry } = useJourneyState();
  const { stage, lang, countryName } = state;

  // TRAVEL auto-advances to EARTH
  useEffect(() => {
    if (stage !== Stage.TRAVEL) return;
    const t = setTimeout(() => setStage(Stage.EARTH), 3200);
    return () => clearTimeout(t);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // LANDMASS auto-advances to SELF
  useEffect(() => {
    if (stage !== Stage.LANDMASS) return;
    const t = setTimeout(() => setStage(Stage.SELF), 2200);
    return () => clearTimeout(t);
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLangSelected(code: string) {
    setLang(code);
    setStage(Stage.TRAVEL);
  }

  function handleLocationConfirmed(
    country: string,
    name: string,
    coords: { lat: number; lng: number } | null
  ) {
    setCountry(country, name, coords);
    setStage(Stage.LANDMASS);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#050508",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 60,
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.38)",
            textTransform: "uppercase",
          }}
        >
          Charaivati
        </span>
        <a
          href="/local/select-country"
          style={{
            pointerEvents: "auto",
            fontSize: 11,
            color: "rgba(255,255,255,0.32)",
            textDecoration: "none",
            padding: "6px 14px",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(6px)",
            letterSpacing: "0.05em",
          }}
        >
          Skip →
        </a>
      </div>

      {/* Stage crossfade */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Suspense fallback={Dark}>
            {stage === Stage.UNIVERSE && (
              <UniverseScene onLangSelected={handleLangSelected} />
            )}
            {stage === Stage.TRAVEL && <TravelScene lang={lang} />}
            {stage === Stage.EARTH && (
              <EarthScene onLocationConfirmed={handleLocationConfirmed} />
            )}
            {stage === Stage.LANDMASS && (
              <LandmassScene
                countryName={countryName || "Earth"}
                lang={lang}
              />
            )}
            {stage === Stage.SELF && <SelfScene lang={lang} />}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
