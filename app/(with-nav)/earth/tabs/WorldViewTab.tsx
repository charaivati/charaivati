"use client";

import React from "react";

type EarthTabProps = {
  selection?: { region?: string; focus?: string } | null;
  onChange?: (value: { region?: string; focus?: string }) => void;
};

type MetricCard = {
  title: string;
  description: string;
  score: string;
};

const metricCards: MetricCard[] = [
  {
    title: "Climate Stability Index",
    description:
      "A composite signal of heat balance, emissions trajectory, and adaptation readiness across regions.",
    score: "68%",
  },
  {
    title: "Global Food Resilience",
    description:
      "A systems-level view of crop diversity, supply continuity, and vulnerability to climate disruption.",
    score: "74%",
  },
  {
    title: "Biodiversity Health",
    description:
      "An indicator of ecosystem vitality, species protection, and restoration momentum worldwide.",
    score: "59%",
  },
  {
    title: "Resource Circularity",
    description:
      "Tracks how effectively materials are reused, recovered, and reintegrated into planetary value chains.",
    score: "63%",
  },
];

export default function WorldViewTab(_props: EarthTabProps): React.JSX.Element {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-200">
      <header className="mb-6">
        <h2 className="text-xl font-semibold">Planetary Systems Overview</h2>
        <p className="mt-2 text-sm text-neutral-400">
          These signals represent shared planetary conditions and collective system performance.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {metricCards.map((card) => (
          <article
            key={card.title}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:bg-neutral-800"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-medium">{card.title}</h3>
              <span className="rounded-md border border-neutral-700 px-2 py-1 text-xs font-semibold text-neutral-300">
                {card.score}
              </span>
            </div>
            <p className="mt-3 text-sm text-neutral-400">{card.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
