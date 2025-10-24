// components/LayerNav.tsx
"use client";

import React, { useState } from "react";
import { Menu, Plus, Globe, Users, Layers, Map, Compass } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

type Layer = {
  id: string; // string to support temp client-only ids
  label: string; // English label (canonical)
  hint?: string;
  icon?: "self" | "state" | "nation" | "earth" | "universe" | "custom";
  tabs?: { id: string; label: string }[];
  isDefault?: boolean;
};

export default function LayerNav({
  layers,
  activeLayerId,
  onSelect,
  onAdd,
}: {
  layers: Layer[];
  activeLayerId?: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // icon resolver
  function IconFor(layer: Layer) {
    const size = 16;
    switch (layer.icon) {
      case "state":
        return <Map size={size} />;
      case "nation":
        return <Globe size={size} />;
      case "earth":
        return <Layers size={size} />;
      case "universe":
        return <Compass size={size} />;
      case "custom":
        return <Globe size={size} />;
      default:
        return <Users size={size} />;
    }
  }

  // limit to 9 slots (pad with empties)
  const maxSlots = 9;
  const padded: (Layer | null)[] = Array.from({ length: maxSlots }).map((_, i) => layers[i] ?? null);

  return (
    <nav aria-label="Main layers navigation" className="flex flex-col gap-3">
      {/* mobile hamburger */}
      <div className="flex items-center justify-between md:hidden px-2">
        <button
          aria-label="Open layers"
          className="p-2 rounded-md bg-white/6 hover:bg-white/10"
          onClick={() => setOpen((s) => !s)}
        >
          <Menu size={18} />
        </button>

        <div className="text-sm font-medium">Layers</div>

        <button
          aria-label="Add layer"
          onClick={() => {
            // for now push to same page
            router.push(pathname || "/");
          }}
          className="p-2 rounded-md bg-gradient-to-r from-red-600 to-pink-600 hover:opacity-90 text-white"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* mobile popover */}
      {open && (
        <div className="md:hidden absolute top-12 left-4 right-4 z-50 p-3 bg-black rounded-lg border border-white/6 shadow-lg">
          <div className="flex flex-col gap-2">
            {padded.map((slot, idx) =>
              slot ? (
                <button
                  key={slot.id}
                  onClick={() => {
                    onSelect(slot.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm transition ${
                    activeLayerId === slot.id ? "bg-red-700 text-white" : "hover:bg-white/6"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center">{IconFor(slot)}</div>
                  <div>
                    <div className="font-medium">{slot.label}</div>
                    <div className="text-xs text-gray-400">{slot.hint}</div>
                  </div>
                </button>
              ) : (
                <div
                  key={`empty-${idx}`}
                  className="w-full text-left px-3 py-2 rounded-md flex items-center gap-3 text-sm opacity-40"
                >
                  <div className="w-8 h-8 rounded-full bg-white/3" />
                  <div>
                    <div className="font-medium">Empty</div>
                    <div className="text-xs text-gray-400">Add a custom layer</div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* desktop full list */}
      <div className="hidden md:flex md:flex-col gap-2">
        {padded.map((slot, idx) =>
          slot ? (
            <button
              key={slot.id}
              onClick={() => onSelect(slot.id)}
              aria-current={activeLayerId === slot.id ? "page" : undefined}
              className={`w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 transition ${
                activeLayerId === slot.id ? "bg-red-700 text-white shadow" : "hover:bg-white/6"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-white/6 flex items-center justify-center">
                {IconFor(slot)}
              </div>
              <div className="flex-1">
                <div className="font-medium leading-tight text-sm">{slot.label}</div>
                <div className="text-xs text-gray-400">{slot.hint}</div>
              </div>
            </button>
          ) : (
            <div
              key={`empty-${idx}`}
              className="w-full text-left px-3 py-3 rounded-xl flex items-center gap-3 opacity-40 bg-white/3"
            >
              <div className="w-10 h-10 rounded-full bg-white/6" />
              <div>
                <div className="font-medium text-sm">Empty slot</div>
                <div className="text-xs text-gray-400">You can add a layer (+)</div>
              </div>
            </div>
          )
        )}

        {/* Add button (always visible, separate) */}
        <div className="pt-4">
          <button
            onClick={onAdd}
            aria-label="Add layer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 text-white"
            title="Add a new layer (opens add screen)"
          >
            <Plus size={16} />
            <span className="text-sm font-medium">Add Layer</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
