// components/UniversalSidebar.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import {
  Home,
  Users,
  Building2,
  Globe,
  Sparkles,
  Plus,
  Menu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Page {
  id: string;
  slug: string;
  title: string;
  description?: string;
  visible: boolean;
  position: number;
}

interface Layer {
  id: number;
  key: string;
  name: string;
  order: number;
  tabs: Page[];
  icon?: any;
  isDefault: boolean;
  canAddMore: boolean;
  customName?: string;
}

const LAYER_ICONS: Record<string, any> = {
  personal: Home,
  self: Home,
  state: Users,
  society: Users,
  national: Building2,
  nation: Building2,
  global: Globe,
  earth: Globe,
  universal: Sparkles,
};

export default function UniversalSidebar(): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLanguage();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    loadLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  async function loadLayers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/levels?locale=${locale || "en"}`);
      const json = await res.json();
      if (json?.ok && Array.isArray(json.data)) {
        const mapped: Layer[] = json.data.map((level: any) => ({
          id: level.id,
          key: level.key,
          name: level.name,
          order: level.order,
          tabs: Array.isArray(level.tabs) ? level.tabs : [],
          icon: LAYER_ICONS[level.key] || Home,
          isDefault: !!level.isDefault,
          canAddMore: !!level.canAddMore,
        }));
        setLayers(mapped);
      } else {
        setLayers([]);
      }
    } catch (e) {
      console.warn("loadLayers failed", e);
      setLayers([]);
    } finally {
      setLoading(false);
    }
  }

  const parts = pathname?.split("/").filter(Boolean) || [];
  const activeLayerSlug = parts[0] || "self";
  const activePageSlug = parts[1] || "";

  function openLayer(layerKey: string) {
    router.push(`/${layerKey}`);
    setIsSidebarOpen(false);
  }

  return (
    <aside className={`w-72 ${isSidebarOpen ? "block" : "hidden"} md:block bg-black/80 p-4`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Menu />
          <span className="font-semibold">Charaivati</span>
        </div>
        <button
          aria-label="Toggle sidebar"
          onClick={() => setIsSidebarOpen((s) => !s)}
          className="p-1 rounded hover:bg-white/5"
        >
          {isSidebarOpen ? <ChevronLeft /> : <ChevronRight />}
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : (
          layers.map((layer) => {
            const Icon = layer.icon || Home;
            const isActive = activeLayerSlug === layer.key;
            return (
              <div key={layer.id} className={`rounded-md p-2 ${isActive ? "bg-white/6" : "hover:bg-white/3"}`}>
                <button
                  onClick={() => openLayer(layer.key)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <Icon />
                  <div className="flex-1">
                    <div className="font-medium">{layer.name}</div>
                    <div className="text-xs text-gray-400">{layer.tabs?.length ?? 0} pages</div>
                  </div>
                  {layer.canAddMore && <button className="ml-2 bg-green-600 text-white px-2 py-1 rounded"><Plus size={14} /></button>}
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
