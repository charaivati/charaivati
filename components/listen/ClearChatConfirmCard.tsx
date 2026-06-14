"use client";

import { useState } from "react";

const CARD_STYLE = { background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)" } as const;
const BUTTON_STYLE = { background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" } as const;

type Status = "idle" | "sending" | "done" | "dismissed" | "error";

// ACTION-INTENT-3: strict-keyword-only clear/reset. Confirm calls
// POST /api/listen/clear, which only stamps ConsultSession.chatResetAt —
// ConsultMessage rows are never deleted (fold-don't-delete doctrine). On
// success the parent clears the on-screen messages only.
export default function ClearChatConfirmCard({ onCleared }: { onCleared?: () => void }) {
  const [status, setStatus] = useState<Status>("idle");

  async function confirmClear() {
    if (status === "sending" || status === "done") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/listen/clear", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) {
        setStatus("done");
        onCleared?.();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return <p className="text-xs text-green-400 mt-2">✓ Chat cleared.</p>;
  }
  if (status === "dismissed") {
    return <p className="text-xs text-gray-500 mt-2">Okay, keeping this conversation.</p>;
  }

  return (
    <div className="mt-2 rounded-xl px-3 py-2.5 flex items-center gap-3" style={CARD_STYLE}>
      <div className="flex-1 min-w-0">
        {status === "error" && <p className="text-xs text-red-400">Something went wrong — try again.</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0 items-center">
        <button
          onClick={confirmClear}
          disabled={status === "sending"}
          className="text-xs px-2.5 py-1 rounded-lg disabled:opacity-50"
          style={BUTTON_STYLE}
        >
          {status === "sending" ? "Clearing…" : "Clear chat"}
        </button>
        <button onClick={() => setStatus("dismissed")} className="text-xs text-gray-500 hover:text-gray-400">
          Cancel
        </button>
      </div>
    </div>
  );
}
