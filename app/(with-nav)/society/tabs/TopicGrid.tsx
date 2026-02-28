"use client";

import React from "react";
import type { Topic, TopicResponse } from "./types";

type TopicGridProps = {
  topics: Topic[];
  responses: Record<string, TopicResponse>;
  onOpen: (topic: Topic) => void;
};

export default function TopicGrid({ topics, responses, onOpen }: TopicGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {topics.map((topic) => {
        const hasSaved = Boolean(responses[topic.id]?.status || responses[topic.id]?.suggestion);
        return (
          <button
            key={topic.id}
            type="button"
            onClick={() => onOpen(topic)}
            className="relative rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-4 text-left transition"
          >
            {hasSaved && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-green-400" />}
            <div className="text-sm text-white font-medium">{topic.label}</div>
          </button>
        );
      })}
    </div>
  );
}
