"use client";

// Listener mind-map (CONSULT-2) — hand-rolled inline SVG, no new dependency.
// Fixed 9-node layout: Drive → Goal → seven parameters. Node fill-state derives
// from ConsultSession.insights. Tapping a steerable node is the steering wheel:
// the sheet closes and the conversation moves there next. Long-press/right-click
// a sensed node to flag "that's not right" (correction re-ask).

import React, { useRef, useState } from "react";
import { X } from "lucide-react";
import type { ConsultInsights } from "@/lib/listener/insights";

export type MapNodeKey =
  | "drive"
  | "goal"
  | "skills"
  | "health"
  | "environment"
  | "time"
  | "funds"
  | "network"
  | "energy";

type NodeState = "unknown" | "sensed" | "confirmed";

interface NodeDef {
  key: MapNodeKey;
  label: string;
  x: number;
  y: number;
  steerable: boolean;
  derived?: boolean;
}

const NODES: NodeDef[] = [
  { key: "drive", label: "Drive", x: 180, y: 56, steerable: true },
  { key: "goal", label: "Goal", x: 180, y: 142, steerable: true },
  { key: "skills", label: "Skills", x: 62, y: 238, steerable: true },
  { key: "health", label: "Health", x: 180, y: 226, steerable: true },
  { key: "environment", label: "Environment", x: 298, y: 238, steerable: true },
  { key: "time", label: "Time", x: 62, y: 336, steerable: true },
  { key: "funds", label: "Funds", x: 180, y: 326, steerable: true },
  { key: "network", label: "Network", x: 298, y: 336, steerable: false }, // display-only — no write target yet
  { key: "energy", label: "Energy", x: 180, y: 412, steerable: false, derived: true }, // derived, read-only
];

const LONG_PRESS_MS = 550;

function nodeState(key: MapNodeKey, insights: ConsultInsights | null, stage: number): NodeState {
  if (!insights) return "unknown";
  switch (key) {
    case "drive":
      if (!insights.driveCandidate.value) return "unknown";
      return insights.driveCandidate.confidence === "confirmed" ? "confirmed" : "sensed";
    case "goal":
      // Goal exists only as a proposal until accepted (stage 5 = handed off).
      return stage >= 5 ? "confirmed" : stage >= 4 ? "sensed" : "unknown";
    case "skills":
      return insights.skills.items.length ? "sensed" : "unknown";
    case "health":
      return insights.health.notes.length || insights.health.senseLevel != null ? "sensed" : "unknown";
    case "environment":
      return insights.environment.notes.length ? "sensed" : "unknown";
    case "time":
      return insights.time.notes.length || insights.time.dailyHours != null ? "sensed" : "unknown";
    case "funds":
      return insights.funds.notes.length || insights.funds.pressure ? "sensed" : "unknown";
    case "network":
      return insights.network.notes.length ? "sensed" : "unknown";
    case "energy":
      return insights.energy.senseLevel != null ? "sensed" : "unknown";
  }
}

const STATE_STYLES: Record<NodeState, { fill: string; stroke: string; dash?: string }> = {
  unknown: { fill: "#111827", stroke: "#4b5563", dash: "4 4" },
  sensed: { fill: "rgba(99,102,241,0.25)", stroke: "#6366f1" },
  confirmed: { fill: "#6366f1", stroke: "#818cf8" },
};

export default function MindMap({
  open,
  onClose,
  insights,
  stage,
  onSteer,
}: {
  open: boolean;
  onClose: () => void;
  insights: ConsultInsights | null;
  stage: number;
  onSteer: (node: MapNodeKey, correction?: boolean) => void;
}) {
  const [correctionNode, setCorrectionNode] = useState<MapNodeKey | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  if (!open) return null;

  const goal = NODES[1];

  function clearPressTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function startPress(node: NodeDef, state: NodeState) {
    longPressFired.current = false;
    if (state === "unknown") return;
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setCorrectionNode(node.key);
    }, LONG_PRESS_MS);
  }

  function tap(node: NodeDef) {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (!node.steerable) return;
    onSteer(node.key);
  }

  const correctionDef = correctionNode ? NODES.find((n) => n.key === correctionNode) : null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute bottom-0 inset-x-0 sm:bottom-6 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] rounded-t-2xl sm:rounded-2xl bg-gray-950 border border-gray-800 px-4 pt-3 pb-5 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium text-gray-200">Your map so far</h2>
          <button onClick={onClose} aria-label="Close map" className="text-gray-500 hover:text-gray-300 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-2">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-gray-500" /> not yet
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-indigo-500" style={{ background: "rgba(99,102,241,0.25)" }} /> sensed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500" /> confirmed ✓
          </span>
        </div>

        <svg viewBox="0 0 360 460" className="w-full select-none" role="img" aria-label="Conversation mind map">
          {/* Edges */}
          <path d="M180 84 L180 114" stroke="#374151" strokeWidth="1.5" fill="none" />
          {NODES.slice(2).map((n) => (
            <path key={`edge-${n.key}`} d={`M${goal.x} ${goal.y + 28} L${n.x} ${n.y - 26}`} stroke="#1f2937" strokeWidth="1.5" fill="none" />
          ))}

          {/* Nodes */}
          {NODES.map((n) => {
            const state = nodeState(n.key, insights, stage);
            const s = STATE_STYLES[state];
            const tappable = n.steerable || state !== "unknown";
            return (
              <g
                key={n.key}
                onClick={() => tap(n)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (state !== "unknown") setCorrectionNode(n.key);
                }}
                onTouchStart={() => startPress(n, state)}
                onTouchEnd={clearPressTimer}
                onTouchMove={clearPressTimer}
                style={{ cursor: tappable ? "pointer" : "default" }}
              >
                <circle cx={n.x} cy={n.y} r={28} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} strokeDasharray={n.derived ? "2 3" : s.dash} />
                {state === "confirmed" && (
                  <text x={n.x} y={n.y + 1} textAnchor="middle" fontSize="14" fill="#fff">
                    ✓
                  </text>
                )}
                {n.key === "energy" && insights?.energy.senseLevel != null && (
                  <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="12" fill="#a5b4fc">
                    {insights.energy.senseLevel}
                  </text>
                )}
                <text x={n.x} y={n.y + 44} textAnchor="middle" fontSize="11" fill={state === "unknown" ? "#6b7280" : "#d1d5db"}>
                  {n.label}
                </text>
                {n.derived && (
                  <text x={n.x} y={n.y + 56} textAnchor="middle" fontSize="8" fill="#6b7280" fontStyle="italic">
                    (derived)
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <p className="text-[11px] text-gray-500 text-center mt-1">
          Tap a circle to talk about it. Long-press one if something there isn&apos;t right.
        </p>

        {correctionDef && (
          <div className="mt-3 rounded-xl border border-amber-700/40 bg-amber-900/15 px-3 py-2.5">
            <p className="text-xs text-amber-200 mb-2">Something about {correctionDef.label} isn&apos;t right?</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCorrectionNode(null);
                  onSteer(correctionDef.key, true);
                }}
                className="text-xs font-medium rounded-lg px-2.5 py-1 border border-amber-600/50 text-amber-300 hover:bg-amber-900/30 transition-colors"
              >
                That&apos;s not right — ask me again
              </button>
              <button onClick={() => setCorrectionNode(null)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
