"use client";

import { useEffect, useRef, useState } from "react";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

type BoardMember = {
  id: string;
  userId: string;
  role: string | null;
  user: { id: string; name: string | null; avatarUrl: string | null };
};

type MemberUser = { id: string; name: string | null; avatarUrl: string | null };
type MemberGroup = { id: string; name: string; logoUrl: string | null; pageId: string };

type Membership = {
  id: string;
  status: string;
  requestedAt: string;
  memberUser: MemberUser | null;
  memberGroup: MemberGroup | null;
};

type Milestone = { id: string; title: string; status: string; createdAt: string };
type Meeting = { id: string; title: string; date: string; location: string | null; link: string | null };

type Group = {
  id: string;
  name: string;
  logoUrl: string | null;
  objective: string | null;
  boardMembers: BoardMember[];
  memberships: Membership[];
  milestones: Milestone[];
  meetings: Meeting[];
};

type UserSearchResult = { id: string; name: string | null; email: string | null; avatarUrl: string | null };

export default function CommunityGroupStudio({ pageId }: { pageId: string }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [pendingMemberships, setPendingMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Header edit state
  const [editName, setEditName] = useState("");
  const [editObjective, setEditObjective] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Board member add
  const [boardQuery, setBoardQuery] = useState("");
  const [boardResults, setBoardResults] = useState<UserSearchResult[]>([]);
  const [boardRole, setBoardRole] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [addingBoard, setAddingBoard] = useState(false);

  // Milestone add
  const [msTitle, setMsTitle] = useState("");
  const [addingMs, setAddingMs] = useState(false);

  // Meeting add
  const [mtTitle, setMtTitle] = useState("");
  const [mtDate, setMtDate] = useState("");
  const [mtLocation, setMtLocation] = useState("");
  const [mtLink, setMtLink] = useState("");
  const [addingMt, setAddingMt] = useState(false);
  const [showMeetingForm, setShowMeetingForm] = useState(false);

  useEffect(() => {
    loadGroup();
  }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadGroup() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/community-group/by-page/${pageId}`, { credentials: "include" });
      if (!res.ok) { setError("Failed to load group"); return; }
      const data = await res.json();
      setGroup(data.group);
      setPendingMemberships(data.pendingMemberships ?? []);
      setEditName(data.group.name ?? "");
      setEditObjective(data.group.objective ?? "");
    } catch {
      setError("Failed to load group");
    } finally {
      setLoading(false);
    }
  }

  async function uploadLogo(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    fd.append("folder", "community_logos");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
    const data = await res.json();
    return data.secure_url as string;
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !group) return;
    setLogoUploading(true);
    try {
      const url = await uploadLogo(file);
      await fetch(`/api/community-group/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ logoUrl: url }),
      });
      setGroup((g) => g ? { ...g, logoUrl: url } : g);
    } finally {
      setLogoUploading(false);
    }
  }

  async function saveHeader() {
    if (!group) return;
    setSavingHeader(true);
    try {
      await fetch(`/api/community-group/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editName, objective: editObjective }),
      });
      setGroup((g) => g ? { ...g, name: editName, objective: editObjective } : g);
    } finally {
      setSavingHeader(false);
    }
  }

  async function searchUsers(q: string) {
    if (!q.trim()) { setBoardResults([]); return; }
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setBoardResults(data.users ?? data ?? []);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(boardQuery), 300);
    return () => clearTimeout(timer);
  }, [boardQuery]);

  async function addBoardMember() {
    if (!group || !selectedUser) return;
    setAddingBoard(true);
    try {
      const res = await fetch(`/api/community-group/${group.id}/board`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: selectedUser.id, role: boardRole || null }),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup((g) => g ? { ...g, boardMembers: [...g.boardMembers.filter((b) => b.userId !== selectedUser.id), data.member] } : g);
        setSelectedUser(null); setBoardQuery(""); setBoardRole(""); setBoardResults([]);
      }
    } finally {
      setAddingBoard(false);
    }
  }

  async function removeBoardMember(memberId: string) {
    if (!group) return;
    await fetch(`/api/community-group/${group.id}/board/${memberId}`, { method: "DELETE", credentials: "include" });
    setGroup((g) => g ? { ...g, boardMembers: g.boardMembers.filter((b) => b.id !== memberId) } : g);
  }

  async function approveMembership(membershipId: string) {
    if (!group) return;
    const res = await fetch(`/api/community-group/${group.id}/membership/${membershipId}/approve`, {
      method: "POST", credentials: "include",
    });
    const data = await res.json();
    if (data.ok) {
      const approved = pendingMemberships.find((m) => m.id === membershipId);
      if (approved) {
        setPendingMemberships((p) => p.filter((m) => m.id !== membershipId));
        setGroup((g) => g ? { ...g, memberships: [...g.memberships, { ...approved, status: "approved" }] } : g);
      }
    }
  }

  async function rejectMembership(membershipId: string) {
    if (!group) return;
    await fetch(`/api/community-group/${group.id}/membership/${membershipId}`, { method: "DELETE", credentials: "include" });
    setPendingMemberships((p) => p.filter((m) => m.id !== membershipId));
  }

  async function removeMembership(membershipId: string) {
    if (!group) return;
    await fetch(`/api/community-group/${group.id}/membership/${membershipId}`, { method: "DELETE", credentials: "include" });
    setGroup((g) => g ? { ...g, memberships: g.memberships.filter((m) => m.id !== membershipId) } : g);
  }

  async function addMilestone() {
    if (!group || !msTitle.trim()) return;
    setAddingMs(true);
    try {
      const res = await fetch(`/api/community-group/${group.id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: msTitle }),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup((g) => g ? { ...g, milestones: [...g.milestones, data.milestone] } : g);
        setMsTitle("");
      }
    } finally {
      setAddingMs(false);
    }
  }

  async function toggleMilestone(id: string, currentStatus: string) {
    if (!group) return;
    const newStatus = currentStatus === "achieved" ? "pending" : "achieved";
    const res = await fetch(`/api/community-group/${group.id}/milestones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (data.ok) {
      setGroup((g) => g ? { ...g, milestones: g.milestones.map((m) => m.id === id ? { ...m, status: newStatus } : m) } : g);
    }
  }

  async function deleteMilestone(id: string) {
    if (!group) return;
    await fetch(`/api/community-group/${group.id}/milestones/${id}`, { method: "DELETE", credentials: "include" });
    setGroup((g) => g ? { ...g, milestones: g.milestones.filter((m) => m.id !== id) } : g);
  }

  async function addMeeting() {
    if (!group || !mtTitle.trim() || !mtDate) return;
    setAddingMt(true);
    try {
      const res = await fetch(`/api/community-group/${group.id}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: mtTitle, date: mtDate, location: mtLocation || null, link: mtLink || null }),
      });
      const data = await res.json();
      if (data.ok) {
        setGroup((g) => g ? { ...g, meetings: [...g.meetings, data.meeting].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) } : g);
        setMtTitle(""); setMtDate(""); setMtLocation(""); setMtLink("");
        setShowMeetingForm(false);
      }
    } finally {
      setAddingMt(false);
    }
  }

  async function deleteMeeting(id: string) {
    if (!group) return;
    await fetch(`/api/community-group/${group.id}/meetings/${id}`, { method: "DELETE", credentials: "include" });
    setGroup((g) => g ? { ...g, meetings: g.meetings.filter((m) => m.id !== id) } : g);
  }

  if (loading) return <div className="text-gray-400 text-sm py-8 text-center">Loading…</div>;
  if (error || !group) return <div className="text-red-400 text-sm py-8 text-center">{error ?? "Group not found."}</div>;

  const approvedUsers = group.memberships.filter((m) => m.memberUser);
  const approvedGroups = group.memberships.filter((m) => m.memberGroup);
  const upcomingMeetings = group.meetings.filter((m) => new Date(m.date) >= new Date());

  return (
    <div className="space-y-8">

      {/* ── Header ── */}
      <section className="p-5 rounded-2xl border border-sky-800/50 bg-sky-900/10 space-y-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={logoUploading}
            className="w-16 h-16 rounded-xl overflow-hidden border border-gray-700 flex-shrink-0 bg-gray-800 flex items-center justify-center hover:border-sky-500 transition-colors"
            title="Upload logo"
          >
            {group.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.logoUrl} alt="logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-500 text-xs text-center leading-tight px-1">
                {logoUploading ? "…" : "Logo"}
              </span>
            )}
          </button>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />

          <div className="flex-1 space-y-2">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Group name"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-base font-semibold focus:border-sky-500 focus:outline-none"
            />
            <input
              value={editObjective}
              onChange={(e) => setEditObjective(e.target.value)}
              placeholder="Short objective (optional)"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <a
            href={`/community/${pageId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sky-400 hover:underline"
          >
            View public page ↗
          </a>
          <button
            onClick={saveHeader}
            disabled={savingHeader || !editName.trim()}
            className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {savingHeader ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      {/* ── Board Members ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Board Members</h2>

        {group.boardMembers.length > 0 && (
          <div className="space-y-2">
            {group.boardMembers.map((bm) => (
              <div key={bm.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800">
                <div className="w-8 h-8 rounded-full bg-sky-900 flex items-center justify-center text-sky-300 text-xs font-bold flex-shrink-0 overflow-hidden">
                  {bm.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={bm.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (bm.user.name?.[0] ?? "?").toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{bm.user.name ?? "Unknown"}</p>
                  {bm.role && <p className="text-xs text-gray-400">{bm.role}</p>}
                </div>
                <button
                  onClick={() => removeBoardMember(bm.id)}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add board member */}
        <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-3">
          <p className="text-xs font-semibold text-gray-400">Add board member</p>
          <div className="relative">
            <input
              value={selectedUser ? `${selectedUser.name ?? selectedUser.email ?? selectedUser.id}` : boardQuery}
              onChange={(e) => { setSelectedUser(null); setBoardQuery(e.target.value); }}
              placeholder="Search by name or email…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-sky-500 focus:outline-none"
            />
            {boardResults.length > 0 && !selectedUser && (
              <div className="absolute left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                {boardResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setSelectedUser(u); setBoardQuery(""); setBoardResults([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm text-white flex items-center gap-2"
                  >
                    <span className="w-6 h-6 rounded-full bg-gray-600 flex-shrink-0 overflow-hidden">
                      {u.avatarUrl && <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />}
                    </span>
                    <span>{u.name ?? u.email ?? u.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            value={boardRole}
            onChange={(e) => setBoardRole(e.target.value)}
            placeholder="Role (e.g. Secretary)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-sky-500 focus:outline-none"
          />
          <button
            onClick={addBoardMember}
            disabled={addingBoard || !selectedUser}
            className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {addingBoard ? "Adding…" : "Add"}
          </button>
        </div>
      </section>

      {/* ── Members ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Members</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Sub-groups */}
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-2">
            <p className="text-xs font-semibold text-gray-400">Sub-groups ({approvedGroups.length})</p>
            {approvedGroups.length === 0 ? (
              <p className="text-xs text-gray-500">No sub-groups yet.</p>
            ) : (
              approvedGroups.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm text-white">
                  <span className="flex-1 truncate">{m.memberGroup!.name}</span>
                  <button onClick={() => removeMembership(m.id)} className="text-gray-500 hover:text-red-400 text-xs">Remove</button>
                </div>
              ))
            )}
          </div>

          {/* Individuals */}
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-2">
            <p className="text-xs font-semibold text-gray-400">Individuals ({approvedUsers.length})</p>
            {approvedUsers.length === 0 ? (
              <p className="text-xs text-gray-500">No members yet.</p>
            ) : (
              approvedUsers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm text-white">
                  <span className="flex-1 truncate">{m.memberUser!.name ?? "Unknown"}</span>
                  <button onClick={() => removeMembership(m.id)} className="text-gray-500 hover:text-red-400 text-xs">Remove</button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending requests */}
        {pendingMemberships.length > 0 && (
          <div className="p-4 rounded-xl border border-amber-800/40 bg-amber-900/10 space-y-2">
            <p className="text-xs font-semibold text-amber-400">Pending requests ({pendingMemberships.length})</p>
            {pendingMemberships.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-white truncate">
                  {m.memberUser?.name ?? m.memberGroup?.name ?? "Unknown"}
                </span>
                <button
                  onClick={() => approveMembership(m.id)}
                  className="px-2 py-1 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectMembership(m.id)}
                  className="px-2 py-1 rounded-md bg-gray-800 hover:bg-red-900 text-gray-300 text-xs font-medium transition-colors"
                >
                  Reject
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Milestones ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Milestones</h2>

        {group.milestones.map((ms) => (
          <div key={ms.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800">
            <button
              onClick={() => toggleMilestone(ms.id, ms.status)}
              className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${ms.status === "achieved" ? "bg-emerald-500 border-emerald-500" : "border-gray-600 hover:border-emerald-400"}`}
            />
            <span className={`flex-1 text-sm ${ms.status === "achieved" ? "line-through text-gray-500" : "text-white"}`}>{ms.title}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${ms.status === "achieved" ? "bg-emerald-900/50 text-emerald-300" : "bg-gray-800 text-gray-400"}`}>
              {ms.status === "achieved" ? "Achieved" : "Pending"}
            </span>
            <button onClick={() => deleteMilestone(ms.id)} className="text-gray-600 hover:text-red-400 text-xs transition-colors">✕</button>
          </div>
        ))}

        <div className="flex gap-2">
          <input
            value={msTitle}
            onChange={(e) => setMsTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMilestone()}
            placeholder="New milestone…"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-sky-500 focus:outline-none"
          />
          <button
            onClick={addMilestone}
            disabled={addingMs || !msTitle.trim()}
            className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>
      </section>

      {/* ── Meetings ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Upcoming Meetings</h2>
          <button
            onClick={() => setShowMeetingForm((v) => !v)}
            className="text-xs text-sky-400 hover:underline"
          >
            {showMeetingForm ? "Cancel" : "+ Add meeting"}
          </button>
        </div>

        {upcomingMeetings.length === 0 && !showMeetingForm && (
          <p className="text-sm text-gray-500">No upcoming meetings.</p>
        )}

        {upcomingMeetings.map((mt) => (
          <div key={mt.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800">
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-white">{mt.title}</p>
              <p className="text-xs text-gray-400">{new Date(mt.date).toLocaleString()}</p>
              {mt.location && <p className="text-xs text-gray-500">📍 {mt.location}</p>}
              {mt.link && (
                <a href={mt.link} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:underline block truncate">
                  🔗 {mt.link}
                </a>
              )}
            </div>
            <button onClick={() => deleteMeeting(mt.id)} className="text-gray-600 hover:text-red-400 text-xs transition-colors flex-shrink-0">✕</button>
          </div>
        ))}

        {showMeetingForm && (
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-3">
            <input
              value={mtTitle}
              onChange={(e) => setMtTitle(e.target.value)}
              placeholder="Meeting title"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-sky-500 focus:outline-none"
            />
            <input
              type="datetime-local"
              value={mtDate}
              onChange={(e) => setMtDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-sky-500 focus:outline-none"
            />
            <input
              value={mtLocation}
              onChange={(e) => setMtLocation(e.target.value)}
              placeholder="Location (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-sky-500 focus:outline-none"
            />
            <input
              value={mtLink}
              onChange={(e) => setMtLink(e.target.value)}
              placeholder="Link (optional)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-sky-500 focus:outline-none"
            />
            <button
              onClick={addMeeting}
              disabled={addingMt || !mtTitle.trim() || !mtDate}
              className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {addingMt ? "Saving…" : "Save Meeting"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
