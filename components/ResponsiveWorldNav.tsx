//components/ResponsiveWorldNav

"use client";

import React, { useEffect, useRef } from "react";
import { User, Users, Globe2, Earth, Sparkles } from "lucide-react";

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  hint?: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "layer-self", label: "Self", icon: <User className="w-4 h-4" />, hint: "Personal" },
  { id: "layer-society-home", label: "Society", icon: <Users className="w-4 h-4" />, hint: "Local & State" },
  { id: "layer-nation-birth", label: "Nation", icon: <Globe2 className="w-4 h-4" />, hint: "Country" },
  { id: "layer-earth", label: "Earth", icon: <Earth className="w-4 h-4" />, hint: "Global" },
  { id: "layer-universe", label: "Universe", icon: <Sparkles className="w-4 h-4" />, hint: "Beyond" },
];

type Props = {
  activeId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
};

export default function ResponsiveWorldNav({ activeId, onSelect, compact = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!compact) return;
    const container = containerRef.current;
    if (!container) return;
    const activeKey = String(activeId ?? "");
    const el = itemRefs.current[activeKey];
    if (!el) return;
    const containerWidth = container.clientWidth;
    const elLeft = el.offsetLeft;
    const elWidth = el.offsetWidth;
    let targetScroll = elLeft - containerWidth / 2 + elWidth / 2;
    const nudge = Math.min(56, Math.floor(elWidth / 2) + 12);
    targetScroll = Math.max(0, targetScroll - nudge);
    const maxScroll = Math.max(0, container.scrollWidth - containerWidth);
    if (targetScroll > maxScroll) targetScroll = maxScroll;
    if (targetScroll < 0) targetScroll = 0;
    container.scrollTo({ left: targetScroll, behavior: "smooth" });
  }, [activeId, compact]);

  function handleSelect(id: string) {
    onSelect?.(id);
    const btn = itemRefs.current[id];
    btn?.focus();
  }

  if (compact) {
    return (
      <nav
        ref={containerRef}
        className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar px-3 py-2"
        role="navigation"
        aria-label="World navigation (compact)"
      >
        <div className="flex items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                ref={(el) => { itemRefs.current[item.id] = el; }}
                onClick={() => handleSelect(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all focus:outline-none ${
                  isActive ? "bg-white/15 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
                aria-current={isActive ? "page" : undefined}
                type="button"
              >
                <span className={isActive ? "text-white" : "text-gray-500"}>{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="space-y-1" aria-label="World navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            ref={(el) => { itemRefs.current[item.id] = el; }}
            onClick={() => handleSelect(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 transition-all group focus:outline-none text-left
              ${isActive
                ? "bg-black text-white rounded-l-md rounded-r-none -mr-px" // active - no border, no shadow, overlap 1px
                : "text-gray-400 hover:bg-white/5 hover:text-white rounded-md"
              }`}
            aria-current={isActive ? "page" : undefined}
            type="button"
            // inline style fallback to ensure the active background is exactly black if Tailwind isn't building correctly
            style={isActive ? { backgroundColor: "#000", boxShadow: "none", border: "none" } : undefined}
          >
            <span className={`transition-colors ${isActive ? "text-white" : "text-gray-500 group-hover:text-gray-300"}`}>
              {item.icon}
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium">{item.label}</div>
              {item.hint && (
                <div className={`${isActive ? "text-gray-400" : "text-gray-600"} text-xs`}>
                  {item.hint}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
