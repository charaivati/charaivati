// app/(with-nav)/self/page.tsx
"use client";

import React, { Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useProfile } from "@/lib/ProfileContext";

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

function normalizeTabValue(raw: string): ActiveKind {
  const s = String(raw || "").toLowerCase().trim();
  if (s.includes("social")) return "social";
  if (s.includes("learn"))  return "learn";
  if (s.includes("earn"))   return "earn";
  return "personal";
}

function SelfPageContent() {
  const searchParams  = useSearchParams();
  const tabParamRaw   = searchParams?.get("tab") ?? "";
  const active        = useMemo<ActiveKind>(() => normalizeTabValue(tabParamRaw), [tabParamRaw]);

  // ── Profile comes from server via context — no useEffect, no flash ──
  const { profile } = useProfile();

  return (
    <>
      <div className="max-w-3xl mx-auto">
        {active === "personal" && <SelfTab profile={profile} />}
        {active === "social" && <SocialTab profile={profile} />}
        {active === "learn" && <LearningTab />}
        {active === "earn" && <EarningTab />}
      </div>
    </>
  );
}

export default function SelfPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading your profile...</div>}>
      <SelfPageContent />
    </Suspense>
  );
}