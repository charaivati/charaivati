"use client";

// Active-guide card for the floating chat (ChatBot only — never the listener).
// Renders a detected gap (gapDetector.ts) as a one-step action: pick a drive,
// open a block, or draft+save a goal. Visual style matches ActionCardBase.

import React, { useState } from "react";
import type { GuideAction } from "@/lib/companion/gapDetector";

const SHELL = "mt-2 rounded-xl px-3 py-2.5";
const SHELL_STYLE: React.CSSProperties = {
  background: "rgba(99,102,241,0.07)",
  border: "1px solid rgba(99,102,241,0.25)",
};
const PILL: React.CSSProperties = {
  background: "rgba(99,102,241,0.15)",
  border: "1px solid rgba(99,102,241,0.35)",
  color: "#a5b4fc",
};

export default function GuideActionCard({
  action,
  status = "pending",
  onPickDrive,
  onDraftGoal,
  onSaveGoal,
  onDismiss,
}: {
  action: GuideAction;
  status?: "pending" | "accepted" | "dismissed";
  onPickDrive: (value: string) => Promise<void> | void;
  onDraftGoal: (text: string) => Promise<{ statement: string; description: string } | null>;
  onSaveGoal: (statement: string, description: string) => Promise<void> | void;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<{ statement: string; description: string } | null>(null);
  const [err, setErr] = useState("");

  if (status === "accepted") {
    return (
      <div className={SHELL} style={SHELL_STYLE}>
        <p className="text-xs text-green-400 font-medium">✓ Saved to your Self profile.</p>
      </div>
    );
  }
  if (status === "dismissed") {
    return (
      <div className={SHELL} style={SHELL_STYLE}>
        <p className="text-xs text-gray-500">Okay, not now.</p>
      </div>
    );
  }

  // ── Pick a drive (4 options) + open-block link ──────────────────────────────
  if (action.kind === "pick-drive") {
    return (
      <div className={SHELL} style={SHELL_STYLE}>
        <div className="text-xs text-indigo-300 mb-2">{action.message}</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {action.options.map((o) => (
            <button
              key={o.value}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onPickDrive(o.value);
                } finally {
                  setBusy(false);
                }
              }}
              className="text-xs font-medium rounded-lg px-2.5 py-1 disabled:opacity-50 transition-colors"
              style={PILL}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a href={action.route.href} className="text-xs text-indigo-400 hover:text-indigo-300 underline">
            {action.route.label}
          </a>
          <button onClick={onDismiss} disabled={busy} className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50">
            No thanks
          </button>
        </div>
      </div>
    );
  }

  // ── Generic nav (future gaps) ───────────────────────────────────────────────
  if (action.kind === "nav") {
    return (
      <div className={SHELL} style={SHELL_STYLE}>
        <div className="text-xs text-indigo-300 mb-2">{action.message}</div>
        <div className="flex items-center gap-3">
          <a href={action.route.href} className="text-xs text-indigo-400 hover:text-indigo-300 underline">
            {action.route.label}
          </a>
          <button onClick={onDismiss} className="text-xs text-gray-500 hover:text-gray-300">
            No thanks
          </button>
        </div>
      </div>
    );
  }

  // ── Draft a goal (type → AI draft → confirm) ────────────────────────────────
  return (
    <div className={SHELL} style={SHELL_STYLE}>
      <div className="text-xs text-indigo-300 mb-2">{action.message}</div>
      {!draft ? (
        <>
          <div className="flex gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="I want to…"
              className="flex-1 text-xs rounded-lg px-2 py-1 bg-gray-900 text-gray-100 border border-gray-700 outline-none focus:border-indigo-500"
            />
            <button
              disabled={busy || !text.trim()}
              onClick={async () => {
                setBusy(true);
                setErr("");
                try {
                  const d = await onDraftGoal(text.trim());
                  if (d) setDraft(d);
                  else setErr("Couldn't draft that — try rephrasing.");
                } finally {
                  setBusy(false);
                }
              }}
              className="text-xs font-medium rounded-lg px-2.5 py-1 disabled:opacity-50"
              style={PILL}
            >
              {busy ? "…" : "Draft"}
            </button>
          </div>
          {err && <p className="text-xs text-red-400 mt-1">{err}</p>}
          <button onClick={onDismiss} className="text-xs text-gray-500 hover:text-gray-300 mt-2">
            No thanks
          </button>
        </>
      ) : (
        <>
          <div className="text-xs text-gray-100 bg-gray-900 rounded-lg px-2 py-1.5 mb-2 border border-gray-700">
            <div className="font-medium">{draft.statement}</div>
            {draft.description && <div className="text-gray-400 mt-0.5">{draft.description}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSaveGoal(draft.statement, draft.description);
                } finally {
                  setBusy(false);
                }
              }}
              className="text-xs font-medium rounded-lg px-2.5 py-1 disabled:opacity-50"
              style={PILL}
            >
              Save it
            </button>
            <button onClick={() => setDraft(null)} disabled={busy} className="text-xs text-gray-500 hover:text-gray-300">
              Edit
            </button>
            <button onClick={onDismiss} disabled={busy} className="text-xs text-gray-500 hover:text-gray-300">
              No
            </button>
          </div>
        </>
      )}
    </div>
  );
}
