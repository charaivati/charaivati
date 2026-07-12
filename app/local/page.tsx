"use client";

// CIVIC-1 — /local index: the stable link target for "my local board".
// Redirects to the caller's home-unit board, or shows the picker when no
// home unit is set yet. Unauthenticated visitors go to login and back.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UnitPicker from "@/components/civic/UnitPicker";

export default function LocalIndexPage() {
  const router = useRouter();
  const [needsPick, setNeedsPick] = useState(false);

  useEffect(() => {
    fetch("/api/civic/home-unit")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/login?redirect=/local");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (d.homeUnitId) router.replace(`/local/${d.homeUnitId}`);
        else setNeedsPick(true);
      })
      .catch(() => setNeedsPick(true));
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "#F3F4F6", color: "#111827" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 96px" }}>
        {needsPick ? (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Your local area</h1>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px" }}>
              What your area needs, decided by the people who live there.
            </p>
            <UnitPicker onSet={(id) => router.replace(`/local/${id}`)} theme="light" />
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <div className="h-6 bg-gray-200 rounded animate-pulse" style={{ width: "50%" }} />
            <div className="h-14 bg-gray-200 rounded-xl animate-pulse" />
            <div className="h-14 bg-gray-200 rounded-xl animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
