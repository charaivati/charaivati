"use client";

import { useState } from "react";
import type { ListenAction } from "@/lib/listener/actionTypes";
import ActionAvatar from "@/components/listen/ActionAvatar";
import FriendshipActionCard, { type FriendshipTarget } from "@/components/listen/FriendshipActionCard";

const CARD_STYLE = { background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)" } as const;

// ACTION-INTENT-6 PART D: renders the block action — "block_confirm" (Yes/No,
// one-time, not persistent), "block_pick" (choose among same-named
// candidates — friends OR non-friends, then confirm), and "block_not_found"
// (nothing to render — reply text already covers it). Confirm calls
// POST /api/users/block via the shared FriendshipActionCard.
export default function BlockCard({ action }: { action: ListenAction }) {
  const [picked, setPicked] = useState<FriendshipTarget | null>(null);

  if (action.type === "block_not_found") return null;
  if (action.type !== "block_confirm" && action.type !== "block_pick") return null;

  if (action.type === "block_pick" && !picked) {
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

  const target: FriendshipTarget | null = action.type === "block_confirm" ? action.target : picked;
  if (!target) return null;

  return (
    <FriendshipActionCard
      friend={target}
      verb="Block"
      endpoint="/api/users/block"
      successText={`✓ Blocked ${target.name ?? "them"}.`}
    />
  );
}
