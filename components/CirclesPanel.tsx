"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X, UserPlus, Pencil, Trash2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Person = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  profile: { displayName: string | null } | null;
};

type CircleMember = { id: string; userId: string; addedAt: string; user: Person };

type Circle = {
  id: string;
  label: string;
  color: string;
  isDefault: boolean;
  members: CircleMember[];
};

type Friend = { id: string; name?: string | null; avatarUrl?: string | null };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  { key: "amber", bg: "bg-amber-500/20",  border: "border-amber-500/40",  dot: "bg-amber-400"  },
  { key: "teal",  bg: "bg-teal-500/20",   border: "border-teal-500/40",   dot: "bg-teal-400"   },
  { key: "blue",  bg: "bg-blue-500/20",   border: "border-blue-500/40",   dot: "bg-blue-400"   },
  { key: "rose",  bg: "bg-rose-500/20",   border: "border-rose-500/40",   dot: "bg-rose-400"   },
  { key: "violet",bg: "bg-violet-500/20", border: "border-violet-500/40", dot: "bg-violet-400" },
];

function colorClasses(color: string) {
  return COLOR_OPTIONS.find((c) => c.key === color) ?? COLOR_OPTIONS[2];
}

function displayName(p: Person): string {
  return p.profile?.displayName ?? p.name ?? "Unknown";
}

function Avatar({ src, name, size = 7 }: { src?: string | null; name: string; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full object-cover`;
  if (src) return <img src={src} alt={name} className={cls} />;
  return (
    <div className={`${cls} bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium`}>
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

// ─── Add-member modal ─────────────────────────────────────────────────────────

function AddMemberModal({
  circle,
  friends,
  onAdd,
  onClose,
}: {
  circle: Circle;
  friends: Friend[];
  onAdd: (circleId: string, userId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const existing = new Set(circle.members.map((m) => m.userId));
  const filtered = friends.filter((f) => {
    if (existing.has(f.id)) return false;
    const q = query.toLowerCase();
    return !q || (f.name ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Add to {circle.label}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <input
          autoFocus
          type="text"
          placeholder="Search friends…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30 mb-3"
        />

        <div className="space-y-1 max-h-56 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              {friends.length === 0 ? "No friends yet" : "No matches"}
            </p>
          )}
          {filtered.map((f) => (
            <button
              key={f.id}
              disabled={adding === f.id}
              onClick={async () => {
                setAdding(f.id);
                await onAdd(circle.id, f.id);
                setAdding(null);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left disabled:opacity-50"
            >
              <Avatar src={f.avatarUrl} name={f.name ?? "?"} size={8} />
              <span className="text-sm text-white flex-1">{f.name ?? "Unknown"}</span>
              <UserPlus className="w-4 h-4 text-gray-500" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── New-circle modal ─────────────────────────────────────────────────────────

function NewCircleModal({
  onCreate,
  onClose,
}: {
  onCreate: (label: string, color: string) => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("blue");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    await onCreate(label.trim(), color);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">New Circle</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="Circle name…"
            maxLength={40}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-white/30"
          />

          <div>
            <p className="text-xs text-gray-500 mb-2">Color</p>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setColor(c.key)}
                  className={`w-7 h-7 rounded-full ${c.dot} transition-transform ${color === c.key ? "scale-125 ring-2 ring-white/40" : "opacity-60 hover:opacity-100"}`}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!label.trim() || saving}
            className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors disabled:opacity-40"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Circle card ─────────────────────────────────────────────────────────────

function CircleCard({
  circle,
  onAddMember,
  onRemoveMember,
  onDelete,
  onRename,
}: {
  circle: Circle;
  onAddMember: (circle: Circle) => void;
  onRemoveMember: (circleId: string, userId: string) => Promise<void>;
  onDelete: (circleId: string) => Promise<void>;
  onRename: (circleId: string, newLabel: string) => Promise<void>;
}) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(circle.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const c = colorClasses(circle.color);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function saveLabel() {
    const trimmed = draftLabel.trim();
    if (trimmed && trimmed !== circle.label) {
      await onRename(circle.id, trimmed);
    } else {
      setDraftLabel(circle.label);
    }
    setEditing(false);
  }

  return (
    <div className={`relative flex-shrink-0 w-44 rounded-2xl border ${c.border} ${c.bg} p-4 flex flex-col gap-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
          {editing ? (
            <input
              ref={inputRef}
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={(e) => { if (e.key === "Enter") saveLabel(); if (e.key === "Escape") { setDraftLabel(circle.label); setEditing(false); } }}
              className="bg-transparent text-sm font-semibold text-white outline-none border-b border-white/30 w-full min-w-0"
              maxLength={40}
            />
          ) : (
            <span className="text-sm font-semibold text-white truncate">{circle.label}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="text-gray-600 hover:text-gray-300 transition-colors"
            title="Rename"
          >
            <Pencil className="w-3 h-3" />
          </button>
          {!circle.isDefault && (
            <button
              onClick={() => onDelete(circle.id)}
              className="text-gray-600 hover:text-rose-400 transition-colors"
              title="Delete circle"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="flex flex-col gap-2 flex-1">
        {circle.members.length === 0 && (
          <p className="text-xs text-gray-600 italic">No members yet</p>
        )}
        {circle.members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 group">
            <Avatar src={m.user.avatarUrl} name={displayName(m.user)} size={6} />
            <span className="text-xs text-gray-300 flex-1 truncate">{displayName(m.user)}</span>
            <button
              disabled={removing === m.userId}
              onClick={async () => {
                setRemoving(m.userId);
                await onRemoveMember(circle.id, m.userId);
                setRemoving(null);
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-rose-400 transition-all disabled:opacity-40"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Add member */}
      <button
        onClick={() => onAddMember(circle)}
        className="mt-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" />
        Add friend
      </button>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function CirclesPanel() {
  const [circles, setCircles]       = useState<Circle[]>([]);
  const [friends, setFriends]       = useState<Friend[]>([]);
  const [loading, setLoading]       = useState(true);
  const [addingTo, setAddingTo]     = useState<Circle | null>(null);
  const [showNew, setShowNew]       = useState(false);

  const loadAll = useCallback(async () => {
    const [circlesRes, friendsRes] = await Promise.all([
      fetch("/api/circles", { credentials: "include" }),
      fetch("/api/friends",  { credentials: "include" }),
    ]);
    const circlesData = await circlesRes.json();
    const friendsData = await friendsRes.json();

    if (circlesData.ok) setCircles(circlesData.circles);
    if (friendsData.ok) setFriends(friendsData.friends);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  async function handleAddMember(circleId: string, userId: string) {
    const res = await fetch(`/api/circles/${circleId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (data.ok) {
      setCircles((prev) =>
        prev.map((c) =>
          c.id === circleId ? { ...c, members: [...c.members, data.member] } : c
        )
      );
      // close modal if no more friends to add
      setAddingTo((prev) => prev ? { ...prev, members: [...prev.members, data.member] } : null);
    }
  }

  async function handleRemoveMember(circleId: string, userId: string) {
    const res = await fetch(`/api/circles/${circleId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setCircles((prev) =>
        prev.map((c) =>
          c.id === circleId ? { ...c, members: c.members.filter((m) => m.userId !== userId) } : c
        )
      );
    }
  }

  async function handleCreateCircle(label: string, color: string) {
    const res = await fetch("/api/circles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ label, color }),
    });
    const data = await res.json();
    if (data.ok) {
      setCircles((prev) => [...prev, data.circle]);
      setShowNew(false);
    }
  }

  async function handleDeleteCircle(circleId: string) {
    const res = await fetch(`/api/circles/${circleId}`, { method: "DELETE", credentials: "include" });
    if (res.ok) setCircles((prev) => prev.filter((c) => c.id !== circleId));
  }

  async function handleRenameCircle(circleId: string, newLabel: string) {
    const res = await fetch(`/api/circles/${circleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ label: newLabel }),
    });
    const data = await res.json();
    if (data.ok) {
      setCircles((prev) => prev.map((c) => (c.id === circleId ? data.circle : c)));
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="text-sm text-gray-500 py-4">Loading circles…</div>;

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-base font-semibold text-white mb-4">Friends</h2>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
          {circles.map((circle) => (
            <CircleCard
              key={circle.id}
              circle={circle}
              onAddMember={(c) => setAddingTo(c)}
              onRemoveMember={handleRemoveMember}
              onDelete={handleDeleteCircle}
              onRename={handleRenameCircle}
            />
          ))}

          {/* Add circle card */}
          <button
            onClick={() => setShowNew(true)}
            className="flex-shrink-0 w-44 rounded-2xl border border-dashed border-white/15 bg-transparent hover:bg-white/5 transition-colors flex flex-col items-center justify-center gap-2 py-8 text-gray-500 hover:text-gray-300"
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs">Add circle</span>
          </button>
        </div>
      </div>

      {addingTo && (
        <AddMemberModal
          circle={addingTo}
          friends={friends}
          onAdd={handleAddMember}
          onClose={() => setAddingTo(null)}
        />
      )}

      {showNew && (
        <NewCircleModal
          onCreate={handleCreateCircle}
          onClose={() => setShowNew(false)}
        />
      )}
    </>
  );
}
