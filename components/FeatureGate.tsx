// components/FeatureGate.tsx
"use client";
import React, { useEffect, useState, useRef } from "react";

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
const AUTO_HIDE_MS = 100_000; // 100 seconds

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
  const [timerVisible, setTimerVisible] = useState(false);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  // Load stored override
  useEffect(() => {
    try {
      const v = localStorage.getItem(LOCAL_OVERRIDE_PREFIX + flagKey);
      setLocalOverride(v === "1");
    } catch {}
  }, [flagKey]);

  // --- Inactivity tracking logic ---
  useEffect(() => {
    if (!localOverride) return;

    let timer: NodeJS.Timeout | null = null;
    let lastActivity = Date.now();

    const resetTimer = () => {
      lastActivity = Date.now();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const now = Date.now();
        if (now - lastActivity >= AUTO_HIDE_MS) {
          clearLocalView();
        }
      }, AUTO_HIDE_MS);
    };

    const handleActivity = () => resetTimer();

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("scroll", handleActivity);
    resetTimer();
    setTimerVisible(true);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      setTimerVisible(false);
    };
  }, [localOverride, flagKey]);

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
        {!enabled && localOverride && (
          <div className="mb-4 p-3 rounded bg-yellow-900/30 border border-yellow-900 text-yellow-200">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm">
                Viewing via <strong>local override</strong> — will auto-hide after{" "}
                <span className="font-semibold text-yellow-100">100s</span> of inactivity.
              </div>
              <button
                className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
                onClick={clearLocalView}
              >
                Hide now
              </button>
            </div>
          </div>
        )}
        {children}
        {timerVisible && localOverride && (
          <div className="absolute bottom-2 right-2 text-xs text-yellow-400 opacity-70">
            (Auto-hide timer active)
          </div>
        )}
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

        <div className="text-xs text-gray-400 mt-3">
          Note: this view hides automatically after inactivity to keep things tidy.
        </div>
      </div>
    </div>
  );
}