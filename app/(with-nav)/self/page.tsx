"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

type ProfileProp = { profile?: any };
type ActiveKind = "personal" | "social" | "learn" | "earn";

const SelfTab = dynamic(() => import("./tabs/SelfTab").then((m) => m.default), { ssr: false }) as unknown as React.ComponentType<ProfileProp>;
const SocialTab = dynamic(() => import("./tabs/SocialTab").then((m) => m.default), { ssr: false }) as unknown as React.ComponentType<ProfileProp>;
const LearningTab = dynamic(() => import("./tabs/LearningTab").then((m) => m.default), { ssr: false }) as unknown as React.ComponentType<Record<string, never>>;
const EarningTab = dynamic(() => import("./tabs/EarningTab").then((m) => m.default), { ssr: false }) as unknown as React.ComponentType<Record<string, never>>;

function normalizeTabValue(raw: string): ActiveKind {
  const s = String(raw || "").toLowerCase().trim();
  if (s.includes("social")) return "social";
  if (s.includes("learn")) return "learn";
  if (s.includes("earn")) return "earn";
  return "personal";
}

function SelfPageContent() {
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab") ?? "";

  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const active = useMemo<ActiveKind>(() => normalizeTabValue(tabParamRaw), [tabParamRaw]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/user/profile", {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!alive) return;

        if (res.status === 401) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (data?.ok) setProfile(data.profile || null);
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          console.error("[SelfPage] profile fetch error", err);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div className="text-left">
          <h3 className="text-lg font-semibold capitalize">{active} Overview</h3>
          <p className="text-sm text-gray-300 mt-1">
            {loading
              ? "Loading..."
              : profile
                ? `Steps today: ${profile.stepsToday ?? "-"} | Sleep: ${profile.sleepHours ?? "-"}h | Water: ${profile.waterLitres ?? "-"}L`
                : "No stats yet - click Edit to add your health and profile data."}
          </p>
        </div>

      <div className="max-w-3xl mx-auto">
        {active === "personal" && <SelfTab profile={profile} />}
        {active === "social" && <SocialTab profile={profile} />}
        {active === "learn" && <LearningTab />}
        {active === "earn" && <EarningTab />}
      </div>

export default function SelfPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading your profile...</div>}>
      <SelfPageContent />
    </Suspense>
  );
}
