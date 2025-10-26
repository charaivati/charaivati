// components/ClientCleanup.tsx
"use client";

import { useEffect } from "react";

/**
 * ClientCleanup
 * - Runs on client only.
 * - Removes common extension-injected attributes (e.g. Grammarly's data-gr-*)
 *   so DOM looks clean after hydration and avoids stale attributes staying around.
 *
 * This is defensive — it won't break anything if those attributes are absent.
 */
export default function ClientCleanup() {
  useEffect(() => {
    try {
      // remove data attributes that start with "data-gr-" or "data-new-gr-"
      const removePrefixedAttrs = (el: Element | null) => {
        if (!el) return;
        const attrs = Array.from(el.attributes || []);
        for (const a of attrs) {
          if (a.name.startsWith("data-gr-") || a.name.startsWith("data-new-gr-")) {
            el.removeAttribute(a.name);
          }
        }
      };

      // Clean html and body
      removePrefixedAttrs(document.documentElement);
      removePrefixedAttrs(document.body);

      // Also remove from other nodes that may be injected (rare)
      // limit to small set for safety
      const candidates = document.querySelectorAll("div, span, body, html");
      candidates.forEach((c) => {
        if (c && c.attributes && c.attributes.length > 0) {
          removePrefixedAttrs(c);
        }
      });
    } catch (e) {
      // non-fatal; don't interrupt the app
      // eslint-disable-next-line no-console
      console.warn("ClientCleanup error:", e);
    }
  }, []);

  return null;
}
