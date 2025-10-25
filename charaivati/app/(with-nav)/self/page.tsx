// app/self/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useLayerContext } from "@/components/LayerContext";
import UserSearch from "@/components/UserSearch";

// Lazy tabs (client-only)
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
  const router = useRouter();

  // mounted guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // profile + loading
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // active tab
  const [active, setActive] = useState<ActiveKind>("personal");

  // Normalize tab value
  function normalizeTabValue(raw: string): ActiveKind {
    const s = String(raw || "").toLowerCase().trim();
    if (!s || s.includes("personal")) return "personal";
    if (s.includes("social")) return "social";
    if (s.includes("learn")) return "learn";
    if (s.includes("earn")) return "earn";
    return "personal";
  }

  // sync url/context -> active
  useEffect(() => {
    if (!mounted) return;
    if (tabParamRaw && tabParamRaw.length > 0) {
      setActive(normalizeTabValue(tabParamRaw));
      return;
    }
    try {
      const ctxTab = ctx?.activeTabs?.[layerId];
      if (ctxTab) setActive(normalizeTabValue(ctxTab));
      else setActive("personal");
    } catch {
      setActive("personal");
    }
  }, [tabParamRaw, mounted, ctx?.activeTabs?.[layerId]]);

  // load profile (with AbortController)
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
        if ((err as any)?.name === "AbortError") {
          /* aborted */
        } else {
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

  // Render
  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div className="text-left">
          <h3 className="text-lg font-semibold">
            {active === "personal" ? "Personal" : active === "social" ? "Social" : active === "learn" ? "Learn" : "Earn"}{" "}
            Overview
          </h3>
          <p className="text-sm text-gray-300 mt-1">
            {loading
              ? "Loading…"
              : profile
              ? `Steps today: ${profile.stepsToday ?? "—"} • Sleep: ${profile.sleepHours ?? "—"}h • Water: ${profile.waterLitres ?? "—"}L`
              : "No stats yet — click Edit to add your health & profile data."}
          </p>
        </div>

        {/* NOTE: profile/menu moved to layout ProfileMenu component */}
      </div>

      <div className="max-w-3xl mx-auto">
        {active === "personal" && <SelfTab profile={profile} />}

        {active === "social" && (
          <>
            <SocialTab profile={profile} />
            <div className="mt-6">
              <h4 className="text-sm text-gray-300 mb-3">Find people</h4>
              <UserSearch />
            </div>
          </>
        )}

        {active === "learn" && <LearningTab />}

        {active === "earn" && <EarningTab />}
      </div>
    </>
  );
}
