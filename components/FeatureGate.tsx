// components/FeatureGate.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

type FlagsMap = Record<string, { enabled: boolean; meta?: any }>;

const OVERRIDE_PREFIX = "feature_override:"; // localStorage key prefix
const INACTIVITY_MS = 10000; // 10s

function readOverride(key: string) {
  try {
    const raw = localStorage.getItem(OVERRIDE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeOverride(key: string, payload: any) {
  try {
    localStorage.setItem(OVERRIDE_PREFIX + key, JSON.stringify(payload));
  } catch {}
}

function clearOverride(key: string) {
  try {
    localStorage.removeItem(OVERRIDE_PREFIX + key);
  } catch {}
}

export default function FeatureGate({
  flagKey,
  flags,
  showPlaceholder = true,
  children,
}: {
  flagKey: string;
  flags: FlagsMap | null;
  showPlaceholder?: boolean;
  children: React.ReactNode;
}) {
  const [localEnabled, setLocalEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const o = readOverride(flagKey);
    return !!o?.enabled;
  });

  // Inactivity timer
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);

  // start/clear inactivity timer
  function startInactivityWatcher() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      // if inactive for INACTIVITY_MS, clear override
      clearOverride(flagKey);
      setLocalEnabled(false);
    }, INACTIVITY_MS);
  }

  function onActivity() {
    lastActivityRef.current = Date.now();
    if (localEnabled) startInactivityWatcher();
  }

  useEffect(() => {
    if (!localEnabled) return;
    // attach activity events to keep override alive while user interacts
    const opts = { passive: true } as AddEventListenerOptions;
    ["mousemove", "keydown", "touchstart", "scroll"].forEach((ev) =>
      window.addEventListener(ev, onActivity, opts as any)
    );
    startInactivityWatcher();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      ["mousemove", "keydown", "touchstart", "scroll"].forEach((ev) =>
        window.removeEventListener(ev, onActivity, opts as any)
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localEnabled]);

  // compute effective allowed state:
  const globalEnabled = flags?.[flagKey]?.enabled ?? undefined;
  const effectiveAllowed = globalEnabled === undefined ? true : globalEnabled || localEnabled;

  // show placeholder if not allowed
  if (!effectiveAllowed) {
    if (!showPlaceholder) return null;
    return (
      <div className="max-w-3xl mx-auto my-6 p-6 bg-white/5 rounded-lg border border-white/10">
        <h3 className="text-lg font-semibold mb-2">Under development</h3>
        <p className="text-sm text-gray-300 mb-4">
          This section is currently under development. We plan to launch it soon.
        </p>
        <div className="flex gap-3">
          <button
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
            onClick={() => {
              // set a local override for this user
              writeOverride(flagKey, { enabled: true, ts: Date.now() });
              setLocalEnabled(true);
              // start the inactivity watcher
              startInactivityWatcher();
            }}
          >
            Show current content
          </button>
          <a
            href="/help#features"
            className="px-4 py-2 rounded-lg bg-transparent border border-white/10 hover:bg-white/5 transition-colors"
          >
            Learn more
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Visible for you temporarily. Will hide after 10 seconds of inactivity.
        </p>
      </div>
    );
  }

  // allowed — render children
  return <>{children}</>;
}