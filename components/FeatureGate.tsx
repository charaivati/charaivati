"use client";

import React from "react";

export type FeatureGateProps = {
  children?: React.ReactNode;
};

export default function FeatureGate({ children }: FeatureGateProps) {
  return <>{children}</>;
}
