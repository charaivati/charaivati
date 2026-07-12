"use client";

// CIVIC-1 — standalone/mobile deep-link surface for a unit's issue board.
// The board itself lives in components/civic/IssueBoard.tsx and is also
// embedded (dark) in the Society "Panchayat/Ward" tab. Area quality ratings
// (residents rate water/electricity/… — everyone sees the average) sit above
// the board, so the page owns the full-page wrapper instead of IssueBoard's
// standalone mode.

import { useParams } from "next/navigation";
import IssueBoard from "@/components/civic/IssueBoard";
import AreaRatings from "@/components/civic/AreaRatings";

export default function LocalUnitPage() {
  const params = useParams<{ unitId: string }>();
  const unitId = params?.unitId;
  if (!unitId) return null;
  return (
    <div style={{ minHeight: "100vh", background: "#F3F4F6", color: "#111827" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 96px" }}>
        <AreaRatings unitId={unitId} theme="light" />
        <IssueBoard unitId={unitId} theme="light" />
      </div>
    </div>
  );
}
