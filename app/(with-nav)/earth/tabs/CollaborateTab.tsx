"use client";

import React from "react";

type EarthTabProps = {
  selection?: { region?: string; focus?: string } | null;
  onChange?: (value: { region?: string; focus?: string }) => void;
};

type CollaborationCategory = {
  title: string;
  description: string;
};

const categories: CollaborationCategory[] = [
  {
    title: "Climate Action",
    description:
      "Coordinate mitigation, adaptation, and local resilience projects aligned with shared planetary targets.",
  },
  {
    title: "Food Systems",
    description:
      "Strengthen regenerative production, equitable distribution, and long-term nutrition security across communities.",
  },
  {
    title: "Sustainable Capital",
    description:
      "Mobilize patient, impact-oriented financing models that support collective well-being and ecological recovery.",
  },
];

export default function CollaborateTab(_props: EarthTabProps): React.JSX.Element {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-200">
      <header className="mb-6">
        <h2 className="text-xl font-semibold">Collective Action</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Explore collaboration pathways designed for systemic, shared, and measurable impact.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {categories.map((category) => (
          <button
            key={category.title}
            type="button"
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-left transition hover:bg-neutral-800"
          >
            <h3 className="text-base font-medium">{category.title}</h3>
            <p className="mt-3 text-sm text-neutral-400">{category.description}</p>
          </button>
        ))}
      </div>

      <div className="mt-6">
        <button
          type="button"
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-800"
        >
          Propose Initiative
        </button>
      </div>
    </section>
  );
}
