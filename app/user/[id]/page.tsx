"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  MessageSquare, MapPin, Link as LinkIcon, Calendar, UserPlus, UserCheck,
  Clock, ArrowLeft, Trash2, ShoppingBag, Truck, Briefcase, Heart, ChevronRight,
  X, Download, Share2,
} from "lucide-react";
import Link from "next/link";

type Relationship = "self" | "friends" | "outgoing" | "incoming" | "none";

type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  title: string | null;
  shortBio: string | null;
  location: string | null;
  joinedAt: string | null;
  about: string | null;
  links: { label: string; href: string }[];
  relationship: Relationship;
  discoverable?: boolean;
};

type FeedPost = {
  id: string;
  content?: string;
  imageUrls: string[];
  videoUrl: string | null;
  likes: number;
  youtubeLinks: string[];
  visibility: "public" | "friends" | "private";
  createdAt: string;
  pageId?: string | null;
};

type InitiativePage = {
  id: string;
  title: string;
  description: string | null;
  avatarUrl: string | null;
  pageType: string;
  storeSlug: string | null;
  storeId: string | null;
};

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatJoined(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

function initiativeUrl(page: InitiativePage): string | null {
  if (page.pageType === "store") {
    return page.storeSlug
      ? `/store/${page.storeSlug}`
      : page.storeId
      ? `/store/${page.storeId}`
      : null;
  }
  if (page.pageType === "fleet") return `/fleet/${page.id}`;
  if (page.pageType === "helping") return `/helping/${page.id}`;
  return null;
}

type TypeMeta = {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor: string;
  iconBg: string;
  badgeBg: string;
  badgeColor: string;
  label: string;
};

function typeMeta(pageType: string): TypeMeta {
  switch (pageType) {
    case "store":
      return { Icon: ShoppingBag, iconColor: "#D85A30", iconBg: "#FDF0EB", badgeBg: "#FDF0EB", badgeColor: "#993C1D", label: "Store" };
    case "fleet":
      return { Icon: Truck, iconColor: "#B45309", iconBg: "#FEF3C7", badgeBg: "#FEF3C7", badgeColor: "#92400E", label: "Fleet" };
    case "service":
      return { Icon: Briefcase, iconColor: "#7B5EA7", iconBg: "#F0EDF8", badgeBg: "#F0EDF8", badgeColor: "#534AB7", label: "Service" };
    case "helping":
      return { Icon: Heart, iconColor: "#0F6E56", iconBg: "#E1F5EE", badgeBg: "#E1F5EE", badgeColor: "#085041", label: "Helping" };
    default:
      return { Icon: ShoppingBag, iconColor: "#D85A30", iconBg: "#FDF0EB", badgeBg: "#FDF0EB", badgeColor: "#993C1D", label: "Initiative" };
  }
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [initiatives, setInitiatives] = useState<InitiativePage[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [relationship, setRelationship] = useState<Relationship>("none");
  const [friendPending, setFriendPending] = useState(false);
  const [unfriendPending, setUnfriendPending] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [discoverable, setDiscoverable] = useState(true);
  const [savingDiscoverable, setSavingDiscoverable] = useState(false);

  useEffect(() => {
    if (!userId) return;

    fetch(`/api/users/${userId}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setUser(data);
          setRelationship(data.relationship ?? "none");
          if (typeof data.discoverable === "boolean") setDiscoverable(data.discoverable);
        }
      })
      .finally(() => setLoadingUser(false));

    fetch(`/api/users/${userId}/posts?limit=50`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setPosts(
            json.data.map((p: any) => ({
              id: p.id,
              content: p.content ?? undefined,
              imageUrls:
                p.imageUrls?.length > 0
                  ? p.imageUrls
                  : (p.imageFileIds || []).map(
                      (id: string) =>
                        `https://drive.google.com/thumbnail?id=${id}&sz=w1200`
                    ),
              videoUrl:
                p.videoUrl ??
                (p.videoFileId
                  ? `https://drive.google.com/uc?id=${p.videoFileId}`
                  : null),
              likes: p.likes ?? 0,
              youtubeLinks: p.youtubeLinks ?? [],
              visibility: p.visibility ?? "public",
              createdAt: p.createdAt,
              pageId: p.pageId ?? null,
            }))
          );
        }
      })
      .finally(() => setLoadingPosts(false));

    fetch(`/api/users/${userId}/pages`)
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json?.pages) setInitiatives(json.pages);
      })
      .catch(() => {});

    fetch("/api/user/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json?.user?.id) setCurrentUserId(json.user.id); })
      .catch(() => {});
  }, [userId]);

  async function sendFriendRequest() {
    if (!userId || friendPending) return;
    setFriendPending(true);
    try {
      const res = await fetch("/api/user/friends", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: userId }),
      });
      const json = await res.json();
      if (json.ok) {
        setRelationship("outgoing");
      } else {
        alert(json.error ?? "Failed to send friend request");
      }
    } catch {
      alert("Failed to send friend request");
    } finally {
      setFriendPending(false);
    }
  }

  async function removeFriend() {
    if (!userId || unfriendPending) return;
    if (!confirm(`Remove ${displayName} from friends?`)) return;
    setUnfriendPending(true);
    try {
      const res = await fetch("/api/friends/remove", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId: userId }),
      });
      const json = await res.json();
      if (json.ok) {
        setRelationship("none");
      } else {
        alert(json.error ?? "Failed to remove friend");
      }
    } catch {
      alert("Failed to remove friend");
    } finally {
      setUnfriendPending(false);
    }
  }

  async function toggleDiscoverable() {
    if (savingDiscoverable) return;
    const next = !discoverable;
    setSavingDiscoverable(true);
    setDiscoverable(next);
    try {
      const res = await fetch("/api/user/privacy", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discoverable: next }),
      });
      const json = await res.json();
      if (!json.ok) setDiscoverable(!next);
    } catch {
      setDiscoverable(!next);
    } finally {
      setSavingDiscoverable(false);
    }
  }

  async function handleSharePost(post: FeedPost, initiative: InitiativePage | null) {
    const origin = window.location.origin;
    const shareUrl = (() => {
      if (!initiative) return origin;
      if (initiative.pageType === "store") {
        if (initiative.storeSlug) return `${origin}/store/${initiative.storeSlug}`;
        if (initiative.storeId) return `${origin}/store/${initiative.storeId}`;
      }
      if (initiative.pageType === "fleet") return `${origin}/fleet/${initiative.id}`;
      return origin;
    })();
    const shareData = {
      title: initiative?.title ?? "Charaivati",
      text: post.content?.slice(0, 100) ?? "Check this out",
      url: shareUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedPostId(post.id);
      setTimeout(() => setCopiedPostId(null), 1500);
    }
  }

  async function deletePost(postId: string) {
    if (!confirm("Delete this post?")) return;
    setDeletingPostId(postId);
    try {
      const res = await fetch("/api/posts", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      const json = await res.json();
      if (json.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } else {
        alert(json.error ?? "Failed to delete post");
      }
    } catch {
      alert("Failed to delete post");
    } finally {
      setDeletingPostId(null);
    }
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Loading profile…</p>
      </div>
    );
  }

  if (notFound || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-white text-lg font-medium">User not found</p>
        <Link href="/self" className="text-indigo-400 hover:underline text-sm">
          Back to feed
        </Link>
      </div>
    );
  }

  const displayName = user.name ?? user.email ?? "User";
  const avatarLetter = displayName[0].toUpperCase();
  const initiativeById = Object.fromEntries(initiatives.map((i) => [i.id, i]));
  const isSelf = currentUserId !== null && currentUserId === userId;

  function downloadImage(url: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = "image.jpg";
    a.target = "_blank";
    a.click();
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Lightbox overlay */}
      {lightbox && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setLightbox(null)}
        >
          {/* Download button — absolute, 44×44 tap target */}
          <button
            onClick={(e) => { e.stopPropagation(); downloadImage(lightbox); }}
            style={{
              position: "absolute", top: 16, right: 72, zIndex: 1010,
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(0,0,0,0.5)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
            }}
            aria-label="Download image"
          >
            <Download style={{ width: 20, height: 20 }} />
          </button>
          {/* Close button — absolute, 44×44 tap target */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            style={{
              position: "absolute", top: 16, right: 16, zIndex: 1010,
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(0,0,0,0.5)", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
            }}
            aria-label="Close lightbox"
          >
            <X style={{ width: 20, height: 20 }} />
          </button>
          {/* Image — pinch-zoom wrapper allows scroll/pan when zoomed */}
          <div
            style={{ overflow: "auto", maxWidth: "100vw", maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox}
              alt=""
              style={{
                maxWidth: "100%", maxHeight: "90vh",
                objectFit: "contain",
                touchAction: "pinch-zoom",
                cursor: "zoom-in",
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-medium text-white truncate">{displayName}</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* ── Profile Header ────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6 space-y-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={displayName}
                className="w-16 h-16 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-medium shrink-0">
                {avatarLetter}
              </div>
            )}

            {/* Name & title */}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-white truncate">{displayName}</h1>
              {user.title && (
                <p className="text-sm text-gray-400 mt-0.5">{user.title}</p>
              )}
              {user.shortBio && (
                <p className="text-sm text-gray-300 mt-1">{user.shortBio}</p>
              )}
            </div>

            {/* Friend action button */}
            {isSelf && (
              <a
                href="/self"
                className="flex items-center gap-1.5 shrink-0 rounded-lg border border-gray-700 bg-gray-800/40 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                style={{ textDecoration: "none" }}
              >
                Edit profile
              </a>
            )}
            {!isSelf && relationship === "none" && (
              <button
                onClick={sendFriendRequest}
                disabled={friendPending}
                className="flex items-center gap-1.5 shrink-0 rounded-lg border border-indigo-500 bg-indigo-600/20 px-3 py-1.5 text-sm font-medium text-indigo-300 hover:bg-indigo-600/40 disabled:opacity-50 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                {friendPending ? "Sending…" : "Add friend"}
              </button>
            )}
            {!isSelf && relationship === "outgoing" && (
              <span className="flex items-center gap-1.5 shrink-0 rounded-lg border border-gray-700 bg-gray-800/40 px-3 py-1.5 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                Requested
              </span>
            )}
            {!isSelf && relationship === "friends" && (
              <button
                onClick={removeFriend}
                disabled={unfriendPending}
                className="flex items-center gap-1.5 shrink-0 rounded-lg border border-green-700 bg-green-900/20 px-3 py-1.5 text-sm text-green-400 hover:border-red-700 hover:bg-red-900/20 hover:text-red-400 disabled:opacity-50 transition-colors"
                title="Remove friend"
              >
                <UserCheck className="w-4 h-4" />
                {unfriendPending ? "Removing…" : "Friends"}
              </button>
            )}
            {!isSelf && relationship === "incoming" && (
              <button
                onClick={sendFriendRequest}
                disabled={friendPending}
                className="flex items-center gap-1.5 shrink-0 rounded-lg border border-indigo-500 bg-indigo-600/20 px-3 py-1.5 text-sm font-medium text-indigo-300 hover:bg-indigo-600/40 disabled:opacity-50 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Accept
              </button>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
            {user.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {user.location}
              </span>
            )}
            {user.joinedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Joined {formatJoined(user.joinedAt)}
              </span>
            )}
          </div>

          {/* About */}
          {user.about && (
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {user.about}
            </p>
          )}

          {/* Links */}
          {user.links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {user.links.map((link, i) => (
                <a
                  key={i}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
                >
                  <LinkIcon className="w-3 h-3" />
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* ── Privacy ───────────────────────────────────────────────────── */}
        {isSelf && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Allow others to find me by search</p>
              <p className="text-xs text-gray-500 mt-0.5">
                When off, people can't find your profile by searching your name.
              </p>
            </div>
            <button
              onClick={toggleDiscoverable}
              disabled={savingDiscoverable}
              role="switch"
              aria-checked={discoverable}
              className={`relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                discoverable ? "bg-indigo-600" : "bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  discoverable ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}

        {/* ── Initiatives ───────────────────────────────────────────────── */}
        {initiatives.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider px-1 mb-4">
              Initiatives
            </h2>
            <div className="flex flex-col gap-3">
              {initiatives.map((page) => {
                const url = initiativeUrl(page);
                const meta = typeMeta(page.pageType);
                const { Icon } = meta;
                const isClickable = url !== null;

                const cardContent = (
                  <div
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-800 bg-gray-900/70"
                    style={{ opacity: isClickable ? 1 : 0.7, cursor: isClickable ? "pointer" : "default" }}
                  >
                    {/* Icon box */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: meta.iconBg }}
                    >
                      <Icon style={{ color: meta.iconColor, width: 20, height: 20 }} />
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white leading-snug truncate">
                        {page.title}
                      </p>
                      {page.description && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {page.description}
                        </p>
                      )}
                    </div>

                    {/* Badge + arrow */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: meta.badgeBg, color: meta.badgeColor }}
                      >
                        {meta.label}
                      </span>
                      {isClickable && (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>
                );

                return isClickable ? (
                  <a key={page.id} href={url} style={{ textDecoration: "none" }}>
                    {cardContent}
                  </a>
                ) : (
                  <div key={page.id}>{cardContent}</div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Posts ─────────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider px-1 mb-4">
            Posts
          </h2>

          {loadingPosts && (
            <div className="flex flex-col items-center py-12 gap-3">
              <MessageSquare className="w-10 h-10 text-gray-700" />
              <p className="text-gray-500">Loading posts…</p>
            </div>
          )}

          {!loadingPosts && posts.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-3">
              <MessageSquare className="w-10 h-10 text-gray-700" />
              <p className="text-gray-500">No posts yet</p>
            </div>
          )}

          <div className="space-y-5">
            {posts.map((post) => {
              const viaInitiative = post.pageId ? initiativeById[post.pageId] : null;
              return (
                <article
                  key={post.id}
                  className="rounded-2xl border border-gray-800 bg-gray-900/70 overflow-hidden"
                >
                  <div className="p-5 pb-4">
                    <div className="flex items-center gap-3 mb-3">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={displayName}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
                          {avatarLetter}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium" style={{ color: "var(--color-text-primary)" }}>
                          {displayName}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{formatTime(post.createdAt)}</p>
                          {post.visibility === "friends" && (
                            <span className="text-xs text-gray-500 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700">
                              👥 Friends
                            </span>
                          )}
                        </div>
                        {viaInitiative && (
                          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                            via {viaInitiative.title}
                          </p>
                        )}
                      </div>
                    </div>

                    {post.content && (
                      <p className="whitespace-pre-wrap leading-relaxed text-sm" style={{ color: "var(--color-text-primary)" }}>
                        {post.content}
                      </p>
                    )}
                  </div>

                  {post.imageUrls.length > 0 && (
                    <div className={post.imageUrls.length === 1 ? "" : "grid grid-cols-2 gap-0.5"}>
                      {post.imageUrls.map((url, i) => {
                        const isFirst = i === 0 && post.imageUrls.length >= 3;
                        return (
                          <img
                            key={i}
                            src={url}
                            alt=""
                            loading="lazy"
                            onClick={() => setLightbox(url)}
                            className={`w-full object-cover cursor-pointer ${
                              post.imageUrls.length === 1
                                ? "max-h-[480px]"
                                : isFirst
                                ? "col-span-2 max-h-64"
                                : "h-40"
                            }`}
                          />
                        );
                      })}
                    </div>
                  )}

                  {post.videoUrl && (
                    <video
                      src={post.videoUrl}
                      controls
                      className="w-full bg-black max-h-[480px]"
                    />
                  )}

                  {post.youtubeLinks.map((link, i) => {
                    const id = extractYouTubeId(link);
                    if (!id) return null;
                    return (
                      <div key={i} className="aspect-video">
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${id}`}
                          allowFullScreen
                          className="border-0"
                        />
                      </div>
                    );
                  })}

                  <div className="px-5 py-3 border-t border-gray-800 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {post.likes > 0
                        ? `${post.likes} like${post.likes !== 1 ? "s" : ""}`
                        : "Be the first to like"}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleSharePost(post, viaInitiative)}
                        className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Share
                      </button>
                      {copiedPostId === post.id && (
                        <span className="text-xs text-green-500">Link copied!</span>
                      )}
                      {isSelf && (
                        <button
                          onClick={() => deletePost(post.id)}
                          disabled={deletingPostId === post.id}
                          className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 disabled:opacity-40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {deletingPostId === post.id ? "Deleting…" : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
