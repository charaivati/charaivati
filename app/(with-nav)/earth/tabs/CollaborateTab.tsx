"use client";
// app/(with-nav)/earth/tabs/CollaborateTab.tsx — Action + community tab

import React from "react";
import { CollapsibleSection } from "@/components/self/shared";
import MicroActionRow from "@/components/earth/MicroActionRow";
import CommunitySignalBoard from "@/components/earth/CommunitySignalBoard";
import RollupBoard from "@/components/civic/RollupBoard";

export default function CollaborateTab() {
  return (
    <div className="space-y-4 text-white">

      {/* CIVIC-2 — Earth is where local work becomes visible as planetary
          work: a pure rollup of every ward/panchayat board, all countries. */}
      <CollapsibleSection
        title="Local Action Worldwide"
        subtitle="Every ward and panchayat board, summed"
        defaultOpen={true}
      >
        <div className="pt-1">
          <RollupBoard
            scope="earth"
            heading="Local action across the planet"
            subheading="Demands raised, supported, and completed by residents in their own areas — everywhere Charaivati reaches."
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Take Action"
        subtitle="Small steps, planetary impact"
        defaultOpen={true}
      >
        <div className="pt-1">
          <MicroActionRow />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Community Pulse"
        subtitle="Recent activity in your region"
        defaultOpen={true}
      >
        <div className="pt-1">
          <CommunitySignalBoard />
        </div>
      </CollapsibleSection>

    </div>
  );
}
