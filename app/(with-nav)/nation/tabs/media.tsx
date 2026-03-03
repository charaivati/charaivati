"use client";

import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

const newsMemoryTimeline = [
  "Coverage spike around policy announcement",
  "Follow-up debate on implementation gaps",
  "Ground-report cycle from affected districts",
];

const narrativeShiftTracker = [
  "Headline tone moved from neutral to critical",
  "Fact-check volume increased this week",
  "Regional channels showing mixed sentiment",
];

const caseDeepDive = [
  "Case file placeholder: procurement transparency",
  "Case file placeholder: media access constraints",
  "Case file placeholder: misinformation correction lag",
];

const dataInsights = [
  "Trust index (placeholder)",
  "Coverage diversity index (placeholder)",
  "Correction turnaround time (placeholder)",
];

export default function MediaTab({ value, onChange }: Props) {
  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-xl font-semibold text-white">Media</h3>
        <p className="text-sm text-gray-300 mt-1">
          Track information quality, narrative movement, and public communication signals.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">News Memory Timeline</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {newsMemoryTimeline.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Narrative Shift Tracker</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {narrativeShiftTracker.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Case Deep Dive</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {caseDeepDive.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="font-medium text-white">Data Insights</h4>
          <ul className="mt-2 space-y-1 text-sm text-gray-300 list-disc list-inside">
            {dataInsights.map((item) => (
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
          placeholder="Capture observations, source quality notes, and follow-up checkpoints..."
          className="mt-2 w-full min-h-[120px] rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white outline-none"
        />
      </article>
    </section>
  );
}
