"use client";
import React, { useEffect, useState } from "react";
import React from "react";

export type FeatureGateProps = {
  children?: React.ReactNode;
};

const LOCAL_OVERRIDE_PREFIX = "charaivati.feature.override:";

export default function FeatureGate({
  flagKey,
  flags,
  fallback,
  children,
}: FeatureGateProps) {
  const enabled = !!(flags && flags[flagKey] && flags[flagKey].enabled);
  const [localOverride, setLocalOverride] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LOCAL_OVERRIDE_PREFIX + flagKey);
      setLocalOverride(v === "1");
    } catch {}
  }, [flagKey]);

  const isVisible = enabled || localOverride;

  if (isVisible) {
    return <>{children}</>;
  }

  // Intentionally suppressing "Under development" placeholder globally.
  if (fallback) return <>{fallback}</>;
  return null;
export default function FeatureGate({ children }: FeatureGateProps) {
  return <>{children}</>;
}
