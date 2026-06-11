"use client";

// Shared profile-proposal Yes/No card (CONSULT-2) — lifted verbatim from the
// inline JSX in ChatBot.tsx so ChatBot and ListenChat render identical cards.
// Behavior lives with the caller: onAccept/onDismiss do the actual POST /
// localStorage work (ChatBot keeps its own handlers — zero behavior change).

import React from "react";
import type { ProfileProposal } from "@/lib/companion/profileSync";

export const DISMISSED_PROPOSALS_KEY = "charaivati.dismissed_proposals";
const MAX_DISMISSED_PROPOSALS = 50;

// localStorage helpers for callers that don't have their own (ListenChat).
// ChatBot keeps its internal copies — do not swap those out.
export function getDismissedProposals(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_PROPOSALS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addDismissedProposal(id: string) {
  try {
    const current = getDismissedProposals();
    const next = [...current.filter((x) => x !== id), id].slice(-MAX_DISMISSED_PROPOSALS);
    localStorage.setItem(DISMISSED_PROPOSALS_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — proposal may repeat; non-critical
  }
}

export default function ProposalCard({
  proposal,
  status = "pending",
  loading = false,
  onAccept,
  onDismiss,
}: {
  proposal: ProfileProposal;
  status?: "pending" | "accepted" | "dismissed";
  loading?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
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
        <p className="text-xs text-green-400 font-medium">✓ Added to your Self profile.</p>
      ) : status === "dismissed" ? (
        <p className="text-xs text-gray-500">Okay, not now.</p>
      ) : (
        <>
          <p className="text-xs text-indigo-300 mb-2">{proposal.summary}</p>
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
              Yes, add it
            </button>
            <button
              onClick={onDismiss}
              disabled={loading}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50 transition-colors"
            >
              No thanks
            </button>
          </div>
        </>
      )}
    </div>
  );
}
