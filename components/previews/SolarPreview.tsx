// components/SolarPreview.tsx
import React from "react";

export default function SolarPreview(): React.ReactElement {
  return (
    <svg viewBox="0 0 400 400" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sunGrad">
          <stop offset="0%" stopColor="#fff59d" />
          <stop offset="60%" stopColor="#ffb74d" />
          <stop offset="100%" stopColor="#ff8a65" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="30" fill="url(#sunGrad)" />
      {[1, 2, 3, 4, 5].map((i: number) => (
        <circle
          key={i}
          cx="200"
          cy="200"
          r={50 + i * 30}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.8"
          fill="none"
        />
      ))}
      <circle cx="200" cy={120} r="6" fill="#9ec5ff" />
      <circle cx="320" cy="200" r="8" fill="#ffd97a" />
      <circle cx="60" cy="210" r="10" fill="#9fbf9f" />
    </svg>
  );
}
