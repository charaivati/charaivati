// components/useUserLayers.tsx
"use client";

import React from "react";
import { DEFAULT_LAYERS, DefaultLayer } from "./defaultLayers";

type Layer = DefaultLayer;

export default function useUserLayers() {
  const [layers, setLayers] = React.useState<Layer[]>(() => {
    // ensure we only expose the first 9 slots (defaults + reserved)
    const copy = DEFAULT_LAYERS.slice(0, 9);
    // If fewer than 9, keep slots empty; we return actual layers only
    return copy;
  });

  const [activeLayerId, setActiveLayerId] = React.useState<string | null>(() => {
    return layers.length ? layers[0].id : null;
  });

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch("/api/user-layers", { credentials: "include" });
        if (!mounted) return;
        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.layers && Array.isArray(json.layers) && json.layers.length) {
            // expect server to reply with same shape (id, label, hint, tabs[])
            setLayers(json.layers.slice(0, 9));
            setActiveLayerId(json.activeLayerId ?? json.layers[0]?.id ?? layers[0]?.id ?? null);
            return;
          }
        }
      } catch (e) {
        // ignore network errors (keep defaults)
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    layers,
    setLayers,
    activeLayerId,
    setActiveLayerId,
  };
}
