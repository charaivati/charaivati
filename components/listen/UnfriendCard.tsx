"use client";

import { useState } from "react";
import type { ListenAction } from "@/lib/listener/actionTypes";
import ActionAvatar from "@/components/listen/ActionAvatar";

const CARD_STYLE = { background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)" } as const;
const BUTTON_STYLE = { background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" } as const;

type RemoveStatus = "idle" | "sending" | "removed" | "dismissed" | "error";

type Friend = { id: string; name: string | null; avatarUrl: string | null };

// UNFRIEND-1: renders the unfriend action — "unfriend_confirm" (Yes/No,
// one-time, not persistent), "unfriend_pick" (choose among same-named
// friends, then confirm), and "unfriend_not_found" (nothing to render —
// reply text already covers it). Confirm reuses the existing
// POST /api/friends/remove (UNFRIEND-1 audit: reused, not new).
export default function UnfriendCard({ action }: { action: ListenAction }) {
  const [picked, setPicked] = useState<Friend | null>(null);

  if (action.type === "unfriend_not_found") return null;
  if (action.type !== "unfriend_confirm" && action.type !== "unfriend_pick") return null;

  if (action.type === "unfriend_pick" && !picked) {
    return (
      <div className="mt-2 flex flex-col gap-1 rounded-xl px-3 py-2.5" style={CARD_STYLE}>
        {action.candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => setPicked(c)}
            className="text-left text-sm text-gray-100 hover:text-indigo-300 flex items-center gap-2 py-1"
          >
            <ActionAvatar name={c.name} url={c.avatarUrl} size={7} />
            {c.name ?? "Unnamed"}
          </button>
        ))}
      </div>
    );
  }

  const friend: Friend | null = action.type === "unfriend_confirm" ? action.friend : picked;
  if (!friend) return null;

  return <ConfirmUnfriend friend={friend} />;
}

function ConfirmUnfriend({ friend }: { friend: Friend }) {
  const [status, setStatus] = useState<RemoveStatus>("idle");

  async function confirmRemove() {
    if (status === "sending" || status === "removed") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/friends/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ friendId: friend.id }),
      });
      const data = await res.json();
      setStatus(data.ok ? "removed" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "removed") {
    return <p className="text-xs text-green-400 mt-2">✓ Removed {friend.name ?? "them"} from friends.</p>;
  }
  if (status === "dismissed") {
    return <p className="text-xs text-gray-500 mt-2">Okay, not now.</p>;
  }

  return (
    <div className="mt-2 rounded-xl px-3 py-2.5 flex items-center gap-3" style={CARD_STYLE}>
      <ActionAvatar name={friend.name} url={friend.avatarUrl} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-100 truncate">{friend.name ?? "Unnamed"}</p>
        {status === "error" && <p className="text-xs text-red-400">Something went wrong — try again.</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0 items-center">
        <button
          onClick={confirmRemove}
          disabled={status === "sending"}
          className="text-xs px-2.5 py-1 rounded-lg disabled:opacity-50"
          style={BUTTON_STYLE}
        >
          {status === "sending" ? "Removing…" : "Confirm"}
        </button>
        <button onClick={() => setStatus("dismissed")} className="text-xs text-gray-500 hover:text-gray-400">
          Cancel
        </button>
      </div>
    </div>
  );
}
