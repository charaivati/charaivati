"use client";

import React from "react";
import GovernanceTabTemplate from "./GovernanceTabTemplate";

const topics = [
  { id: "stateFinance", label: "State Finance" },
  { id: "healthcareSystems", label: "State Healthcare" },
  { id: "schoolSystems", label: "State Education" },
  { id: "infrastructure", label: "State Infrastructure" },
  { id: "environment", label: "Environment Policy" },
  { id: "transport", label: "State Transport" },
  { id: "policyImplementation", label: "Policy Execution" },
  { id: "landRecords", label: "Land & Records" },
];

export default function StateTab() {
  return <GovernanceTabTemplate governanceLevel="State Governance" topics={topics} />;
}
