// components/ResponsiveWorldNav.tsx
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

/**
 * ResponsiveWorldNav
 * - Preserves your desktop sidebar behavior (vertical list with hints)
 * - For compact (mobile) horizontal mode it:
 *    • keeps items horizontally scrollable
 *    • centers the selected item and then nudges left so the next item to the right is partially visible
 *    • smooth-scrolls
 */
export default function ResponsiveWorldNav({ activeId, onSelect, compact = false }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // When activeId changes, center + nudge on mobile compact nav
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

    // center selected element
    let targetScroll = elLeft - containerWidth / 2 + elWidth / 2;

    // nudge left to show next tab on right (adjust to taste)
    const nudge = Math.min(56, Math.floor(elWidth / 2) + 12);
    targetScroll = Math.max(0, targetScroll - nudge);

    // bound targetScroll within scrollable range
    const maxScroll = Math.max(0, container.scrollWidth - containerWidth);
    if (targetScroll > maxScroll) targetScroll = maxScroll;
    if (targetScroll < 0) targetScroll = 0;

    // animate
    container.scrollTo({ left: targetScroll, behavior: "smooth" });
  }, [activeId, compact]);

  // click handler
  function handleSelect(id: string) {
    onSelect?.(id);
    const btn = itemRefs.current[id];
    btn?.focus();
  }

  // Mobile compact horizontal scrolling UI
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
                ref={(el) => { itemRefs.current[item.id] = el; }} // <-- fixed: block body, no return
                onClick={() => handleSelect(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all focus:outline-none ${
                  isActive ? "bg-white/15 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
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

  // Desktop sidebar - vertical list (unchanged)
  return (
    <nav className="space-y-1" aria-label="World navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            onClick={() => handleSelect(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group focus:outline-none ${
              isActive
                ? "bg-white/10 text-white shadow-lg shadow-white/5"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
            aria-current={isActive ? "page" : undefined}
            type="button"
          >
            <span className={`transition-colors ${isActive ? "text-white" : "text-gray-500 group-hover:text-gray-300"}`}>
              {item.icon}
            </span>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">{item.label}</div>
              {item.hint && <div className={`text-xs ${isActive ? "text-gray-400" : "text-gray-600"}`}>{item.hint}</div>}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
