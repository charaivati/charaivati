// app/(with-nav)/self/page.tsx
"use client";

import React, { Suspense, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useProfile } from "@/lib/ProfileContext";
import { useLayerContext } from "@/components/LayerContext";
import { SelfSkillsProvider } from "@/lib/SelfSkillsContext";

type ProfileProp = { profile?: any };
type TimeProp    = { goalId?: string; view?: string; focusId?: string };
type ActiveKind  = "personal" | "social" | "learn" | "earn" | "time";

const SelfTab = dynamic(
  () => import("./tabs/SelfTab").then((m) => m.default),
  { ssr: false }
) as React.ComponentType<ProfileProp>;

const SocialTab = dynamic(
  () => import("./tabs/SocialTab").then((m) => m.default),
  { ssr: false }
) as React.ComponentType<ProfileProp>;

const LearningTab = dynamic(
  () => import("./tabs/LearningTab").then((m) => m.default),
  { ssr: false }
) as React.ComponentType<Record<string, never>>;

const EarningTab = dynamic(
  () => import("./tabs/EarningTab").then((m) => m.default),
  { ssr: false }
) as React.ComponentType<Record<string, never>>;

const TimeTab = dynamic(
  () => import("./tabs/TimeTab").then((m) => m.default),
  { ssr: false }
) as React.ComponentType<TimeProp>;

function tabIdToKind(tabId: string): ActiveKind {
  const s = tabId.toLowerCase();
  if (s.includes("earn"))   return "earn";
  if (s.includes("learn"))  return "learn";
  if (s.includes("social")) return "social";
  if (s.includes("time"))   return "time";
  return "personal";
}

function normalizeTabValue(raw: string): ActiveKind {
  const s = String(raw || "").toLowerCase().trim();
  if (s.includes("social")) return "social";
  if (s.includes("learn"))  return "learn";
  if (s.includes("earn"))   return "earn";
  if (s.includes("time"))   return "time";
  return "personal";
}

function SelfPageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const ctx          = useLayerContext();
  const tabParamRaw  = searchParams?.get("tab") ?? "";
  const goalId       = searchParams?.get("goalId") ?? undefined;
  const view         = searchParams?.get("view")   ?? undefined;
  const focusId      = searchParams?.get("focus")  ?? undefined;

  // If URL has ?tab= use it; otherwise fall back to what LayerContext persisted
  const active = useMemo<ActiveKind>(() => {
    if (tabParamRaw) return normalizeTabValue(tabParamRaw);
    const savedTabId = ctx.activeTabs["layer-self"] ?? "";
    return tabIdToKind(savedTabId);
  }, [tabParamRaw, ctx.activeTabs]);

  // Sync URL silently so bookmarks / sharing reflects the right tab
  useEffect(() => {
    if (tabParamRaw || active === "personal") return;
    router.replace(`/self?tab=${encodeURIComponent(active)}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const { profile } = useProfile();

  return (
    <SelfSkillsProvider>
      <div className="max-w-3xl mx-auto">
        {/* SelfTab is always mounted so its state survives tab switches */}
        <div suppressHydrationWarning style={{ display: active === "personal" ? undefined : "none" }}>
          <SelfTab profile={profile} />
        </div>
        {active === "social" && <SocialTab profile={profile} />}
        {active === "learn"  && <LearningTab />}
        {active === "earn"   && <EarningTab />}
        {active === "time"   && <TimeTab goalId={goalId} view={view} focusId={focusId} />}
      </div>
    </SelfSkillsProvider>
  );
}

function SelfPageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse space-y-4 pt-3">
      <div className="h-7 w-44 rounded-lg bg-white/10" />
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="h-4 w-2/5 rounded bg-white/10" />
        <div className="h-3 w-3/5 rounded bg-white/5" />
        <div className="h-32 rounded-xl bg-white/5" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex-none" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/2 rounded bg-white/10" />
            <div className="h-3 w-1/3 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SelfPage() {
  return (
    <Suspense fallback={<SelfPageSkeleton />}>
      <SelfPageContent />
    </Suspense>
  );
}
