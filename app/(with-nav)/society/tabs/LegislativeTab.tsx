"use client";

import React from "react";
import GovernanceTabTemplate from "./GovernanceTabTemplate";

const topics = [
  { id: "policyImplementation", label: "Policy Implementation" },
  { id: "grievanceRedressal", label: "Grievance Redressal" },
  { id: "health", label: "Healthcare Access" },
  { id: "education", label: "School Quality" },
  { id: "roads", label: "Constituency Roads" },
  { id: "welfareDelivery", label: "Welfare Delivery" },
  { id: "publicSafety", label: "Public Safety" },
  { id: "localEconomy", label: "Local Economy" },
];

export default function LegislativeTab() {
  return <GovernanceTabTemplate governanceLevel="Legislative Constituency" topics={topics} />;
}
