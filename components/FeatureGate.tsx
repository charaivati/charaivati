// components/FeatureGate.tsx
"use client";
import React, { useEffect, useState } from "react";

export type FeatureGateProps = {
  flagKey: string;
  flags: Record<string, { enabled: boolean; meta?: any }> | null | undefined;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
  // if true, allow users to reveal hidden content locally with a button
  allowLocalOverride?: boolean;
  showPlaceholder?: boolean;
  // optional message for placeholder
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
  // compute canonical enabled state from flags map
  const enabled = !!(flags && flags[flagKey] && flags[flagKey].enabled);

  // local override state persisted in localStorage per-flag
  const [localOverride, setLocalOverride] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_OVERRIDE_PREFIX + flagKey);
      if (raw === "1") setLocalOverride(true);
      else setLocalOverride(false);
    } catch (e) {
      setLocalOverride(false);
    }
  }, [flagKey]);

  // if enabled by server or locally overridden, render children
  const isVisible = enabled || !!localOverride;

  // If visible, render children plus an optional small banner to indicate local override
  if (isVisible) {
    return (
      <>
        {/* If the flag is NOT enabled but user overrode locally, show a small dismissible notice */}
        {!enabled && localOverride && (
          <div className="mb-4 p-3 rounded bg-yellow-900/30 border border-yellow-900 text-yellow-200">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                You are viewing content that is currently hidden by the site. This is a local override only.
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs px-3 py-1 rounded bg-gray-700"
                  onClick={() => {
                    // hide content (clear override)
                    try {
                      localStorage.removeItem(LOCAL_OVERRIDE_PREFIX + flagKey);
                    } catch {}
                    setLocalOverride(false);
                  }}
                >
                  Hide content
                </button>
                <span className="text-xs opacity-70">Local view</span>
              </div>
            </div>
          </div>
        )}

        {children}
      </>
    );
  }

  // If a custom fallback is provided, show it
  if (fallback) return <>{fallback}</>;

  // If placeholders are disabled, render nothing
  if (!showPlaceholder) return null;

  // Default placeholder + "Show current content" CTA
  return (
    <div className="p-6 rounded-md bg-white/6 border border-white/6 text-gray-200">
      <div className="max-w-2xl mx-auto text-center">
        <div className="text-lg font-semibold mb-2">{placeholderTitle}</div>
        <div className="text-sm text-gray-300 mb-4">{placeholderBody}</div>

        <div className="flex justify-center gap-3">
          {allowLocalOverride ? (
            <button
              className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 text-sm"
              onClick={() => {
                try {
                  localStorage.setItem(LOCAL_OVERRIDE_PREFIX + flagKey, "1");
                } catch {}
                // set state so UI updates immediately
                setLocalOverride(true);
              }}
            >
              Show current content
            </button>
          ) : (
            <button
              className="px-3 py-1 rounded bg-gray-700 text-sm"
              onClick={() => {
                // fallback behaviour — no override allowed
                try {
                  window.location.href = "/contact";
                } catch {}
              }}
            >
              Notify me
            </button>
          )}

          <button
            className="px-3 py-1 rounded bg-gray-700 text-sm"
            onClick={() => {
              try {
                // small "learn more" or open help — you may change
                window.location.href = "/help#features";
              } catch {}
            }}
          >
            Learn more
          </button>
        </div>

        <div className="text-xs text-gray-400 mt-3">
          Note: this is a local override stored in your browser. Other users won't see this content unless the feature is enabled globally.
        </div>
      </div>
    </div>
  );
}
