"use client";

import { useState } from "react";
import ActionAvatar from "@/components/listen/ActionAvatar";

const CARD_STYLE = { background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)" } as const;
const BUTTON_STYLE = { background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" } as const;

type ActionStatus = "idle" | "sending" | "done" | "dismissed" | "error";

export type FriendshipTarget = { id: string; name: string | null; avatarUrl: string | null };

// ACTION-INTENT-6 PART D: shared one-time/non-persistent confirm card for
// destructive friendship actions — extracted from UnfriendCard so Block can
// reuse the same idle->sending->done/dismissed/error machine and styling.
// POSTs { friendId, targetUserId, userId } (all set to the same id) so either
// /api/friends/remove (reads friendId) or /api/users/block (reads
// targetUserId/userId) works unchanged.
export default function FriendshipActionCard({
  friend,
  verb,
  endpoint,
  confirmText,
  sendingText,
  successText,
}: {
  friend: FriendshipTarget;
  verb: "Unfriend" | "Block";
  endpoint: string;
  confirmText?: string;
  sendingText?: string;
  successText?: string;
}) {
  const [status, setStatus] = useState<ActionStatus>("idle");

  async function confirm() {
    if (status === "sending" || status === "done") return;
    setStatus("sending");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ friendId: friend.id, targetUserId: friend.id, userId: friend.id }),
      });
      const data = await res.json();
      setStatus(data.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="text-xs text-green-400 mt-2">
        {successText ?? `✓ ${verb === "Block" ? "Blocked" : "Removed"} ${friend.name ?? "them"}.`}
      </p>
    );
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
          onClick={confirm}
          disabled={status === "sending"}
          className="text-xs px-2.5 py-1 rounded-lg disabled:opacity-50"
          style={BUTTON_STYLE}
        >
          {status === "sending" ? (sendingText ?? `${verb === "Block" ? "Blocking" : "Removing"}…`) : (confirmText ?? "Confirm")}
        </button>
        <button onClick={() => setStatus("dismissed")} className="text-xs text-gray-500 hover:text-gray-400">
          Cancel
        </button>
      </div>
    </div>
  );
}
