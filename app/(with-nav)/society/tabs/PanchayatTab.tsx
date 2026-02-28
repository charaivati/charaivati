"use client";

import React from "react";
import GovernanceTabTemplate from "./GovernanceTabTemplate";

const topics = [
  { id: "water", label: "Water Supply" },
  { id: "electricity", label: "Electricity Distribution" },
  { id: "roads", label: "Local Roads & Drainage" },
  { id: "sanitation", label: "Sanitation & Waste" },
  { id: "primaryHealth", label: "Primary Health Services" },
  { id: "primaryEducation", label: "Primary Education" },
  { id: "localMarkets", label: "Local Markets & Livelihood" },
  { id: "environment", label: "Local Environment" },
  { id: "budget", label: "Local Budget & Spending" },
];

export default function PanchayatTab() {
  return (
    <GovernanceTabTemplate
      governanceLevel="Panchayat / Ward"
      topics={topics}
    />
  );
}
