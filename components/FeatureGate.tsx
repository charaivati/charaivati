"use client";

import React from "react";

export type FeatureGateProps = {
  children?: React.ReactNode;
};

export default function FeatureGate({ flagKey, flags, fallback, children }: FeatureGateProps) {
  const enabled = Boolean(flags?.[flagKey]?.enabled);

  if (enabled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return null;
}
