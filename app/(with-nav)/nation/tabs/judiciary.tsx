"use client";

import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

const pendingCasesDashboard = [
  "Civil backlog trend (placeholder)",
  "Criminal backlog trend (placeholder)",
  "Average disposal cycle (placeholder)",
];

const majorOngoingCases = [
  "Constitutional challenge (placeholder)",
  "Public interest litigation (placeholder)",
  "Service delivery rights case (placeholder)",
];

const caseTimelineViewer = [
  "Filing -> notice -> hearing",
  "Interim order checkpoints",
  "Final order and compliance stage",
];

const rightsBlocks = [
  "Right to legal aid",
  "Right to fair hearing",
  "Right to appeal",
];

export default function JudiciaryTab({ value, onChange }: Props) {
  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-xl font-semibold text-white">Judiciary</h3>
        <p className="text-sm text-gray-300 mt-1">
          Observe legal process health, case timelines, and rights awareness signals.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Pending Cases Dashboard</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {pendingCasesDashboard.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Major Ongoing Cases</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {majorOngoingCases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Case Timeline Viewer</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {caseTimelineViewer.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Know Your Rights</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {rightsBlocks.map((item) => (
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
          placeholder="Capture court-access observations, rights awareness gaps, and follow-up notes..."
          className="mt-2 w-full min-h-[120px] rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white outline-none"
        />
      </article>
    </section>
  );
}
