// components/FeatureGate.tsx
"use client";
import React, { useEffect, useState } from "react";
import UnderDevelopmentCard from "./UnderDevelopmentCard";

export default function FeatureGate({
  flagKey,
  children,
  title,
  fallbackMessage,
}: {
  flagKey: string;
  children: React.ReactNode;
  title?: string;
  fallbackMessage?: string;
}) {
  const [status, setStatus] = useState<"loading" | "on" | "off">("loading");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/feature-flag?key=${encodeURIComponent(flagKey)}`, { cache: "no-cache" });
        const json = await res.json().catch(() => null);
        if (!mounted) return;
        if (json?.ok && json?.enabled) setStatus("on");
        else setStatus("off");
      } catch (err) {
        console.error("FeatureGate fetch error", err);
        if (mounted) setStatus("off");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [flagKey]);

  if (status === "loading") {
    return <div className="p-8 text-center text-sm text-gray-400">Checking feature availability…</div>;
  }
  if (status === "off") {
    return <UnderDevelopmentCard title={title ?? "Coming soon"} message={fallbackMessage} />;
  }
  return <>{children}</>;
}
