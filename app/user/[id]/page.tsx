"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MessageSquare, MapPin, Link as LinkIcon, Calendar, UserPlus, UserCheck, Clock, ArrowLeft, Trash2 } from "lucide-react";
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

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [relationship, setRelationship] = useState<Relationship>("none");
  const [friendPending, setFriendPending] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

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
            }))
          );
        }
      })
      .finally(() => setLoadingPosts(false));
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
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
            {relationship === "none" && (
              <button
                onClick={sendFriendRequest}
                disabled={friendPending}
                className="flex items-center gap-1.5 shrink-0 rounded-lg border border-indigo-500 bg-indigo-600/20 px-3 py-1.5 text-sm font-medium text-indigo-300 hover:bg-indigo-600/40 disabled:opacity-50 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                {friendPending ? "Sending…" : "Add friend"}
              </button>
            )}
            {relationship === "outgoing" && (
              <span className="flex items-center gap-1.5 shrink-0 rounded-lg border border-gray-700 bg-gray-800/40 px-3 py-1.5 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                Requested
              </span>
            )}
            {relationship === "friends" && (
              <span className="flex items-center gap-1.5 shrink-0 rounded-lg border border-green-700 bg-green-900/20 px-3 py-1.5 text-sm text-green-400">
                <UserCheck className="w-4 h-4" />
                Friends
              </span>
            )}
            {relationship === "incoming" && (
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
            {posts.map((post) => (
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
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-500">{formatTime(post.createdAt)}</p>
                      {post.visibility === "friends" && (
                        <span className="text-xs text-gray-500 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700">
                          👥 Friends
                        </span>
                      )}
                    </div>
                  </div>

                  {post.content && (
                    <p className="text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
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
                          className={`w-full object-cover ${
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
                  {relationship === "self" && (
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
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
