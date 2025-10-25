// hooks/useTabUsage.ts
import { useRef, useEffect } from "react";

export function useTabUsage(section: string) {
  const usageIdRef = useRef<string | null>(null);
  useEffect(() => {
    let startedAt = new Date();
    let mounted = true;

    // start
    (async () => {
      try {
        const r = await fetch("/api/self/usage/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ section, startedAt: startedAt.toISOString() }),
        });
        const j = await r.json();
        if (j?.ok && j.data?.id) usageIdRef.current = j.data.id;
      } catch (e) { /* ignore */ }
    })();

    // on unmount or page hide -> end
    async function endNow() {
      if (!usageIdRef.current) return;
      try {
        await fetch("/api/self/usage/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ usageId: usageIdRef.current }),
        });
      } catch (e) {}
    }

    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        endNow();
      }
    }
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", endNow);

    return () => {
      mounted = false;
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", endNow);
      endNow();
    };
  }, [section]);
}
