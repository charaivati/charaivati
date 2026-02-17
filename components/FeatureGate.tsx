// components/FeatureGate.tsx
"use client";
import React, { useEffect, useState } from "react";

export type FeatureGateProps = {
  flagKey: string;
  flags: Record<string, { enabled: boolean; meta?: any }> | null | undefined;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
  allowLocalOverride?: boolean;
  showPlaceholder?: boolean;
  placeholderTitle?: string;
  placeholderBody?: string;
};

const LOCAL_OVERRIDE_PREFIX = "charaivati.feature.override:";
export default function FeatureGate({
  flagKey,
  flags,
  fallback,
  children,
  allowLocalOverride = true,
  showPlaceholder = true,
  placeholderTitle = "Under development",
  placeholderBody = "This section is currently under development. You can view the current content locally if you want to inspect it.",
}: FeatureGateProps) {
  const enabled = !!(flags && flags[flagKey] && flags[flagKey].enabled);

  const [localOverride, setLocalOverride] = useState(false);

  // Load stored override
  useEffect(() => {
    try {
      const v = localStorage.getItem(LOCAL_OVERRIDE_PREFIX + flagKey);
      setLocalOverride(v === "1");
    } catch {}
  }, [flagKey]);

  // Toggle functions
  function enableLocalView() {
    try {
      localStorage.setItem(LOCAL_OVERRIDE_PREFIX + flagKey, "1");
      setLocalOverride(true);
    } catch {}
  }
  function clearLocalView() {
    try {
      localStorage.removeItem(LOCAL_OVERRIDE_PREFIX + flagKey);
      setLocalOverride(false);
    } catch {}
  }

  const isVisible = enabled || localOverride;

  if (isVisible) {
    return (
      <div className="relative">
        {children}
      </div>
    );
  }

  if (fallback) return <>{fallback}</>;
  if (!showPlaceholder) return null;

  return (
    <div className="p-6 rounded-md bg-white/6 border border-white/6 text-gray-200">
      <div className="max-w-2xl mx-auto text-center">
        <div className="text-lg font-semibold mb-2">{placeholderTitle}</div>
        <div className="text-sm text-gray-300 mb-4">{placeholderBody}</div>

        <div className="flex justify-center gap-3">
          {allowLocalOverride ? (
            <button
              className="px-3 py-1 rounded bg-blue-700 text-sm hover:bg-blue-600"
              onClick={enableLocalView}
            >
              Show current content
            </button>
          ) : (
            <button className="px-3 py-1 rounded bg-gray-700 text-sm">Notify me</button>
          )}
          <a
            href="/help#features"
            className="px-3 py-1 rounded bg-gray-700 text-sm hover:bg-gray-600"
          >
            Learn more
          </a>
        </div>

      </div>
    </div>
  );
}
