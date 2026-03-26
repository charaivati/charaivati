"use client";

import React, { useState } from "react";
import type { TopicResponse } from "./types";
import { getTopicDescription } from "./governanceContent";

type GovernanceModalProps = {
  governanceLevel: string;
  topicId: string;
  topicLabel: string;
  initial?: TopicResponse;
  onSave: (payload: TopicResponse) => void;
  onClose: () => void;
};

export default function GovernanceModal({
  governanceLevel,
  topicId,
  topicLabel,
  initial,
  onSave,
  onClose,
}: GovernanceModalProps) {
  const [status, setStatus] = useState<TopicResponse["status"]>(initial?.status ?? null);
  const [suggestion, setSuggestion] = useState(initial?.suggestion ?? "");

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gray-900 text-white">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{topicLabel}</h3>
            <p className="text-xs text-gray-400 mt-1">{governanceLevel}</p>
          </div>
          <button onClick={onClose} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">Close</button>
        </div>

        <div className="p-5 space-y-5">
          <section className="rounded-xl border border-white/10 bg-black/30 p-4">
            <h4 className="font-medium text-sm">Educational Snapshot</h4>
            <p className="text-sm text-gray-300 mt-2 leading-relaxed">{getTopicDescription(topicId)}</p>
          </section>

          <section className="rounded-xl border border-white/10 bg-black/30 p-4">
            <h4 className="font-medium text-sm">Interactive Question</h4>
            <p className="text-sm text-gray-300 mt-2">Is {topicLabel.toLowerCase()} functioning properly in your area?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["yes", "Yes"],
                ["no", "No"],
                ["partial", "Partially"],
              ].map(([key, label]) => (
                <label key={key} className={`px-3 py-2 rounded-lg border text-sm cursor-pointer ${status === key ? "bg-indigo-600 border-indigo-500" : "bg-white/5 border-white/10"}`}>
                  <input
                    type="radio"
                    name="gov-status"
                    value={key}
                    checked={status === key}
                    onChange={() => setStatus(key as TopicResponse["status"])}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-black/30 p-4">
            <h4 className="font-medium text-sm">Improvement Suggestion (optional)</h4>
            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="What improvements do you suggest?"
              className="mt-2 w-full min-h-[100px] p-3 rounded-lg bg-white/5 border border-white/10 text-sm outline-none"
            />
          </section>
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm">Close</button>
          <button
            onClick={() => onSave({ status, suggestion: suggestion.trim() })}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
