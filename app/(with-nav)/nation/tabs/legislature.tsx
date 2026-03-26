"use client";

import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

const activeBills = [
  "Bill pipeline status (placeholder)",
  "Committee review progress (placeholder)",
  "Debate intensity marker (placeholder)",
];

const mpPerformanceDashboard = [
  "Attendance ratio (placeholder)",
  "Question participation (placeholder)",
  "Debate contribution (placeholder)",
];

const promiseTracker = [
  "Manifesto commitment map (placeholder)",
  "Fulfilled vs pending split (placeholder)",
  "Region-level progress note (placeholder)",
];

const citizenInputs = [
  "Petition volume (placeholder)",
  "Issue clusters (placeholder)",
  "Escalation route tracking (placeholder)",
];

export default function LegislatureTab({ value, onChange }: Props) {
  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-xl font-semibold text-white">Legislature</h3>
        <p className="text-sm text-gray-300 mt-1">
          Monitor lawmaking activity, member performance, and citizen policy inputs.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Active Bills</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {activeBills.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">MP Performance Dashboard</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {mpPerformanceDashboard.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Promise Tracker</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {promiseTracker.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Citizen Inputs</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {citizenInputs.map((item) => (
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
          placeholder="Capture bill priorities, constituent concerns, and legislative follow-up notes..."
          className="mt-2 w-full min-h-[120px] rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white outline-none"
        />
      </article>
    </section>
  );
}
