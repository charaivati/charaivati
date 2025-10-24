// app/(with-nav)/layout.tsx
"use client";

import React from "react";
import ResponsiveWorldNav from "@/components/ResponsiveWorldNav";
import { usePathname, useRouter } from "next/navigation";
import NavControls from "@/components/NavControls";
import HeaderTabs from "@/components/HeaderTabs";
import { LayerProvider } from "@/components/LayerContext";

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

  // Detect active layer for side navigation
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
    console.debug("[navigateToLayerById] layerId:", layerId);

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
        console.warn("[navigateToLayerById] unknown layer, defaulting to /self:", layerId);
        router.push("/self");
    }
  }

  function mapNavIdToLayerId(id: string | undefined | null): string {
    const raw = String(id ?? "").trim().toLowerCase();
    console.debug("[mapNavIdToLayerId] raw id:", id, "-> normalized:", raw);

    if (!raw) return "layer-self";

    if (raw.includes("you") || raw.includes("self")) return "layer-self";
    if (raw.includes("society") || raw.includes("state")) return "layer-society-home";
    if (raw.includes("nation") || raw.includes("your_country") || raw.includes("yourcountry") || raw.includes("country")) {
      return "layer-nation-birth";
    }
    if (raw.includes("earth") || raw.includes("world")) return "layer-earth";
    if (raw.includes("uni") || raw.includes("universe")) return "layer-universe";

    if (raw.startsWith("layer-")) return raw;

    console.warn("[mapNavIdToLayerId] unknown id, defaulting to layer-self:", id);
    return "layer-self";
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Fixed top controls (profile / language etc.) */}
      <div className="fixed top-3 right-4 z-50">
        <NavControls />
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
          {/* Header with Tabs - Sticky */}
          <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/10">
            <div className="w-full py-3">
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

                {/* Dynamic Tabs for current layer - Takes full width */}
                <div className="flex-1 min-w-0">
                  <HeaderTabs onNavigate={navigateToLayerById} />
                </div>
              </div>
            </div>
          </div>

          {/* Actual page content */}
          <div className="w-full">
            <div className="max-w-6xl mx-auto px-4 py-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}