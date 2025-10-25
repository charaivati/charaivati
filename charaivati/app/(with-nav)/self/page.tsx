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
const SelfAnalyticsDashboard = dynamic(() => import("@/components/SelfAnalyticsDashboard"), { ssr: false });

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

  // menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const avatarButtonRef = useRef<HTMLButtonElement | null>(null);

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

  // Close menu on outside click or Esc
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuOpen) return;
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        avatarButtonRef.current &&
        !avatarButtonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // logout
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      // clear local language keys
      if (typeof window !== "undefined") {
        const keysToClear = ["app.language", "charaivati.lang", "language", "preferredLanguage"];
        keysToClear.forEach((k) => localStorage.removeItem(k));
        // close menu and redirect home
        setMenuOpen(false);
        window.location.href = "/";
      }
    }
  }

  // menu item actions
  function goToAnalytics() {
    setMenuOpen(false);
    router.push("/self/analytics");
  }
  function goToProfile() {
    setMenuOpen(false);
    router.push("/self");
  }

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

        {/* profile avatar + menu */}
        <div className="relative">
          <button
            ref={avatarButtonRef}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((s) => !s)}
            className="flex items-center gap-2 bg-white/6 hover:bg-white/10 text-white px-3 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20"
            title={profile?.name ?? "Account"}
          >
            <img
              src={profile?.avatarUrl ?? "/avatar-placeholder.png"}
              alt="avatar"
              className="w-9 h-9 rounded-full object-cover border border-white/10"
            />
            <span className="hidden sm:inline text-sm">{profile?.name ?? "You"}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              role="menu"
              aria-label="Account menu"
              className="absolute right-0 mt-2 w-44 bg-gray-900 border border-white/6 rounded-md shadow-lg z-50 py-1"
            >
              <button
                role="menuitem"
                onClick={goToProfile}
                className="w-full text-left px-3 py-2 text-sm hover:bg-white/6"
              >
                Profile
              </button>
              <button
                role="menuitem"
                onClick={goToAnalytics}
                className="w-full text-left px-3 py-2 text-sm hover:bg-white/6"
              >
                Analytics
              </button>
              <div className="border-t border-white/6 my-1" />
              <button
                role="menuitem"
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-700/20"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {active === "personal" && (
          <>
            <SelfTab profile={profile} />
            <div className="mt-8">
              <h4 className="text-md font-semibold mb-3">Personal Analytics</h4>
              <div className="rounded-md border bg-gray-900 p-4">
                <SelfAnalyticsDashboard />
              </div>
            </div>
          </>
        )}

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
