// lib/site/siteAwareness.ts — PERSONA-2: compact "what exists on the site" summary.
//
// Single source of truth is lib/site/capabilityRegistry.ts (SECTIONS). This module
// only summarizes it for AI prompts — never authors new status/route data here.
//
// buildSiteAwareness() — full per-section map (~150-250 tokens), for the local
//   (trusted) prompt tier. Semi-static: changes only when SECTIONS changes, not
//   per turn — safe to place in the semi-static prompt zone for prefix caching.
//
// buildSiteAwarenessCompact() — one-line summary for the cloud tier. Platform
// structure is non-sensitive, but cloud prompts stay lean (UCTX-1b).

import { SECTIONS, type SectionInfo } from "@/lib/site/capabilityRegistry";

const LAYER_ORDER = ["self", "society", "state", "nation", "earth", "universe"] as const;
const LAYER_LABELS: Record<(typeof LAYER_ORDER)[number], string> = {
  self: "SELF",
  society: "SOCIETY",
  state: "STATE",
  nation: "NATION",
  earth: "EARTH",
  universe: "UNIVERSE",
};

function describeSection(s: SectionInfo): string {
  switch (s.status) {
    case "live":
      return `${s.label} (live, ${s.route})`;
    case "scaffolded": {
      const live = s.liveFeatures?.length ? `live: ${s.liveFeatures.join(", ")}` : "";
      const coming = s.plannedFeatures?.length ? `coming: ${s.plannedFeatures.join(", ")}` : "";
      const detail = [live, coming].filter(Boolean).join("; ");
      return `${s.label} (partial${detail ? ` — ${detail}` : ""}, ${s.route})`;
    }
    case "planned": {
      const eta = s.eta ? `ETA ${s.eta}` : "no ETA yet";
      const interim = s.interim ? ` — meanwhile: ${s.interim}` : "";
      return `${s.label} (planned, ${eta}${interim})`;
    }
  }
}

/**
 * Full per-section map, grouped by layer. Semi-static — place in the
 * semi-static prompt zone, local tier only.
 */
export function buildSiteAwareness(): string {
  const lines: string[] = [];
  for (const layer of LAYER_ORDER) {
    const sections = Object.values(SECTIONS).filter((s) => s.layer === layer);
    if (sections.length === 0) continue;
    lines.push(`${LAYER_LABELS[layer]}: ${sections.map(describeSection).join(" · ")}`);
  }
  return lines.join("\n");
}

/**
 * One-line summary for the cloud tier — platform structure is non-sensitive but
 * cloud prompts stay lean. Do not expand this into the full per-section map.
 */
export function buildSiteAwarenessCompact(): string {
  return (
    "Charaivati is a six-layer self-development + local-commerce platform " +
    "(Self → Society → State → Nation → Earth → Universe). The Self layer " +
    "(personal, social, learning, earning, time) is fully live; the outer " +
    "layers (Society, State, Nation, Earth, Universe) are mostly planned, " +
    "with interim guidance pointing back to Self → Social."
  );
}
