"use client";

// Admin-only "save as draft lens" confirmation card (PERSONA-1). Mirrors
// ProposalCard but for PhilosophyPersona distillations — rendered only in
// admin-mode Listener sessions. Built on the shared ActionCardBase shell.

import React from "react";
import ActionCardBase from "./ActionCardBase";
import type { DistilledPersona } from "@/lib/listener/adminBridge";

export type PersonaProposal = DistilledPersona & { questionId?: string };

export default function PersonaProposalCard({
  proposal,
  status = "pending",
  loading = false,
  onAccept,
  onDismiss,
}: {
  proposal: PersonaProposal;
  status?: "pending" | "accepted" | "dismissed";
  loading?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <ActionCardBase
      summary={
        <div>
          <p className="font-medium text-indigo-200 mb-1">{proposal.displayName}</p>
          <p className="text-gray-400 whitespace-pre-wrap">{proposal.body}</p>
          {proposal.triggers?.length > 0 && (
            <p className="text-gray-500 mt-1">Triggers: {proposal.triggers.join(", ")}</p>
          )}
          {proposal.attribution && (
            <p className="text-gray-500 mt-1 italic">{proposal.attribution}</p>
          )}
        </div>
      }
      status={status}
      loading={loading}
      onAccept={onAccept}
      onDismiss={onDismiss}
      acceptLabel="Save as draft lens"
      acceptedText="✓ Saved as draft lens."
    />
  );
}
