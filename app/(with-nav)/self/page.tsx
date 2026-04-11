// app/(with-nav)/self/page.tsx
"use client";

import React, { Suspense, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { useProfile } from "@/lib/ProfileContext";
import { useLayerContext } from "@/components/LayerContext";

type ProfileProp = { profile?: any };
type ActiveKind = "personal" | "social" | "learn" | "earn";

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

function tabIdToKind(tabId: string): ActiveKind {
  const s = tabId.toLowerCase();
  if (s.includes("earn"))   return "earn";
  if (s.includes("learn"))  return "learn";
  if (s.includes("social")) return "social";
  return "personal";
}

function normalizeTabValue(raw: string): ActiveKind {
  const s = String(raw || "").toLowerCase().trim();
  if (s.includes("social")) return "social";
  if (s.includes("learn"))  return "learn";
  if (s.includes("earn"))   return "earn";
  return "personal";
}

function SelfPageContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const ctx          = useLayerContext();
  const tabParamRaw  = searchParams?.get("tab") ?? "";

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
    <div className="max-w-3xl mx-auto">
      {active === "personal" && <SelfTab profile={profile} />}
      {active === "social"   && <SocialTab profile={profile} />}
      {active === "learn"    && <LearningTab />}
      {active === "earn"     && <EarningTab />}
    </div>
  );
}

export default function SelfPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading your profile...</div>}>
      <SelfPageContent />
    </Suspense>
  );
}
