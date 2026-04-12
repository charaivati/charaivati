"use client";
// app/(with-nav)/earth/tabs/CollaborateTab.tsx — Action + community tab

import React from "react";
import { CollapsibleSection } from "@/components/self/shared";
import MicroActionRow from "@/components/earth/MicroActionRow";
import CommunitySignalBoard from "@/components/earth/CommunitySignalBoard";

export default function CollaborateTab() {
  return (
    <div className="space-y-4 text-white">

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
