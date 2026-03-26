"use client";

import React from "react";

type EarthTabProps = {
  selection?: { region?: string; focus?: string } | null;
  onChange?: (value: { region?: string; focus?: string }) => void;
};

type ResourceBlock = {
  title: string;
  description: string;
};

const resourceBlocks: ResourceBlock[] = [
  {
    title: "Reports",
    description:
      "Periodic overviews summarizing planetary indicators, regional shifts, and collective response capacity.",
  },
  {
    title: "Research",
    description:
      "Evidence libraries connecting scientific findings with policy, governance, and implementation pathways.",
  },
  {
    title: "Tools",
    description:
      "Practical frameworks and templates to help teams evaluate system trade-offs and intervention outcomes.",
  },
  {
    title: "Learning Paths",
    description:
      "Structured journeys for citizens, institutions, and practitioners to build systems literacy over time.",
  },
];

export default function KnowledgeTab(_props: EarthTabProps): React.JSX.Element {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-200">
      <header className="mb-6">
        <h2 className="text-xl font-semibold">Earth Knowledge Base</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Shared resources for understanding Earth systems and enabling coordinated action.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {resourceBlocks.map((resource) => (
          <article
            key={resource.title}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:bg-neutral-800"
          >
            <h3 className="text-base font-medium">{resource.title}</h3>
            <p className="mt-3 text-sm text-neutral-400">{resource.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
