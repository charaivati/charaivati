"use client";

import { useState } from "react";
import type { FriendCandidate, ListenAction } from "@/lib/listener/actionTypes";
import ActionAvatar from "@/components/listen/ActionAvatar";

const CARD_STYLE = { background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)" } as const;
const BUTTON_STYLE = { background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" } as const;

type SendStatus = "idle" | "sending" | "sent" | "error";

// PRIV-ACT-1: renders up to 5 person cards for a friend-search action.
// "friend_search_empty" has no cards — its reply text already says so.
export default function FriendSearchCards({ action }: { action: ListenAction }) {
  const [statuses, setStatuses] = useState<Record<string, SendStatus>>({});
  const [dismissed, setDismissed] = useState(false);

  if (action.type !== "friend_search") return null;

  if (dismissed) {
    return <p className="text-xs text-gray-500 mt-2">Okay — let me know if you&apos;d like to try a different name.</p>;
  }

  async function sendRequest(id: string) {
    if (statuses[id] === "sending" || statuses[id] === "sent") return;
    setStatuses((s) => ({ ...s, [id]: "sending" }));
    try {
      const res = await fetch("/api/listen/actions/friend-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUserId: id }),
      });
      const data = await res.json();
      setStatuses((s) => ({ ...s, [id]: data.ok ? "sent" : "error" }));
    } catch {
      setStatuses((s) => ({ ...s, [id]: "error" }));
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {action.results.map((person) => (
        <PersonCard
          key={person.id}
          person={person}
          status={statuses[person.id] ?? "idle"}
          onSend={() => sendRequest(person.id)}
        />
      ))}
      <button onClick={() => setDismissed(true)} className="text-xs text-gray-500 text-left hover:text-gray-400">
        None of these
      </button>
    </div>
  );
}

function PersonCard({
  person,
  status,
  onSend,
}: {
  person: FriendCandidate;
  status: SendStatus;
  onSend: () => void;
}) {
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-3" style={CARD_STYLE}>
      <ActionAvatar name={person.name} url={person.avatarUrl} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-100 truncate">{person.name ?? "Unnamed"}</p>
        {person.location && <p className="text-xs text-gray-500 truncate">{person.location}</p>}
      </div>
      <div className="flex-shrink-0">
        {person.relationship === "friends" && <span className="text-xs text-green-400">Friends</span>}
        {person.relationship === "outgoing" && <span className="text-xs text-gray-500">Request sent</span>}
        {person.relationship === "incoming" && <span className="text-xs text-gray-500">Pending your reply</span>}
        {person.relationship === "none" && status === "sent" && <span className="text-xs text-green-400">✓ Sent</span>}
        {person.relationship === "none" && status === "error" && (
          <button onClick={onSend} className="text-xs text-red-400 hover:text-red-300">
            Failed — retry
          </button>
        )}
        {person.relationship === "none" && (status === "idle" || status === "sending") && (
          <button
            onClick={onSend}
            disabled={status === "sending"}
            className="text-xs px-2.5 py-1 rounded-lg disabled:opacity-50"
            style={BUTTON_STYLE}
          >
            {status === "sending" ? "Sending…" : "Add friend"}
          </button>
        )}
      </div>
    </div>
  );
}
