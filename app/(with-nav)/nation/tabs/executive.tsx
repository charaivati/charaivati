"use client";

import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

const schemeTracker = [
  "Beneficiary coverage (placeholder)",
  "Delivery timeliness (placeholder)",
  "District variance (placeholder)",
];

const budgetVsUtilization = [
  "Allocated budget (placeholder)",
  "Released amount (placeholder)",
  "Utilization ratio (placeholder)",
];

const officerSpotlight = [
  "Department lead profile (placeholder)",
  "Execution bottleneck note (placeholder)",
  "Corrective action status (placeholder)",
];

const feedbackLoop = [
  "Complaint inflow trend (placeholder)",
  "Resolution SLA (placeholder)",
  "Escalation map (placeholder)",
];

export default function ExecutiveTab({ value, onChange }: Props) {
  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-xl font-semibold text-white">Executive</h3>
        <p className="text-sm text-gray-300 mt-1">
          Track implementation quality, spending efficiency, and governance responsiveness.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Scheme Tracker</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {schemeTracker.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Budget vs Utilization</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {budgetVsUtilization.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Officer Spotlight</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {officerSpotlight.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Public Feedback Loop</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {feedbackLoop.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      <article className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h4 className="font-medium text-white">Public Interaction / Notes</h4>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Capture implementation notes, bottlenecks, and citizen feedback summaries..."
          className="mt-2 w-full min-h-[120px] rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white outline-none"
        />
      </article>
    </section>
  );
}
