// components/FeatureGate.tsx
"use client";
import React from "react";

export type FeatureGateProps = {
  flagKey: string;
  flags: Record<string, { enabled: boolean; meta?: any }> | null | undefined;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
  // showPlaceholder will render a simple "Under development" card if flag disabled and no fallback provided
  showPlaceholder?: boolean;
};

export default function FeatureGate({
  flagKey,
  flags,
  fallback,
  children,
  showPlaceholder = true,
}: FeatureGateProps) {
  const enabled = !!(flags && flags[flagKey] && flags[flagKey].enabled);

  if (enabled) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  if (!showPlaceholder) return null;

  return (
    <div className="p-6 rounded-md bg-white/6 border border-white/6 text-gray-200">
      <div className="max-w-2xl mx-auto text-center">
        <div className="text-lg font-semibold mb-2">Under development</div>
        <div className="text-sm text-gray-300 mb-4">
          This section is currently under development. We plan to launch it soon.
        </div>
        <div className="flex justify-center gap-3">
          <button
            className="px-3 py-1 rounded bg-gray-700 text-sm"
            onClick={() => {
              try {
                // optional: open contact or notify flow — placeholder
                window.location.href = "/contact";
              } catch {}
            }}
          >
            Notify me
          </button>
        </div>
      </div>
    </div>
  );
}
