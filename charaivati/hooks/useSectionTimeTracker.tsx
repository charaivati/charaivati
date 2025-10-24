"use client";
import { useEffect, useRef } from "react";

type UsageRecord = {
  section: string;
  durationMs: number;
  interactions?: number;
  startedAt: string; // ISO
  endedAt: string; // ISO
};

export function useSectionTimeTracker(sectionName: string, options?: { sendIntervalMs?: number }) {
  const sendIntervalMs = options?.sendIntervalMs ?? 30000;
  const active = useRef(false);
  const startTs = useRef<number | null>(null);
  const accumulated = useRef<number>(0);
  const interactions = useRef<number>(0);
  const lastVisibility = useRef<boolean>(true);
  const flushTimeout = useRef<number | null>(null);

  function isVisible() {
    return typeof document !== "undefined" && document.visibilityState === "visible";
  }

  function start() {
    if (active.current) return;
    active.current = true;
    startTs.current = Date.now();
  }

  function stop() {
    if (!active.current) return;
    const now = Date.now();
    if (startTs.current) accumulated.current += now - startTs.current;
    startTs.current = null;
    active.current = false;
  }

  function recordInteraction() {
    interactions.current += 1;
  }

  async function sendBatch() {
    // if nothing recorded, skip
    if (accumulated.current <= 0 && interactions.current <= 0) return;
    const now = new Date();
    const started = new Date(now.getTime() - accumulated.current).toISOString();
    const ended = now.toISOString();
    const payload: { records: UsageRecord[] } = {
      records: [
        {
          section: sectionName,
          durationMs: Math.max(0, accumulated.current),
          interactions: interactions.current,
          startedAt: started,
          endedAt: ended,
        },
      ],
    };

    try {
      // prefer sendBeacon for unload reliability
      const url = "/api/usage";
      const body = JSON.stringify(payload);
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      }
    } catch (e) {
      // ignore
      console.error("usage send failed", e);
    } finally {
      // reset
      accumulated.current = 0;
      interactions.current = 0;
    }
  }

  useEffect(() => {
    // visibilitychange -> start/stop
    function onVisibility() {
      const vis = isVisible();
      if (vis) start();
      else stop();
      lastVisibility.current = vis;
    }

    function onInteraction() {
      recordInteraction();
    }

    // start initially if visible
    if (isVisible()) start();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    window.addEventListener("blur", onVisibility);
    window.addEventListener("click", onInteraction);
    window.addEventListener("keydown", onInteraction);

    // periodic sender
    const interval = window.setInterval(() => {
      // close current active span, accumulate, send, restart
      stop();
      sendBatch();
      // resume if visible
      if (isVisible()) start();
    }, sendIntervalMs);

    // send on unload
    function onBeforeUnload() {
      stop();
      // best effort send
      sendBatch();
    }
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      stop();
      sendBatch();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      window.removeEventListener("blur", onVisibility);
      window.removeEventListener("click", onInteraction);
      window.removeEventListener("keydown", onInteraction);
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [sectionName, sendIntervalMs]);

  // expose a helper for manual interactions (optional)
  return {
    recordInteraction: () => recordInteraction(),
    flush: async () => { stop(); await sendBatch(); if (isVisible()) start(); },
  };
}
