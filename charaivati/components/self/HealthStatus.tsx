"use client";
import React, { useState } from "react";

export default function HealthStatus() {
  const [mood, setMood] = useState(3);
  const [health, setHealth] = useState(3);

  return (
    <div className="rounded-2xl bg-white/5 p-4 text-center">
      <h3 className="font-semibold mb-3">Your wellbeing</h3>

      <div className="flex flex-col items-center gap-4">
        <div>
          <div className="text-gray-400 text-sm">Mood</div>
          <input
            type="range"
            min="1"
            max="5"
            value={mood}
            onChange={(e) => setMood(Number(e.target.value))}
            className="w-40"
          />
          <div className="text-white text-sm mt-1">{mood}/5</div>
        </div>

        <div>
          <div className="text-gray-400 text-sm">Health</div>
          <input
            type="range"
            min="1"
            max="5"
            value={health}
            onChange={(e) => setHealth(Number(e.target.value))}
            className="w-40"
          />
          <div className="text-white text-sm mt-1">{health}/5</div>
        </div>
      </div>
    </div>
  );
}
