// app/(with-nav)/layout.tsx
"use client";

import React, { useEffect, useState, Suspense } from "react";
import ResponsiveWorldNav from "@/components/ResponsiveWorldNav";
import { usePathname, useRouter } from "next/navigation";
import HeaderTabs from "@/components/HeaderTabs";
import { LayerProvider } from "@/components/LayerContext";
import ProfileMenu from "@/components/ProfileMenu";

/**
 * WithNavLayout — client layout wrapping pages with nav/tabs.
 * Top-right: only ProfileMenu (compact) to reduce clutter.
 */

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

  const activeId = React.useMemo(() => {
    if (pathname.startsWith("/user") || pathname.startsWith("/self")) return "layer-self";
    if (pathname.startsWith("/society") || pathname.startsWith("/local")) return "layer-society-home";
    if (pathname.startsWith("/nation") || pathname.startsWith("/your_country")) return "layer-nation-birth";
    if (pathname.startsWith("/earth")) return "layer-earth";
    if (pathname.startsWith("/universe")) return "layer-universe";
    return "layer-self";
  }, [pathname]);

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

  // ---------------------------
  // Client-side profile fetch
  // ---------------------------
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

  // Logout handler (passed to ProfileMenu)
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
    <div className="min-h-screen bg-black text-white">
      {/* Fixed top controls (compact) */}
      <div className="fixed top-3 right-4 z-50 flex items-center gap-2">
        {/* Profile menu receives current profile + logout handler */}
        <ProfileMenu profile={profile} onLogout={handleLogout} compact />
      </div>

      <div className="flex">
        {/* Sidebar Navigation - Desktop Only */}
        <aside className="hidden md:fixed md:top-0 md:left-0 md:h-full md:w-56 lg:w-64 md:flex md:flex-col md:bg-black/40 md:backdrop-blur md:pt-6 md:pb-8 md:overflow-auto md:border-r md:border-white/10">
          <div className="px-4">
            <div className="text-2xl font-extrabold tracking-tight mb-6">Charaivati</div>

            <ResponsiveWorldNav
              activeId={activeId}
              onSelect={(id) => {
                const canonical = mapNavIdToLayerId(id);
                navigateToLayerById(canonical);
              }}
              compact={false}
            />
          </div>

          <div className="mt-auto px-4 pt-4 border-t border-white/10">
            <div className="text-xs text-gray-400">Build: production</div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full md:ml-56 lg:ml-64 transition-all">
          {/* Sticky header — reduced vertical padding for compact look */}
          <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10">
            <div className="w-full py-2">
              <div className="flex items-start gap-4 px-4 md:px-0">
                {/* Mobile world nav dropdown */}
                <div className="md:hidden flex-shrink-0">
                  <ResponsiveWorldNav
                    activeId={activeId}
                    onSelect={(id) => {
                      const canonical = mapNavIdToLayerId(id);
                      navigateToLayerById(canonical);
                    }}
                    compact={true}
                  />
                </div>

                {/* Dynamic Tabs for current layer - Wrapped in Suspense */}
                <div className="flex-1 min-w-0">
                  <Suspense fallback={
                    <div className="h-10 flex items-center">
                      <div className="text-sm text-gray-400">Loading tabs...</div>
                    </div>
                  }>
                    <HeaderTabs onNavigate={navigateToLayerById} />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="w-full">
            <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}