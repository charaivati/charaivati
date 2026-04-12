"use client";
// components/earth/CommunitySignalBoard.tsx — anonymous regional activity feed

import React from "react";
import { COMMUNITY_FEED, SIGNAL_DOT_COLORS } from "./earthData";

export default function CommunitySignalBoard() {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">Community Pulse</h3>
        <p className="text-xs text-gray-500 mt-0.5">Recent activity in your region</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {COMMUNITY_FEED.map((item, i) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-4 py-3 ${
              i < COMMUNITY_FEED.length - 1 ? "border-b border-white/5" : ""
            }`}
          >
            {/* Signal dot */}
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${SIGNAL_DOT_COLORS[item.signal]}`}
            />

            {/* Activity text */}
            <p className="text-xs text-gray-300 flex-1 leading-relaxed">{item.text}</p>

            {/* Timestamp */}
            <span className="text-xs text-gray-600 flex-shrink-0 ml-2">{item.timeAgo}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
