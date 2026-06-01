"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type OwnerUser = { id: string; name: string | null; email: string | null } | null;
type MemberPage = {
  id: string;
  title: string;
  avatarUrl: string | null;
  ownerId: string | null;
  owner: OwnerUser;
};
type FriendUser = { id: string; name: string | null; avatarUrl: string | null };

type TeamMember = {
  id: string;
  requesterId: string;
  receiverPageId: string | null;
  receiverUserId: string | null;
  teamRole: string | null;
  customRole: string | null;
  requester: MemberPage;
  receiverPage: MemberPage | null;
  receiverUser: FriendUser | null;
};

type PartnerCollab = {
  id: string;
  requesterId: string;
  role: string;
  requester:    { id: string; title: string; avatarUrl: string | null };
  receiverPage: { id: string; title: string; avatarUrl: string | null } | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TEAM_ROLES = [
  { value: "founder",    label: "Founder" },
  { value: "co_founder", label: "Co-founder" },
  { value: "ceo",        label: "CEO" },
  { value: "partner",    label: "Partner" },
  { value: "employee",   label: "Employee" },
  { value: "custom",     label: "Custom" },
] as const;

type TeamRoleValue = typeof TEAM_ROLES[number]["value"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function teamRoleLabel(teamRole: string | null, customRole: string | null): string {
  if (teamRole === "custom") return customRole?.trim() || "Custom";
  return TEAM_ROLES.find((r) => r.value === teamRole)?.label ?? teamRole ?? "Member";
}

function teamRolePill(teamRole: string | null): string {
  switch (teamRole) {
    case "founder":    return "bg-amber-900/50 text-amber-300 border border-amber-700";
    case "co_founder": return "bg-indigo-900/50 text-indigo-300 border border-indigo-700";
    case "ceo":        return "bg-purple-900/50 text-purple-300 border border-purple-700";
    case "partner":    return "bg-emerald-900/50 text-emerald-300 border border-emerald-700";
    case "employee":   return "bg-gray-800 text-gray-300 border border-gray-700";
    default:           return "bg-gray-800 text-gray-400 border border-gray-700";
  }
}

function getMemberDisplay(
  member: TeamMember,
  pageId: string
): { title: string; avatarUrl: string | null; subtitle: string | null } {
  if (member.receiverUserId && member.receiverUser) {
    return {
      title:    member.receiverUser.name ?? "User",
      avatarUrl: member.receiverUser.avatarUrl,
      subtitle: null,
    };
  }
  const page = member.requesterId === pageId ? member.receiverPage : member.requester;
  if (!page) return { title: "Unknown", avatarUrl: null, subtitle: null };
  return {
    title:    page.title,
    avatarUrl: page.avatarUrl,
    subtitle: page.owner?.name ?? null,
  };
}

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
  );
}

function Avatar({ title, avatarUrl }: { title: string; avatarUrl: string | null }) {
  const initials = title.slice(0, 2).toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={title}
        className="w-10 h-10 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-indigo-300">{initials}</span>
    </div>
  );
}

// ── TeamTab ───────────────────────────────────────────────────────────────────

interface TeamTabProps {
  pageId: string;
  canEdit: boolean;
}

export default function TeamTab({ pageId, canEdit }: TeamTabProps) {
  const [members,   setMembers]   = useState<TeamMember[]>([]);
  const [partners,  setPartners]  = useState<PartnerCollab[]>([]);
  const [friends,   setFriends]   = useState<FriendUser[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [actioning, setActioning] = useState<Set<string>>(new Set());
  const [flash,     setFlash]     = useState<{ msg: string; ok: boolean } | null>(null);

  // Modal state
  const [showModal,      setShowModal]      = useState(false);
  const [inviteTab,      setInviteTab]      = useState<"partners" | "friends">("partners");
  const [selectedCollab, setSelectedCollab] = useState("");
  const [selectedFriend, setSelectedFriend] = useState("");
  const [friendSearch,   setFriendSearch]   = useState("");
  const [selectedRole,   setSelectedRole]   = useState<TeamRoleValue>("employee");
  const [customRoleText, setCustomRoleText] = useState("");
  const [submitting,     setSubmitting]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/initiative/${pageId}/team`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMembers(data.members  ?? []);
      setPartners(data.partners ?? []);
      setFriends(data.friends  ?? []);
    } catch {
      setError("Failed to load team.");
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => { load(); }, [load]);

  function showFlash(msg: string, ok: boolean) {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  }

  function setActioned(id: string, on: boolean) {
    setActioning((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function handleRemove(member: TeamMember) {
    setActioned(member.id, true);
    try {
      let res: Response;
      if (member.receiverUserId) {
        // User-type collab: DELETE the record entirely
        res = await fetch(`/api/initiative/${pageId}/team/${member.id}`, {
          method: "DELETE",
          credentials: "include",
        });
      } else {
        // Page-type collab: demote back to partner scope
        res = await fetch(`/api/initiative/${pageId}/team/${member.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope: "partner", teamRole: null, customRole: null, initiativeId: null,
          }),
        });
      }
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
        showFlash("Member removed from team", true);
      } else {
        showFlash("Failed to remove member", false);
      }
    } catch {
      showFlash("Failed to remove member", false);
    } finally {
      setActioned(member.id, false);
    }
  }

  async function handleInvitePartner() {
    if (!selectedCollab) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/initiative/${pageId}/team/${selectedCollab}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope:        "team",
          teamRole:     selectedRole,
          customRole:   selectedRole === "custom" ? customRoleText.trim() || null : null,
          initiativeId: pageId,
        }),
      });
      if (res.ok) {
        closeModal();
        await load();
        showFlash("Team member added", true);
      } else {
        const d = await res.json().catch(() => ({}));
        showFlash((d as { error?: string }).error ?? "Failed to add member", false);
      }
    } catch {
      showFlash("Failed to add member", false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInviteFriend() {
    if (!selectedFriend) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/initiative/${pageId}/team/invite-user`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId:     selectedFriend,
          teamRole:   selectedRole,
          customRole: selectedRole === "custom" ? customRoleText.trim() || null : null,
        }),
      });
      if (res.ok) {
        closeModal();
        await load();
        showFlash("Team member added", true);
      } else {
        const d = await res.json().catch(() => ({}));
        showFlash((d as { error?: string }).error ?? "Failed to add member", false);
      }
    } catch {
      showFlash("Failed to add member", false);
    } finally {
      setSubmitting(false);
    }
  }

  function openModal() {
    // Default to the tab that has something available
    setInviteTab(availablePartners.length > 0 ? "partners" : "friends");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSelectedCollab("");
    setSelectedFriend("");
    setFriendSearch("");
    setInviteTab("partners");
    setSelectedRole("employee");
    setCustomRoleText("");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-gray-600">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-red-900/40 bg-red-900/10 text-red-400 text-sm flex items-center gap-3">
        {error}
        <button onClick={load} className="underline text-red-300 shrink-0">Retry</button>
      </div>
    );
  }

  const memberCollabIds  = new Set(members.map((m) => m.id));
  const availablePartners = partners.filter((p) => !memberCollabIds.has(p.id));
  const canInvite        = availablePartners.length > 0 || friends.length > 0;

  const filteredFriends = friendSearch
    ? friends.filter((f) =>
        (f.name ?? "").toLowerCase().includes(friendSearch.toLowerCase())
      )
    : friends;

  return (
    <div className="space-y-4">
      {flash && (
        <div className={`text-sm px-3 py-2 rounded-lg border ${
          flash.ok
            ? "bg-emerald-900/40 border-emerald-800/50 text-emerald-300"
            : "bg-red-900/40 border-red-800/50 text-red-300"
        }`}>
          {flash.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
          Team Members ({members.length})
        </p>
        {canEdit && (
          <button
            onClick={openModal}
            disabled={!canInvite}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Invite Member
          </button>
        )}
      </div>

      {/* Empty state */}
      {members.length === 0 && (
        <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/40 text-center text-sm text-gray-500">
          No team members yet.
          {canEdit && !canInvite && (
            <p className="text-xs mt-1 text-gray-600">
              Connect partners or add friends first to invite team members.
            </p>
          )}
        </div>
      )}

      {/* Member cards */}
      {members.length > 0 && (
        <div className="space-y-2">
          {members.map((member) => {
            const display = getMemberDisplay(member, pageId);
            const isBusy  = actioning.has(member.id);

            return (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-800 bg-gray-900/60"
              >
                <Avatar title={display.title} avatarUrl={display.avatarUrl} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{display.title}</p>
                  {display.subtitle && (
                    <p className="text-xs text-gray-400 truncate">{display.subtitle}</p>
                  )}
                  <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${teamRolePill(member.teamRole)}`}>
                    {teamRoleLabel(member.teamRole, member.customRole)}
                  </span>
                </div>

                {/* Remove — not available for founders or when read-only */}
                {canEdit && member.teamRole !== "founder" && (
                  <button
                    onClick={() => handleRemove(member)}
                    disabled={isBusy}
                    className="p-1 text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50 shrink-0"
                    aria-label="Remove member"
                  >
                    {isBusy ? <Spinner /> : "✕"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-gray-900 rounded-2xl w-full max-w-sm mx-4 p-6 border border-gray-700 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Invite Team Member</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-gray-800 mb-4 -mx-6 px-6">
              <button
                onClick={() => setInviteTab("partners")}
                className={`text-sm pb-2 mr-5 font-medium transition-colors ${
                  inviteTab === "partners"
                    ? "text-white border-b-2 border-indigo-500"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                From Partners
              </button>
              <button
                onClick={() => setInviteTab("friends")}
                className={`text-sm pb-2 font-medium transition-colors ${
                  inviteTab === "friends"
                    ? "text-white border-b-2 border-indigo-500"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                Invite Friend
              </button>
            </div>

            <div className="space-y-4">
              {inviteTab === "partners" ? (
                /* ── Partners tab ── */
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Select partner</label>
                  {availablePartners.length === 0 ? (
                    <p className="text-xs text-gray-600 py-2">
                      No partners available. Connect partners in the Partners tab first.
                    </p>
                  ) : (
                    <select
                      value={selectedCollab}
                      onChange={(e) => setSelectedCollab(e.target.value)}
                      className="w-full p-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white outline-none"
                    >
                      <option value="">— Choose a partner —</option>
                      {availablePartners.map((p) => {
                        const partnerPage = p.requesterId === pageId ? p.receiverPage : p.requester;
                        return (
                          <option key={p.id} value={p.id}>
                            {partnerPage?.title ?? "Unknown"} · {p.role.replace(/_/g, " ")}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              ) : (
                /* ── Friends tab ── */
                <div className="space-y-2">
                  <label className="block text-xs text-gray-500 mb-1">Select a friend</label>
                  {friends.length === 0 ? (
                    <p className="text-xs text-gray-600 py-2">
                      No friends to invite yet. Add friends from the Society tab.
                    </p>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={friendSearch}
                        onChange={(e) => setFriendSearch(e.target.value)}
                        placeholder="Search by name…"
                        className="w-full p-2 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none"
                      />
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {filteredFriends.length === 0 ? (
                          <p className="text-xs text-gray-500 py-2 text-center">No matches.</p>
                        ) : (
                          filteredFriends.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setSelectedFriend(f.id)}
                              className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                                selectedFriend === f.id
                                  ? "bg-indigo-900/50 border border-indigo-700"
                                  : "bg-gray-950 border border-gray-800 hover:border-gray-600"
                              }`}
                            >
                              <Avatar title={f.name ?? "?"} avatarUrl={f.avatarUrl} />
                              <span className="text-sm text-white truncate">
                                {f.name ?? "Unknown"}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Role selector — shared by both tabs */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Team role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as TeamRoleValue)}
                  className="w-full p-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white outline-none"
                >
                  {TEAM_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {selectedRole === "custom" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Custom role title</label>
                  <input
                    type="text"
                    value={customRoleText}
                    onChange={(e) => setCustomRoleText(e.target.value)}
                    placeholder="e.g. Head of Operations"
                    className="w-full p-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={inviteTab === "partners" ? handleInvitePartner : handleInviteFriend}
                  disabled={
                    submitting ||
                    (inviteTab === "partners" ? !selectedCollab : !selectedFriend)
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {submitting && <Spinner />}
                  Add to Team
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
