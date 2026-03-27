"use client";

import React from "react";

type EarthTabProps = {
  selection?: { region?: string; focus?: string } | null;
  onChange?: (value: { region?: string; focus?: string }) => void;
};

type StoryCard = {
  title: string;
  summary: string;
};

const stories: StoryCard[] = [
  {
    title: "Coastal Communities and Rising Seas",
    summary:
      "Residents across low-lying regions are redesigning housing, livelihoods, and local governance to adapt to accelerating sea-level pressure.",
  },
  {
    title: "Shared Water, Shared Responsibility",
    summary:
      "Cross-border river communities are building collaborative stewardship models to balance drinking water, agriculture, and ecosystem health.",
  },
  {
    title: "Urban Air and Public Health",
    summary:
      "City networks are testing coordinated transport, energy, and planning strategies to reduce exposure and improve long-term quality of life.",
  },
];

export default function HumanStoriesTab(_props: EarthTabProps): React.JSX.Element {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-200">
      <header className="mb-6">
        <h2 className="text-xl font-semibold">Collective Human Narratives</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Stories that highlight interconnected challenges and cooperative resilience across societies.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stories.map((story) => (
          <article
            key={story.title}
            className="flex h-full flex-col rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition hover:bg-neutral-800"
          >
            <h3 className="text-base font-medium">{story.title}</h3>
            <p className="mt-3 flex-1 text-sm text-neutral-400">{story.summary}</p>
            <button
              type="button"
              className="mt-4 w-fit rounded-lg border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700"
            >
              Read More
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
