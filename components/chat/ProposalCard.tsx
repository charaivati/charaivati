"use client";

// Shared profile-proposal Yes/No card (CONSULT-2) — lifted verbatim from the
// inline JSX in ChatBot.tsx so ChatBot and ListenChat render identical cards.
// Behavior lives with the caller: onAccept/onDismiss do the actual POST /
// localStorage work (ChatBot keeps its own handlers — zero behavior change).

import React from "react";
import type { ProfileProposal } from "@/lib/companion/profileSync";
import ActionCardBase from "./ActionCardBase";

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
    <ActionCardBase
      summary={proposal.summary}
      status={status}
      loading={loading}
      onAccept={onAccept}
      onDismiss={onDismiss}
      acceptLabel="Yes, add it"
      acceptedText="✓ Added to your Self profile."
    />
  );
}
