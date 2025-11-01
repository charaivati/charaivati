// components/ResponsiveWorldNav.tsx
"use client";

import React from "react";
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
  // Mobile compact - horizontal scrolling
  if (compact) {
    return (
      <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                isActive
                  ? "bg-white/15 text-white shadow-lg"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className={isActive ? "text-white" : "text-gray-500"}>{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    );
  }

  // Desktop sidebar - vertical list
  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
              isActive
                ? "bg-white/10 text-white shadow-lg shadow-white/5"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span
              className={`transition-colors ${
                isActive ? "text-white" : "text-gray-500 group-hover:text-gray-300"
              }`}
            >
              {item.icon}
            </span>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">{item.label}</div>
              {item.hint && (
                <div className={`text-xs transition-colors ${isActive ? "text-gray-400" : "text-gray-600"}`}>
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