"use client";

// CIVIC-1 — standalone/mobile deep-link surface for a unit's issue board.
// The board itself lives in components/civic/IssueBoard.tsx and is also
// embedded (dark) in the Society "Panchayat/Ward" tab.

import { useParams } from "next/navigation";
import IssueBoard from "@/components/civic/IssueBoard";

export default function LocalUnitPage() {
  const params = useParams<{ unitId: string }>();
  const unitId = params?.unitId;
  if (!unitId) return null;
  return <IssueBoard unitId={unitId} standalone theme="light" />;
}
