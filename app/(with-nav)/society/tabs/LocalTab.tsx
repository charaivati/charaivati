"use client";

import React from "react";
import GovernanceTabTemplate from "./GovernanceTabTemplate";

const topics = [
  { id: "water", label: "Water Supply" },
  { id: "electricity", label: "Electricity" },
  { id: "roads", label: "Roads & Drainage" },
  { id: "sanitation", label: "Sanitation" },
  { id: "health", label: "Primary Health" },
  { id: "education", label: "Primary Education" },
  { id: "environment", label: "Environment" },
  { id: "budget", label: "Local Budget" },
];

export default function LocalTab() {
  return <GovernanceTabTemplate governanceLevel="Local Governance" topics={topics} />;
}
