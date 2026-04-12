"use client";
// components/earth/MicroActionRow.tsx — horizontal scrollable action cards

import React, { useState } from "react";
import { MICRO_ACTIONS, SIGNAL_COLORS, SIGNAL_PILL_TEXT } from "./earthData";
import type { MicroAction } from "./earthData";

function ActionCard({
  action,
  done,
  onToggle,
}: {
  action: MicroAction;
  done: boolean;
  onToggle: () => void;
}) {
  const pillColor = SIGNAL_COLORS[action.signal];
  const pillText = SIGNAL_PILL_TEXT[action.signal];

  return (
    <div
      className={`flex-shrink-0 w-[220px] rounded-xl border p-4 flex flex-col gap-2 transition-all duration-200 scroll-snap-align-start
        ${done
          ? "border-emerald-800/60 bg-emerald-950/40"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
        }`}
      style={{ scrollSnapAlign: "start" }}
    >
      {/* Emoji + done check */}
      <div className="flex items-center justify-between">
        <span className="text-2xl leading-none">{action.emoji}</span>
        {done && <span className="text-emerald-400 text-sm font-semibold">✓</span>}
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-white leading-snug">{action.title}</p>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed flex-1">{action.description}</p>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full text-white ${pillColor}`}>
          {pillText}
        </span>
        <span className="text-[10px] text-gray-600">{action.globalCount} completed</span>
      </div>

      {/* Done toggle */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-xs font-medium py-1.5 rounded-lg border transition-all duration-200
          ${done
            ? "border-emerald-700 bg-emerald-900/40 text-emerald-400"
            : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white"
          }`}
      >
        {done ? "Done ✓" : "Mark done"}
      </button>
    </div>
  );
}

export default function MicroActionRow() {
  const [done, setDone] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">Take Action</h3>
        <p className="text-xs text-gray-500 mt-0.5">Small steps, planetary impact</p>
      </div>

      <div
        className="flex gap-3 overflow-x-auto pb-2"
        style={{ scrollSnapType: "x mandatory", scrollbarWidth: "none" }}
      >
        <style>{`.micro-scroll::-webkit-scrollbar { display: none; }`}</style>
        {MICRO_ACTIONS.map((action) => (
          <ActionCard
            key={action.id}
            action={action}
            done={done.has(action.id)}
            onToggle={() => toggle(action.id)}
          />
        ))}
      </div>
    </div>
  );
}
