"use client";

import React, { useEffect, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useLayerContext } from "@/components/LayerContext";
import UserSearch from "@/components/UserSearch";

// Lazy-loaded tabs (client-only)
const SelfTab = dynamic(() => import("./tabs/SelfTab"), { ssr: false });
const SocialTab = dynamic(() => import("./tabs/SocialTab"), { ssr: false });
const LearningTab = dynamic(() => import("./tabs/LearningTab"), { ssr: false });
const EarningTab = dynamic(() => import("./tabs/EarningTab"), { ssr: false });

type ActiveKind = "personal" | "social" | "learn" | "earn";

export default function UserPage() {
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab") ?? "";

  const ctx = useLayerContext();
  const layerId = "layer-self";

  // mounted guard to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveKind>("personal");

  // Normalize any incoming tab query (handles "self-social", "social", "self-socialtab", etc.)
  function normalizeTabValue(raw: string): ActiveKind {
    const s = String(raw || "").toLowerCase().trim();
    if (!s || s === "" || s.includes("personal")) return "personal";
    if (s.includes("social")) return "social";
    if (s.includes("learn") || s.includes("learning")) return "learn";
    if (s.includes("earn") || s.includes("earning")) return "earn";
    return "personal";
  }

  // 1) React to URL param first (this will update when HeaderTabs pushes ?tab=...)
  useEffect(() => {
    // if query present, prefer it. Otherwise fallthrough and let context decide below.
    if (!mounted) return;
    if (tabParamRaw && tabParamRaw.length > 0) {
      const normalized = normalizeTabValue(tabParamRaw);
      console.debug("[SelfPage] tabParamRaw:", tabParamRaw, "->", normalized);
      setActive(normalized);
      return;
    }

    // If no tab param, use the context value for this layer (if any)
    try {
      const ctxTab = ctx?.activeTabs?.[layerId];
      if (ctxTab) {
        const normalized = normalizeTabValue(ctxTab);
        console.debug("[SelfPage] using ctx.activeTabs:", ctxTab, "->", normalized);
        setActive(normalized);
      } else {
        // ensure default
        setActive("personal");
      }
    } catch (e) {
      console.warn("[SelfPage] error reading ctx.activeTabs", e);
      setActive("personal");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParamRaw, mounted, ctx?.activeTabs?.[layerId]]); // re-run if query or context tab changes

  // 2) Load profile once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { method: "GET", credentials: "include", headers: { Accept: "application/json" } });
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
        console.error("[SelfPage] profile fetch error", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Render
  return (
    <>
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">
          {active === "personal" ? "Personal" : active === "social" ? "Social" : active === "learn" ? "Learn" : "Earn"} Overview
        </h3>
        <p className="text-sm text-gray-300 mt-1">
          {loading
            ? "Loading…"
            : profile
            ? `Steps today: ${profile.stepsToday ?? "—"} • Sleep: ${profile.sleepHours ?? "—"}h • Water: ${profile.waterLitres ?? "—"}L`
            : "No stats yet — click Edit to add your health & profile data."}
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        {active === "personal" && <SelfTab profile={profile} />}
        {active === "social" && (
          <Suspense fallback={<div className="p-6 bg-white/6">Loading social…</div>}>
            <SocialTab profile={profile} />
            <div className="mt-6">
              <h4 className="text-sm text-gray-300 mb-3">Find people</h4>
              <UserSearch />
            </div>
          </Suspense>
        )}
        {active === "learn" && (
          <Suspense fallback={<div className="p-6 bg-white/6">Loading learning…</div>}>
            <LearningTab />
          </Suspense>
        )}
        {active === "earn" && (
          <Suspense fallback={<div className="p-6 bg-white/6">Loading earning…</div>}>
            <EarningTab />
          </Suspense>
        )}
      </div>
    </>
  );
}
