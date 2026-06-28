"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "";

async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  fd.append("folder", folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
  const data = await res.json();
  return data.secure_url as string;
}

type BoardMember = {
  id: string;
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

type Milestone = { id: string; title: string; status: string };
type Meeting = { id: string; title: string; date: string; location: string | null; link: string | null };

type EmergencyContact = { name: string; phone: string; role: string };

type Group = {
  id: string;
  slug: string | null;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  objective: string | null;
  emergencyContacts: EmergencyContact[];
  boardMembers: BoardMember[];
  memberships: Membership[];
  milestones: Milestone[];
  meetings: Meeting[];
};

type ViewerStatus = "guest" | "non_member" | "pending" | "member" | "admin";

type GroupPost = {
  id: string;
  content: string | null;
  status: string;
  createdAt: string;
  user: { id: string; name: string | null; avatarUrl: string | null };
};

export default function CommunityGroupPublicPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [pendingMemberships, setPendingMemberships] = useState<Membership[]>([]);
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>("guest");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ecSearch, setEcSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  // Posts
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [postText, setPostText] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Admin editing
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/community-group/by-page/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setGroup(d.group);
          setNameVal(d.group.name);
          setViewerStatus(d.viewerStatus ?? "guest");
          setPendingMemberships(d.pendingMemberships ?? []);
          // Canonical redirect: if loaded by pageId cuid, replace URL with slug
          if (d.group.slug && id !== d.group.slug) {
            router.replace(`/community/${d.group.slug}`);
          }
          // Fetch posts once we have the groupId
          fetch(`/api/community-group/${d.group.id}/posts`, { credentials: "include" })
            .then((r) => r.json())
            .then((p) => { if (p.ok) setPosts(p.posts); })
            .catch(() => {});
          // Get current user ID for own-post delete button
          fetch("/api/user/me", { credentials: "include" })
            .then((r) => r.ok ? r.json() : null)
            .then((u) => { if (u?.user?.id) setCurrentUserId(u.user.id); })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function patchGroup(body: Record<string, unknown>) {
    if (!group) return;
    await fetch(`/api/community-group/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  }

  async function commitName() {
    setEditingName(false);
    const trimmed = nameVal.trim();
    if (!trimmed || trimmed === group?.name) return;
    setGroup((g) => g ? { ...g, name: trimmed } : g);
    await patchGroup({ name: trimmed });
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !group) return;
    e.target.value = "";
    setUploadingBanner(true);
    try {
      const url = await uploadToCloudinary(file, "community_banners");
      setGroup((g) => g ? { ...g, bannerUrl: url } : g);
      await patchGroup({ bannerUrl: url });
    } finally { setUploadingBanner(false); }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !group) return;
    e.target.value = "";
    setUploadingLogo(true);
    try {
      const url = await uploadToCloudinary(file, "community_logos");
      setGroup((g) => g ? { ...g, logoUrl: url } : g);
      await patchGroup({ logoUrl: url });
    } finally { setUploadingLogo(false); }
  }

  async function requestJoin() {
    if (!group) return;
    setJoining(true);
    try {
      const res = await fetch(`/api/community-group/${group.id}/membership/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (res.ok) setViewerStatus("pending");
    } finally {
      setJoining(false);
    }
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

  async function submitPost() {
    if (!group || !postText.trim() || submittingPost) return;
    setSubmittingPost(true);
    try {
      const res = await fetch(`/api/community-group/${group.id}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: postText.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setPosts((p) => [data.post, ...p]);
        setPostText("");
      } else {
        alert(data.error ?? "Could not post. Please try again.");
      }
    } finally {
      setSubmittingPost(false);
    }
  }

  async function deletePost(postId: string) {
    if (!group) return;
    await fetch(`/api/community-group/${group.id}/posts/${postId}`, { method: "DELETE", credentials: "include" });
    setPosts((p) => p.filter((post) => post.id !== postId));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-red-400 text-sm">Community group not found.</p>
      </div>
    );
  }

  const ecQ = ecSearch.toLowerCase();
  const filteredContacts = (group.emergencyContacts ?? []).filter((ec) =>
    !ecQ || ec.name.toLowerCase().includes(ecQ) || ec.phone.includes(ecQ) || ec.role?.toLowerCase().includes(ecQ)
  );

  const mQ = memberSearch.toLowerCase();
  const approvedUsers = group.memberships
    .filter((m) => m.memberUser)
    .filter((m) => !mQ || m.memberUser!.name?.toLowerCase().includes(mQ));
  const approvedGroups = group.memberships
    .filter((m) => m.memberGroup)
    .filter((m) => !mQ || m.memberGroup!.name.toLowerCase().includes(mQ));
  const upcomingMeetings = group.meetings.filter((m) => new Date(m.date) >= new Date());
  const isAdmin = viewerStatus === "admin";

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Banner ── */}
      <div className="relative w-full">
        {group.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={group.bannerUrl} alt="banner" className="w-full h-40 sm:h-56 object-cover" />
        ) : isAdmin ? (
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            className="w-full h-36 sm:h-48 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-700 bg-gray-900 hover:border-sky-600 hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <span className="text-3xl">🖼️</span>
            <span className="text-sm text-gray-400 font-medium">{uploadingBanner ? "Uploading…" : "Add cover photo"}</span>
          </button>
        ) : null}
        {group.bannerUrl && isAdmin && (
          <button
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs font-medium transition-colors disabled:opacity-50"
          >
            {uploadingBanner ? "Uploading…" : "Change cover"}
          </button>
        )}
        <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-16 space-y-10">

        {/* ── Hero row ── */}
        <div className="flex items-end gap-4 -mt-10 pb-4 border-b border-gray-800">
          {/* Logo */}
          <div className="relative flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-gray-900"
              style={{ background: "#0c4a6e", cursor: isAdmin ? "pointer" : "default" }}
              onClick={() => isAdmin && logoInputRef.current?.click()}
            >
              {group.logoUrl
                ? <img src={group.logoUrl} alt="logo" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                : <span className="absolute inset-0 flex items-center justify-center text-sky-300 text-3xl font-bold">{group.name[0]?.toUpperCase()}</span>
              }
            </div>
            {isAdmin && (
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-700 hover:bg-sky-700 border border-gray-900 flex items-center justify-center text-xs transition-colors disabled:opacity-50"
                title="Change logo"
              >
                {uploadingLogo ? "…" : "📷"}
              </button>
            )}
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />

          <div className="flex-1 min-w-0 pt-10">
            {editingName && isAdmin ? (
              <input
                className="text-xl sm:text-2xl font-bold w-full bg-transparent border-b border-sky-500 outline-none text-white"
                value={nameVal}
                autoFocus
                onChange={(e) => setNameVal(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setNameVal(group.name); setEditingName(false); } }}
              />
            ) : (
              <h1
                className="text-xl sm:text-2xl font-bold text-white leading-tight truncate"
                style={{ cursor: isAdmin ? "text" : "default" }}
                onClick={() => isAdmin && setEditingName(true)}
                title={isAdmin ? "Click to rename" : undefined}
              >
                {group.name}
                {isAdmin && <span className="text-gray-500 text-xs ml-2 align-middle">✎</span>}
              </h1>
            )}
            {group.objective && <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{group.objective}</p>}

            <div className="mt-3 flex gap-2 flex-wrap">
              {viewerStatus === "guest" && (
                <a href={`/login?redirect=/community/${id}`} className="px-4 py-2 rounded-lg border border-sky-600 text-sky-300 text-sm font-medium hover:bg-sky-900/30 transition-colors">
                  Log in to join
                </a>
              )}
              {viewerStatus === "non_member" && (
                <button onClick={requestJoin} disabled={joining} className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                  {joining ? "Sending…" : "Request to join"}
                </button>
              )}
              {viewerStatus === "pending" && (
                <span className="px-4 py-2 rounded-lg bg-amber-900/30 border border-amber-700/50 text-amber-300 text-sm">Request pending</span>
              )}
              {viewerStatus === "member" && (
                <span className="px-4 py-2 rounded-lg bg-emerald-900/30 border border-emerald-700/50 text-emerald-300 text-sm">✓ Member</span>
              )}
              {isAdmin && (
                <a href={`/earn/initiative/${id}`} className="px-4 py-2 rounded-lg bg-sky-800 hover:bg-sky-700 text-white text-sm font-medium transition-colors">
                  Manage →
                </a>
              )}
              <button
                onClick={async () => {
                  const url = window.location.href;
                  if (navigator.share) {
                    await navigator.share({ title: group.name, url }).catch(() => {});
                  } else {
                    await navigator.clipboard?.writeText(url).catch(() => {});
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm font-medium hover:border-gray-500 hover:text-gray-200 transition-colors"
              >
                {copied ? "✓ Copied" : "Share"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Posts ── */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-emerald-400 border-b border-gray-800 pb-2">Community Posts</h2>

          {/* Compose box — logged-in users only */}
          {viewerStatus !== "guest" && (
            <div className="bg-gray-900 rounded-xl p-4 space-y-3">
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Share something with the group…"
                rows={3}
                className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 resize-none placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <div className="flex justify-end">
                <button
                  onClick={submitPost}
                  disabled={submittingPost || !postText.trim()}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  {submittingPost ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          )}

          {/* Flagged posts — admin only */}
          {isAdmin && posts.filter((p) => p.status === "flagged").length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide">Under review</p>
              {posts.filter((p) => p.status === "flagged").map((post) => (
                <div key={post.id} className="bg-gray-900/60 border border-amber-800/40 rounded-xl p-4 opacity-70 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300 font-bold flex-shrink-0">
                      {(post.user.name?.[0] ?? "?").toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-400">{post.user.name ?? "Unknown"}</span>
                    <span className="text-xs text-amber-500 ml-auto">⚠ Flagged by AI</span>
                  </div>
                  <p className="text-sm text-gray-400 whitespace-pre-wrap">{post.content}</p>
                  <button onClick={() => deletePost(post.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                </div>
              ))}
            </div>
          )}

          {/* Active posts */}
          {posts.filter((p) => p.status === "active").length === 0 ? (
            <p className="text-gray-500 text-sm">No posts yet. Be the first to share something!</p>
          ) : (
            <div className="space-y-3">
              {posts.filter((p) => p.status === "active").map((post) => (
                <div key={post.id} className="bg-gray-900 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    {post.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300 font-bold flex-shrink-0">
                        {(post.user.name?.[0] ?? "?").toUpperCase()}
                      </span>
                    )}
                    <a href={`/user/${post.user.id}`} className="text-sm text-gray-300 hover:text-white font-medium">{post.user.name ?? "Unknown"}</a>
                    <span className="text-xs text-gray-600 ml-auto">
                      {new Date(post.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    {(isAdmin || post.user.id === currentUserId) && (
                      <button onClick={() => deletePost(post.id)} className="text-xs text-gray-600 hover:text-red-400 transition-colors" title="Delete">🗑</button>
                    )}
                  </div>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{post.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Board Members ── */}
        {group.boardMembers.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-sky-300 border-b border-gray-800 pb-2">Board</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.boardMembers.map((bm) => (
                <div key={bm.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800">
                  <div className="w-9 h-9 rounded-full bg-sky-900 flex items-center justify-center text-sky-300 text-xs font-bold flex-shrink-0 overflow-hidden">
                    {bm.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bm.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (bm.user.name?.[0] ?? "?").toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{bm.user.name ?? "Unknown"}</p>
                    {bm.role && <p className="text-xs text-gray-500">{bm.role}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Emergency Contacts ── */}
        {(group.emergencyContacts ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-red-400 border-b border-gray-800 pb-2">Emergency Contacts</h2>
            <input
              value={ecSearch}
              onChange={(e) => setEcSearch(e.target.value)}
              placeholder="Search by name, role or number…"
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-700 focus:outline-none"
            />
            {filteredContacts.length === 0 && <p className="text-sm text-gray-500">No contacts match.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredContacts.map((ec, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800">
                  <div className="w-9 h-9 rounded-full bg-red-900/40 border border-red-700/50 flex items-center justify-center text-red-300 text-lg flex-shrink-0">🚨</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{ec.name}</p>
                    <p className="text-xs text-gray-400">{ec.role && <span className="mr-2">{ec.role}</span>}<a href={`tel:${ec.phone}`} className="text-red-400 hover:underline">{ec.phone}</a></p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Members ── */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-sky-300 border-b border-gray-800 pb-2">
            Members ({approvedUsers.length + approvedGroups.length})
          </h2>
          {(group.memberships.filter(m => m.memberUser || m.memberGroup).length > 0) && (
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members…"
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-sky-700 focus:outline-none"
            />
          )}

          {approvedGroups.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Sub-groups ({approvedGroups.length})</p>
              {approvedGroups.map((m) => (
                <div key={m.id} className="flex items-center gap-2 py-1.5">
                  {m.memberGroup!.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.memberGroup!.logoUrl} alt="" className="w-6 h-6 rounded-md object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-md bg-sky-900/40 flex items-center justify-center text-sky-300 text-xs">
                      {m.memberGroup!.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <a href={`/community/${m.memberGroup!.pageId}`} className="text-sm text-white hover:text-sky-300 transition-colors">
                    {m.memberGroup!.name}
                  </a>
                </div>
              ))}
            </div>
          )}

          {approvedUsers.length > 0 && (
            <div className="space-y-1">
              {approvedGroups.length > 0 && (
                <p className="text-xs text-gray-500 uppercase tracking-wide mt-2">Individuals ({approvedUsers.length})</p>
              )}
              <div className="flex flex-wrap gap-2">
                {approvedUsers.map((m) => (
                  <a key={m.id} href={`/user/${m.memberUser!.id}`} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 hover:text-white transition-colors no-underline">
                    {m.memberUser!.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.memberUser!.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center text-xs">
                        {(m.memberUser!.name?.[0] ?? "?").toUpperCase()}
                      </span>
                    )}
                    {m.memberUser!.name ?? "Unknown"}
                  </a>
                ))}
              </div>
            </div>
          )}

          {approvedUsers.length === 0 && approvedGroups.length === 0 && (
            <p className="text-sm text-gray-500">No members yet.</p>
          )}
        </section>

        {/* ── Milestones ── */}
        {group.milestones.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-sky-300 border-b border-gray-800 pb-2">Milestones</h2>
            {group.milestones.map((ms) => (
              <div key={ms.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800">
                <div className={`w-4 h-4 rounded-full flex-shrink-0 ${ms.status === "achieved" ? "bg-emerald-500" : "border-2 border-gray-600"}`} />
                <span className={`flex-1 text-sm ${ms.status === "achieved" ? "line-through text-gray-500" : "text-white"}`}>{ms.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ms.status === "achieved" ? "bg-emerald-900/50 text-emerald-300" : "bg-gray-800 text-gray-400"}`}>
                  {ms.status === "achieved" ? "Achieved" : "Pending"}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* ── Upcoming Meetings ── */}
        {upcomingMeetings.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-sky-300 border-b border-gray-800 pb-2">Upcoming Meetings</h2>
            {upcomingMeetings.map((mt) => (
              <div key={mt.id} className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-1">
                <p className="font-medium text-white">{mt.title}</p>
                <p className="text-xs text-gray-400">{new Date(mt.date).toLocaleString()}</p>
                {mt.location && <p className="text-xs text-gray-500">📍 {mt.location}</p>}
                {mt.link && (
                  <a href={mt.link} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:underline block truncate">
                    🔗 {mt.link}
                  </a>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Admin: pending membership requests */}
        {isAdmin && pendingMemberships.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-bold text-amber-300 border-b border-gray-800 pb-2">
              Pending Requests ({pendingMemberships.length})
            </h2>
            {pendingMemberships.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-900/10 border border-amber-800/40">
                <span className="flex-1 text-sm text-white">
                  {m.memberUser?.name ?? m.memberGroup?.name ?? "Unknown"}
                </span>
                <button
                  onClick={() => approveMembership(m.id)}
                  className="px-3 py-1 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-medium transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => rejectMembership(m.id)}
                  className="px-3 py-1 rounded-md bg-gray-800 hover:bg-red-900 text-gray-300 text-xs font-medium transition-colors"
                >
                  Reject
                </button>
              </div>
            ))}
          </section>
        )}

      </div>
    </div>
  );
}
