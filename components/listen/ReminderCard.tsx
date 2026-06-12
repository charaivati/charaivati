"use client";

import { useState } from "react";
import type { ListenAction } from "@/lib/listener/actionTypes";
import ActionAvatar from "@/components/listen/ActionAvatar";

const CARD_STYLE = { background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.25)" } as const;
const BUTTON_STYLE = { background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" } as const;

type SendStatus = "idle" | "sending" | "sent" | "dismissed" | "error";

type Recipient = { id: string; name: string | null; avatarUrl: string | null };

// PRIV-ACT-1: renders the reminder action — "reminder_confirm" (Yes/No),
// "reminder_pick" (choose among same-named friends, then confirm),
// "reminder_non_friend" (offer a friend request instead), and
// "reminder_not_found" (nothing to render — reply text already covers it).
export default function ReminderCard({ action }: { action: ListenAction }) {
  const [picked, setPicked] = useState<Recipient | null>(null);

  if (action.type === "reminder_not_found") return null;
  if (action.type === "friend_search" || action.type === "friend_search_empty") return null;

  if (action.type === "reminder_pick" && !picked) {
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

  if (action.type === "reminder_non_friend") {
    return <NonFriendCard action={action} />;
  }

  const recipient: Recipient | null = action.type === "reminder_confirm" ? action.recipient : picked;
  if (!recipient) return null;

  return <ConfirmReminder recipient={recipient} text={action.text} />;
}

function ConfirmReminder({ recipient, text }: { recipient: Recipient; text: string }) {
  const [status, setStatus] = useState<SendStatus>("idle");

  async function send() {
    if (status === "sending" || status === "sent") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/listen/actions/reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientUserId: recipient.id, text }),
      });
      const data = await res.json();
      setStatus(data.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <p className="text-xs text-green-400 mt-2">✓ Reminder sent to {recipient.name ?? "them"}.</p>;
  }
  if (status === "dismissed") {
    return <p className="text-xs text-gray-500 mt-2">Okay, not now.</p>;
  }

  return (
    <div className="mt-2 rounded-xl px-3 py-2.5" style={CARD_STYLE}>
      <p className="text-sm text-gray-200 mb-2">
        &ldquo;{text}&rdquo; → <span className="text-indigo-300">{recipient.name ?? "them"}</span>
      </p>
      {status === "error" && <p className="text-xs text-red-400 mb-2">Something went wrong — try again.</p>}
      <div className="flex gap-2">
        <button
          onClick={send}
          disabled={status === "sending"}
          className="text-xs px-2.5 py-1 rounded-lg disabled:opacity-50"
          style={BUTTON_STYLE}
        >
          {status === "sending" ? "Sending…" : "Send"}
        </button>
        <button onClick={() => setStatus("dismissed")} className="text-xs text-gray-500 hover:text-gray-400">
          No thanks
        </button>
      </div>
    </div>
  );
}

function NonFriendCard({ action }: { action: Extract<ListenAction, { type: "reminder_non_friend" }> }) {
  const [status, setStatus] = useState<SendStatus>("idle");

  async function sendFriendRequest() {
    if (status === "sending" || status === "sent") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/listen/actions/friend-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUserId: action.candidate.id }),
      });
      const data = await res.json();
      setStatus(data.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <p className="text-xs text-green-400 mt-2">✓ Friend request sent to {action.candidate.name ?? "them"}.</p>;
  }
  if (status === "dismissed") {
    return <p className="text-xs text-gray-500 mt-2">Okay, not now.</p>;
  }

  return (
    <div className="mt-2 rounded-xl px-3 py-2.5 flex items-center gap-3" style={CARD_STYLE}>
      <ActionAvatar name={action.candidate.name} url={action.candidate.avatarUrl} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-100 truncate">{action.candidate.name ?? "Unnamed"}</p>
        {action.candidate.location && <p className="text-xs text-gray-500 truncate">{action.candidate.location}</p>}
      </div>
      <div className="flex gap-2 flex-shrink-0 items-center">
        {status === "error" && <span className="text-xs text-red-400">Failed</span>}
        <button
          onClick={sendFriendRequest}
          disabled={status === "sending"}
          className="text-xs px-2.5 py-1 rounded-lg disabled:opacity-50"
          style={BUTTON_STYLE}
        >
          {status === "sending" ? "Sending…" : "Send friend request"}
        </button>
        <button onClick={() => setStatus("dismissed")} className="text-xs text-gray-500 hover:text-gray-400">
          No
        </button>
      </div>
    </div>
  );
}
