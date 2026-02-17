// components/FeatureGate.tsx
"use client";
import React from "react";

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

export default function FeatureGate({ children }: FeatureGateProps) {
  return <>{children}</>;
}
