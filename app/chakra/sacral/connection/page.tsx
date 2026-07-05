"use client";

// CHAKRA-ACTION-2: Sacral-chakra connection page — /chakra/sacral/connection.
// Reached from the sacral chakra detail page's "Work on this" factor link
// (SIGNAL_LINKS.friends in app/chakra/meta.ts). Three blocks, all riding
// EXISTING backends — no new write paths:
//   1. Hobbies/creativity — chip selector persisting to Profile.health.joy.hobbies.types
//      (whole health object PATCHed to /api/user/profile, matching HealthBlock/survival);
//   2. Friends — components/social/FriendRequestsBox.tsx (incoming requests) +
//      its named export InviteFriend, exactly as SocialTab.tsx uses them;
//   3. Circles — components/CirclesPanel.tsx rendered directly (its own
//      /api/circles CRUD is self-contained).

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { CHAKRAS } from "../../chakras";
import { useTranslations } from "@/hooks/useTranslations";
import FriendRequestsBox, { InviteFriend } from "@/components/social/FriendRequestsBox";
import CirclesPanel from "@/components/CirclesPanel";
import type { HealthProfile, JoyProfile, FrequencyType } from "@/types/self";

const T_SLUGS = [
  "chakra-saved",
  "connection-title", "connection-sub",
  "connection-hobbies-title", "connection-hobbies-sub",
  "connection-hobbies-frequency", "connection-hobbies-empty",
  "connection-friends-title", "connection-friends-sub",
  "connection-circles-title", "connection-circles-sub",
].join(",");

const SACRAL = CHAKRAS[1]; // Svadhisthana — colour + names

// Deterministic starfield — same Math.sin hash as /chakra/[key] (SSR-safe).
const STARS = Array.from({ length: 26 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
  return { top: r(1) * 100, left: r(2) * 100, size: 1 + r(3) * 1.5, delay: r(4) * 4, dur: 2 + r(5) * 3 };
});

const DEFAULT_JOY: JoyProfile = {
  hobbies: { types: [], frequency: "weekly" },
  sports: { types: [], frequency: "weekly" },
  social: { types: [], frequency: "weekly" },
  rest: { types: [], frequency: "weekly" },
};

const DEFAULT_HEALTH: HealthProfile = {
  food: "Vegetarian", exercise: "Mixed", sessionsPerWeek: 3,
  heightCm: "", weightKg: "", age: "", joy: DEFAULT_JOY,
};

const HOBBY_OPTIONS = [
  "Music", "Reading", "Art & drawing", "Photography", "Cooking", "Gardening",
  "Writing", "Dance", "Gaming", "Crafts & DIY", "Sports", "Travel",
];

const FREQUENCIES: FrequencyType[] = ["daily", "few_per_week", "weekly", "rarely"];

export default function ConnectionPlanPage() {
  const t = useTranslations(T_SLUGS);
  const c = SACRAL;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [loaded, setLoaded] = useState(false);
  const [health, setHealth] = useState<HealthProfile>(DEFAULT_HEALTH);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const healthRef = useRef<HealthProfile>(DEFAULT_HEALTH);

  useEffect(() => {
    fetch("/api/user/profile", { credentials: "include" })
      .then((r) => r.json())
      .catch(() => null)
      .then((j) => {
        // No silent early-return: a brand-new account (no Profile row) must
        // still render a fully editable hobby chip selector.
        const p = j?.ok && j.profile ? j.profile : {};
        const h: HealthProfile = { ...DEFAULT_HEALTH, ...(p.health ?? {}) };
        h.joy = { ...DEFAULT_JOY, ...(h.joy ?? {}) };
        h.joy.hobbies = {
          types: Array.isArray(h.joy.hobbies?.types) ? h.joy.hobbies.types : [],
          frequency: h.joy.hobbies?.frequency ?? "weekly",
        };
        setHealth(h);
        healthRef.current = h;
        setLoaded(true);
      });
  }, []);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function saveHealth(next: HealthProfile) {
    healthRef.current = next;
    setHealth(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/user/profile", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ health: healthRef.current }),
      }).then(flashSaved).catch(() => {});
    }, 800);
  }

  function toggleHobby(hobby: string) {
    const current = healthRef.current;
    const existing = current.joy!.hobbies.types;
    const types = existing.includes(hobby)
      ? existing.filter((h) => h !== hobby)
      : [...existing, hobby];
    saveHealth({ ...current, joy: { ...current.joy!, hobbies: { ...current.joy!.hobbies, types } } });
  }

  function setFrequency(frequency: FrequencyType) {
    const current = healthRef.current;
    saveHealth({ ...current, joy: { ...current.joy!, hobbies: { ...current.joy!.hobbies, frequency } } });
  }

  const card: CSSProperties = { borderColor: `${c.color}26`, background: "rgba(8,8,14,0.62)" };
  const hobbyTypes = health.joy?.hobbies.types ?? [];
  const hobbyFrequency = health.joy?.hobbies.frequency ?? "weekly";

  return (
    <main className="relative min-h-screen bg-black text-white">
      <style>{`
        @keyframes chakraTwinkle { 0%,100% { opacity: .15; } 50% { opacity: 1; } }
        @keyframes chakraCardIn { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
      `}</style>

      {mounted && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          {STARS.map((s, i) => (
            <span key={i} style={{ position: "absolute", top: `${s.top}%`, left: `${s.left}%`,
              width: s.size, height: s.size, borderRadius: "50%", background: "#fff",
              animation: `chakraTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite` }} />
          ))}
        </div>
      )}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
        style={{ background: `radial-gradient(90% 50% at 50% 0%, ${c.color}22 0%, transparent 65%)` }} />

      <Link href="/chakra/sacral" className="fixed top-4 left-4 z-20 text-sm text-white/40 hover:text-white/80">
        ← {c.sanskrit}
      </Link>
      {saved && (
        <span className="fixed top-4 right-4 z-20 text-xs" style={{ color: c.color }}>
          {t("chakra-saved", "Saved ✓")}
        </span>
      )}

      <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-12 pt-16" style={{ animation: "chakraCardIn .35s ease-out" }}>
        <h1 className="text-xl font-semibold">{t("connection-title", "Connection plan")}</h1>
        <p className="mt-1 text-sm text-white/50">
          {t("connection-sub", "What you create, who you keep close, and the circles that hold you.")}
        </p>

        {/* ── 1 · Hobbies / creativity ── */}
        <section className="mt-6 rounded-xl border p-4" style={card}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-white/70">
            {t("connection-hobbies-title", "Hobbies & creativity")}
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {t("connection-hobbies-sub", "What lets your creative flow move.")}
          </p>

          {!loaded ? (
            <div className="mt-3 h-24 animate-pulse rounded-lg bg-white/5" />
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {HOBBY_OPTIONS.map((hobby) => {
                  const active = hobbyTypes.includes(hobby);
                  return (
                    <button
                      key={hobby}
                      type="button"
                      onClick={() => toggleHobby(hobby)}
                      className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                      style={active
                        ? { background: `${c.color}22`, borderColor: `${c.color}66`, color: c.color }
                        : { background: "transparent", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                    >
                      {hobby}
                    </button>
                  );
                })}
              </div>
              {hobbyTypes.length === 0 && (
                <p className="mt-2 text-xs text-white/40">
                  {t("connection-hobbies-empty", "Pick a few to start — you can change these anytime.")}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
                <span className="text-[10px] uppercase tracking-wider text-white/40">
                  {t("connection-hobbies-frequency", "How often")}
                </span>
                <div className="ml-auto flex gap-1">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className="rounded-md px-2 py-1 text-[10px] font-medium"
                      style={f === hobbyFrequency
                        ? { background: c.color, color: "#0b0b10" }
                        : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
                    >
                      {f.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── 2 · Friends ── */}
        <section className="mt-4 rounded-xl border p-4" style={card}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-white/70">
            {t("connection-friends-title", "Friends")}
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {t("connection-friends-sub", "The people you've connected with here.")}
          </p>
          <div className="mt-3">
            <FriendRequestsBox />
          </div>
          <div className="mt-4 border-t border-white/5 pt-4">
            <InviteFriend />
          </div>
        </section>

        {/* ── 3 · Circles ── */}
        <section className="mt-4 rounded-xl border p-4" style={card}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-white/70">
            {t("connection-circles-title", "Circles")}
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {t("connection-circles-sub", "Group your friends and connections however makes sense to you.")}
          </p>
          <div className="mt-3">
            <CirclesPanel />
          </div>
        </section>
      </div>
    </main>
  );
}
