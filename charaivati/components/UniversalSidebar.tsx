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
  X,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Menu,
  AlertCircle,
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

export default function UniversalSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLanguage();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [customLayers, setCustomLayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLayerModal, setShowAddLayerModal] = useState(false);
  const [newLayerType, setNewLayerType] = useState<string | null>(null);
  const [newLayerName, setNewLayerName] = useState("");

  // Determine active layer and page from pathname
  const getActiveIds = () => {
    const parts = pathname?.split("/").filter(Boolean) || [];
    const layerSlug = parts[0] || "self";
    const pageSlug = parts[1] || null;
    return { layerSlug, pageSlug };
  };

  const { layerSlug: activeLayerSlug, pageSlug: activePageSlug } = getActiveIds();

  // Mobile detection
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

  // Load layers and tabs
  useEffect(() => {
    loadLayers();
  }, [locale]);

  async function loadLayers() {
    try {
      setLoading(true);
      const res = await fetch(`/api/levels?locale=${locale || "en"}`, {
        credentials: "include",
      });
      const json = await res.json();

      if (json.ok && Array.isArray(json.data)) {
        // Map to Layer structure with icons
        const mapped: Layer[] = json.data.map((level: any) => ({
          id: level.id,
          key: level.key,
          name: level.name,
          order: level.order,
          tabs: level.tabs || [],
          icon: LAYER_ICONS[level.key] || Home,
          isDefault: true,
          canAddMore: ["state", "society",
