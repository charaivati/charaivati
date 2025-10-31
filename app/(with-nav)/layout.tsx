// app/(with-nav)/layout.tsx
"use client";

import React, { useEffect, useState, Suspense, useRef } from "react";
import ResponsiveWorldNav from "@/components/ResponsiveWorldNav";
import { usePathname, useRouter } from "next/navigation";
import HeaderTabs from "@/components/HeaderTabs";
import { LayerProvider } from "@/components/LayerContext";
import ProfileMenu from "@/components/ProfileMenu";

export default function WithNavLayout({ children }: { children: React.ReactNode }) {
  return (
    <LayerProvider>
      <WithNavLayoutInner>{children}</WithNavLayoutInner>
    </LayerProvider>
  );
}

function WithNavLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [showBottomNav, setShowBottomNav] = useState(true);
  const lastScrollY = useRef(0);

  const activeId = React.useMemo(() => {
    if (pathname.startsWith("/user") || pathname.startsWith("/self")) return "layer-self";
    if (pathname.startsWith("/society") || pathname.startsWith("/local")) return "layer-society-home";
    if (pathname.startsWith("/nation") || pathname.startsWith("/your_country")) return "layer-nation-birth";
    if (pathname.startsWith("/earth")) return "layer-earth";
    if (pathname.startsWith("/universe")) return "layer-universe";
    return "layer-self";
  }, [pathname]);

  // Handle scroll to show/hide bottom nav (MOBILE ONLY)
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (window.innerWidth >= 768) return; // Skip on desktop

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          // Scrolling down - hide
          if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
            setShowBottomNav(false);
          }
          // Scrolling up - show
          else if (currentScrollY < lastScrollY.current) {
            setShowBottomNav(true);
          }

          // Always show when near top
          if (currentScrollY < 50) {
            setShowBottomNav(true);
          }

          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function navigateToLayerById(id: string | undefined | null) {
    const layerId = String(id ?? "").trim();
    switch (layerId) {
      case "layer-self":
        router.push("/self");
        break;
      case "layer-society-home":
      case "layer-society-work":
        router.push("/society");
        break;
      case "layer-nation-birth":
      case "layer-nation-work":
        router.push("/nation");
        break;
      case "layer-earth":
        router.push("/earth");
        break;
      case "layer-universe":
        router.push("/universe");
        break;
      default:
        router.push("/self");
    }
  }

  function mapNavIdToLayerId(id: string | undefined | null): string {
    const raw = String(id ?? "").trim().toLowerCase();
    if (!raw) return "layer-self";
    if (raw.includes("you") || raw.includes("self")) return "layer-self";
    if (raw.includes("society") || raw.includes("state")) return "layer-society-home";
    if (raw.includes("nation") || raw.includes("country")) return "layer-nation-birth";
    if (raw.includes("earth") || raw.includes("world")) return "layer-earth";
    if (raw.includes("uni") || raw.includes("universe")) return "layer-universe";
    if (raw.startsWith("layer-")) return raw;
    return "layer-self";
  }

  // Client-side profile fetch
  const [profile, setProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { credentials: "include" });
        if (!alive) return;
        if (!res.ok) {
          setProfile(null);
        } else {
          const data = await res.json().catch(() => null);
          if (data?.ok) setProfile(data.profile ?? null);
        }
      } catch (err) {
        console.warn("[WithNavLayout] failed to load profile:", err);
        setProfile(null);
      } finally {
        if (alive) setProfileLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    } finally {
      if (typeof window !== "undefined") {
        const keysToClear = ["app.language", "charaivati.lang", "language", "preferredLanguage"];
        keysToClear.forEach((k) => localStorage.removeItem(k));
        window.location.href = "/";
      }
    }
  }

  return (
    <>
      {/* ========== MOBILE LAYOUT ========== */}
      <div className="md:hidden min-h-screen bg-black text-white pb-20">
        {/* Top Bar - Sub-tabs (Fixed, Centered) */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-lg border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            {/* Centered tabs container */}
            <div className="flex-1 flex justify-center overflow-x-auto no-scrollbar">
              <Suspense
                fallback={
                  <div className="h-10 flex items-center">
                    <div className="text-xs text-gray-400">Loading...</div>
                  </div>
                }
              >
                <HeaderTabs onNavigate={navigateToLayerById} />
              </Suspense>
            </div>

            {/* Profile Menu */}
            <div className="flex-shrink-0">
              <ProfileMenu profile={profile} onLogout={handleLogout} compact />
            </div>
          </div>
        </div>

        {/* Spacer for fixed top nav */}
        <div className="h-16" />

        {/* Main Content */}
        <main className="px-4 py-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>

        {/* Bottom Bar - Layer Navigation (Hides on scroll) */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-lg border-t border-white/10 transition-transform duration-300 ${
            showBottomNav ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="px-4 py-3">
            <ResponsiveWorldNav
              activeId={activeId}
              onSelect={(id) => {
                const canonical = mapNavIdToLayerId(id);
                navigateToLayerById(canonical);
              }}
              compact={true}
            />
          </div>
        </div>
      </div>

      {/* ========== DESKTOP LAYOUT ========== */}
      <div className="hidden md:flex md:flex-col min-h-screen bg-black text-white">
        {/* Top Bar - Sub-tabs + Profile (Fixed) */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-lg border-b border-white/10">
          <div className="flex items-center justify-between px-6 py-3 gap-4">
            {/* Logo */}
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Charaivati
              </h1>
            </div>

            {/* Centered Sub-tabs */}
            <div className="flex-1 flex justify-center">
              <Suspense
                fallback={
                  <div className="h-10 flex items-center">
                    <div className="text-sm text-gray-400">Loading...</div>
                  </div>
                }
              >
                <HeaderTabs onNavigate={navigateToLayerById} />
              </Suspense>
            </div>

            {/* Profile Menu */}
            <div className="flex-shrink-0">
              <ProfileMenu profile={profile} onLogout={handleLogout} compact />
            </div>
          </div>
        </div>

        {/* Spacer for fixed top nav */}
        <div className="h-16" />

        {/* Content area with sidebar */}
        <div className="flex flex-1">
          {/* Left Sidebar - Layer Navigation */}
          <aside className="fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-black border-r border-white/10 flex flex-col overflow-y-auto">
            <div className="p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Navigate
              </div>
              <ResponsiveWorldNav
                activeId={activeId}
                onSelect={(id) => {
                  const canonical = mapNavIdToLayerId(id);
                  navigateToLayerById(canonical);
                }}
                compact={false}
              />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 ml-64">
            <div className="p-6">
              <div className="max-w-6xl mx-auto">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}