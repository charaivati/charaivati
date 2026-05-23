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
type TeamMember = {
  id: string;
  requesterId: string;
  receiverId: string;
  teamRole: string | null;
  customRole: string | null;
  requester: MemberPage;
  receiver: MemberPage;
};
type PartnerCollab = {
  id: string;
  requesterId: string;
  role: string;
  requester: { id: string; title: string; avatarUrl: string | null };
  receiver:  { id: string; title: string; avatarUrl: string | null };
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
  const [members,    setMembers]    = useState<TeamMember[]>([]);
  const [partners,   setPartners]   = useState<PartnerCollab[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [actioning,  setActioning]  = useState<Set<string>>(new Set());
  const [flash,      setFlash]      = useState<{ msg: string; ok: boolean } | null>(null);

  // Modal state
  const [showModal,       setShowModal]       = useState(false);
  const [selectedCollab,  setSelectedCollab]  = useState("");
  const [selectedRole,    setSelectedRole]    = useState<TeamRoleValue>("employee");
  const [customRoleText,  setCustomRoleText]  = useState("");
  const [submitting,      setSubmitting]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/initiative/${pageId}/team`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMembers(data.members ?? []);
      setPartners(data.partners ?? []);
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

  // Which page in this collaboration is the team member (not the initiative's page)?
  function getMemberPage(member: TeamMember): MemberPage {
    return member.requesterId === pageId ? member.receiver : member.requester;
  }

  async function handleRemove(member: TeamMember) {
    setActioned(member.id, true);
    try {
      const res = await fetch(`/api/initiative/${pageId}/team/${member.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "partner", teamRole: null, customRole: null, initiativeId: null,
        }),
      });
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

  async function handleInvite() {
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
        setShowModal(false);
        setSelectedCollab("");
        setSelectedRole("employee");
        setCustomRoleText("");
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

  function closeModal() {
    setShowModal(false);
    setSelectedCollab("");
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

  const memberIds = new Set(members.map((m) => m.id));
  const availablePartners = partners.filter((p) => !memberIds.has(p.id));

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
            onClick={() => setShowModal(true)}
            disabled={availablePartners.length === 0}
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
          {canEdit && availablePartners.length === 0 && (
            <p className="text-xs mt-1 text-gray-600">
              Connect partners first in the Partners tab.
            </p>
          )}
        </div>
      )}

      {/* Member cards */}
      {members.length > 0 && (
        <div className="space-y-2">
          {members.map((member) => {
            const page  = getMemberPage(member);
            const user  = page.owner;
            const isBusy = actioning.has(member.id);

            return (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-800 bg-gray-900/60"
              >
                <Avatar title={page.title} avatarUrl={page.avatarUrl} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{page.title}</p>
                  {user?.name && (
                    <p className="text-xs text-gray-400 truncate">{user.name}</p>
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
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Invite Team Member</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white text-xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Partner selector */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Select partner</label>
                <select
                  value={selectedCollab}
                  onChange={(e) => setSelectedCollab(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white outline-none"
                >
                  <option value="">— Choose a partner —</option>
                  {availablePartners.map((p) => {
                    const partnerPage = p.requesterId === pageId ? p.receiver : p.requester;
                    return (
                      <option key={p.id} value={p.id}>
                        {partnerPage.title} · {p.role.replace(/_/g, " ")}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Role selector */}
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

              {/* Custom role text (shown only when "custom" is selected) */}
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
                  onClick={handleInvite}
                  disabled={submitting || !selectedCollab}
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
