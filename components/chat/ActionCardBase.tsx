"use client";

// Generic Yes/No confirmation card (PERSONA-1 — RESYNC-0 B10). Extracted from
// ProposalCard so other accept/dismiss flows (e.g. the Listener's persona
// proposals) can reuse the same shell. ProposalCard wraps this unchanged —
// its props, exports, and rendered output are behavior-preserving.

import React from "react";

export default function ActionCardBase({
  summary,
  status = "pending",
  loading = false,
  onAccept,
  onDismiss,
  acceptLabel = "Yes",
  dismissLabel = "No thanks",
  acceptedText = "✓ Done.",
  dismissedText = "Okay, not now.",
}: {
  summary: React.ReactNode;
  status?: "pending" | "accepted" | "dismissed";
  loading?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  acceptLabel?: string;
  dismissLabel?: string;
  acceptedText?: React.ReactNode;
  dismissedText?: React.ReactNode;
}) {
  return (
    <div
      className="mt-2 rounded-xl px-3 py-2.5"
      style={{
        background: "rgba(99,102,241,0.07)",
        border: "1px solid rgba(99,102,241,0.25)",
      }}
    >
      {status === "accepted" ? (
        <p className="text-xs text-green-400 font-medium">{acceptedText}</p>
      ) : status === "dismissed" ? (
        <p className="text-xs text-gray-500">{dismissedText}</p>
      ) : (
        <>
          <div className="text-xs text-indigo-300 mb-2">{summary}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAccept}
              disabled={loading}
              className="text-xs font-medium rounded-lg px-2.5 py-1 disabled:opacity-50 transition-colors"
              style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.35)",
                color: "#a5b4fc",
              }}
            >
              {acceptLabel}
            </button>
            <button
              onClick={onDismiss}
              disabled={loading}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50 transition-colors"
            >
              {dismissLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
