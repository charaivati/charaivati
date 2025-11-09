"use client";

import React, { useEffect, useRef, useState } from "react";
import TopBar from "@/components/TopBar";

/**
 * Layout behavior:
 * - Initially header is ALWAYS shown (even on first load).
 * - When page dispatches `hideHeader`, header slides away.
 * - If user scrolls back to top (<= TOP_SHOW_THRESHOLD px), header reappears.
 * - You can also programmatically show with `window.dispatchEvent(new Event('showHeader'))`.
 */

const TOP_SHOW_THRESHOLD = 12; // px from top to auto-show header
const SCROLL_DEBOUNCE_MS = 80;

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const [showHeader, setShowHeader] = useState(true);
  const [mounted, setMounted] = useState(false);
  const hiddenByEventRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Mark as mounted to ensure hydration works properly
    setMounted(true);
    console.log("[layout] component mounted, showHeader=true");

    const onHide = () => {
      console.log("[layout] hideHeader event received. scrollY=", window.scrollY);
      console.trace("[layout] hideHeader trace");
      hiddenByEventRef.current = true;
      setShowHeader(false);
    };

    const onShow = () => {
      console.log("[layout] showHeader event received. scrollY=", window.scrollY);
      hiddenByEventRef.current = false;
      setShowHeader(true);
    };

    const onScroll = () => {
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        const y = window.scrollY || window.pageYOffset || 0;

        // If scrolled back to top, show header
        if (y <= TOP_SHOW_THRESHOLD) {
          hiddenByEventRef.current = false;
          setShowHeader(true);
        }
        // Otherwise leave header state alone (respect hideHeader event)
      }, SCROLL_DEBOUNCE_MS);
    };

    window.addEventListener("hideHeader", onHide as EventListener);
    window.addEventListener("showHeader", onShow as EventListener);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("hideHeader", onHide as EventListener);
      window.removeEventListener("showHeader", onShow as EventListener);
      window.removeEventListener("scroll", onScroll as EventListener);
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Prevent hydration mismatch - don't render until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col">
        <header className="z-50 w-full bg-slate-900/90 backdrop-blur border-b border-slate-700 p-3">
          <div className="max-w-7xl mx-auto flex justify-end">
            <div className="opacity-0 pointer-events-none">Placeholder</div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header
        className={
          "z-50 w-full bg-slate-900/90 backdrop-blur border-b border-slate-700 p-3 transform transition-transform duration-300 ease-out " +
          (showHeader ? "translate-y-0" : "-translate-y-full")
        }
      >
        <div className="max-w-7xl mx-auto flex justify-end">
          <TopBar />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}