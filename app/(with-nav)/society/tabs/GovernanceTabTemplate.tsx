"use client";

import React, { useState } from "react";
import GovernanceModal from "./GovernanceModal";
import TopicGrid from "./TopicGrid";
import type { Topic, TopicResponse } from "./types";

type GovernanceTabTemplateProps = {
  governanceLevel: string;
  topics: Topic[];
};

export default function GovernanceTabTemplate({ governanceLevel, topics }: GovernanceTabTemplateProps) {
  const [responses, setResponses] = useState<Record<string, TopicResponse>>({});
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);

  function handleSave(payload: TopicResponse) {
    if (!activeTopic) return;
    setResponses((prev) => ({ ...prev, [activeTopic.id]: payload }));
    console.log("society_topic_response", {
      governanceLevel,
      topicId: activeTopic.id,
      topicLabel: activeTopic.label,
      ...payload,
    });
    setActiveTopic(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <h3 className="text-lg font-semibold">{governanceLevel}</h3>
        <p className="text-sm text-gray-300 mt-1">Select a topic to understand it and submit your local observation.</p>
      </div>

      <TopicGrid topics={topics} responses={responses} onOpen={setActiveTopic} />

      {activeTopic && (
        <GovernanceModal
          governanceLevel={governanceLevel}
          topicId={activeTopic.id}
          topicLabel={activeTopic.label}
          initial={responses[activeTopic.id]}
          onSave={handleSave}
          onClose={() => setActiveTopic(null)}
        />
      )}
    </div>
  );
}
