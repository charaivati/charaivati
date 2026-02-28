"use client";

import React from "react";
import GovernanceTabTemplate from "./GovernanceTabTemplate";

const topics = [
  { id: "infrastructure", label: "Major Infrastructure" },
  { id: "publicSafety", label: "Public Safety" },
  { id: "healthcareSystems", label: "Healthcare Systems" },
  { id: "schoolSystems", label: "School Systems" },
  { id: "welfareDelivery", label: "Welfare Delivery" },
  { id: "climateReadiness", label: "Climate Readiness" },
  { id: "transport", label: "Regional Transport" },
  { id: "budget", label: "Constituency Funding" },
];

export default function ParliamentaryTab() {
  return <GovernanceTabTemplate governanceLevel="Parliamentary Constituency" topics={topics} />;
}
