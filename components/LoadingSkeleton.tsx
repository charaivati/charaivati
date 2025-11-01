// components/LoadingSkeleton.tsx
"use client";

import React from "react";

export function NavSkeleton() {
  return (
    <div className="space-y-1 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-4 h-4 bg-white/10 rounded" />
          <div className="flex-1">
            <div className="h-4 bg-white/10 rounded w-20 mb-1" />
            <div className="h-3 bg-white/5 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TabsSkeleton() {
  return (
    <div className="flex items-center gap-2 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-9 w-24 bg-white/10 rounded-lg" />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-2 animate-pulse">
      <div className="w-8 h-8 bg-white/10 rounded-full" />
      <div className="hidden lg:block">
        <div className="h-4 w-24 bg-white/10 rounded mb-1" />
        <div className="h-3 w-32 bg-white/5 rounded" />
      </div>
    </div>
  );
}