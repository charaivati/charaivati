"use client";
import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useLayerContext } from "@/components/LayerContext";
import UserSearch from "@/components/UserSearch";

const SelfTab = dynamic(() => import("./tabs/SelfTab"), { ssr: false });
const SocialTab = dynamic(() => import("./tabs/SocialTab"), { ssr: false });
const LearningTab = dynamic(() => import("./tabs/LearningTab"), { ssr: false });
const EarningTab = dynamic(() => import("./tabs/EarningTab"), { ssr: false });

type ActiveKind = "personal" | "social" | "learn" | "earn";

function SelfPageContent() {
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab") ?? "";
  const ctx = useLayerContext();
  const layerId = "layer-self";
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveKind>("personal");

  function normalizeTabValue(raw: string): ActiveKind {
    const s = String(raw || "").toLowerCase().trim();
    if (!s || s.includes("personal")) return "personal";
    if (s.includes("social")) return "social";
    if (s.includes("learn")) return "learn";
    if (s.includes("earn")) return "earn";
    return "personal";
  }

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

  return (
    <>
      <div className="flex items-start justify-between mb-6">
        <div className="text-left">
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

export default function SelfPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading your profile…</div>}>
      <SelfPageContent />
    </Suspense>
  );
}
