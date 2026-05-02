"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, Tag, X } from "lucide-react";
import Link from "next/link";
import { CollapsibleSection } from "@/components/self/shared";
import FriendRequestsBox from "@/components/social/FriendRequestsBox";
import ChatPanel from "@/components/social/ChatPanel";
import SelectTabsModal from "@/components/SelectTabsModal";

type FeedPost = {
  id: string;
  authorId: string;
  author: string;
  timeISO: string;
  content?: string;
  imageUrls: string[];
  videoUrl: string | null;
  likes: number;
  youtubeLinks: string[];
  visibility: "public" | "friends" | "private";
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

export default function SocialTab({ profile }: { profile?: any }) {
  const myId: string | undefined = profile?.userId;

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [closeRequestsTrigger, setCloseRequestsTrigger] = useState(0);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);

  async function loadFeed(tags: string[] = filterTags) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (tags.length > 0) params.set("tags", tags.join(","));
      const res = await fetch(`/api/posts?${params}`);
      const json = await res.json();
      if (!json.ok) return;

      const mapped: FeedPost[] = json.data.map((p: any) => ({
        id: p.id,
        authorId: p.user?.id ?? "",
        author:
          p.user?.profile?.displayName ||
          p.user?.name ||
          p.user?.email ||
          "User",
        timeISO: p.createdAt,
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
      }));

      setPosts(mapped);
    } catch (err) {
      console.error("Feed load error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeed([]);
    const onFocus = () => loadFeed(filterTags);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  function handleTagSave(selected?: string[]) {
    const tags = selected ?? [];
    setFilterTags(tags);
    setShowTagModal(false);
    loadFeed(tags);
  }

  const feedHeaderExtra = (
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); setShowTagModal(true); }}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
          filterTags.length > 0
            ? "border-blue-500 bg-blue-500/15 text-blue-300"
            : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-300"
        }`}
      >
        <Tag className="w-3 h-3" />
        {filterTags.length > 0 ? `${filterTags.length} tag${filterTags.length > 1 ? "s" : ""}` : "Filter"}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); loadFeed(filterTags); }}
        disabled={loading}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
      >
        {loading ? "Loading…" : "Refresh"}
      </button>
    </div>
  );

  const requestBadge = requestCount > 0 ? (
    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-semibold">
      {requestCount}
    </span>
  ) : null;

  return (
    <div className="text-white space-y-5">

      {/* ── Friend Requests ──────────────────────────────────────────── */}
      <CollapsibleSection
        title="Friend Requests"
        subtitle="People who want to connect with you"
        defaultOpen={requestCount > 0}
        headerExtra={requestBadge}
        triggerClose={closeRequestsTrigger}
      >
        <div className="pt-1">
          <FriendRequestsBox onCountChange={setRequestCount} />
        </div>
      </CollapsibleSection>

      {/* ── Messages (E2E encrypted) ──────────────────────────────────── */}
      <CollapsibleSection
        title="Messages"
        subtitle="End-to-end encrypted direct messages"
        defaultOpen={false}
        keepMounted
        onToggle={(open) => { if (open) setCloseRequestsTrigger(v => v + 1); }}
      >
        <div className="pt-1">
          <ChatPanel myId={myId} />
        </div>
      </CollapsibleSection>

      {/* ── Social Feed ───────────────────────────────────────────────── */}
      <CollapsibleSection title="Feed" headerExtra={feedHeaderExtra}>
        <div className="space-y-5 pt-1">

          {/* Active tag filters */}
          {filterTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Filtered by:</span>
              {filterTags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-300 text-xs"
                >
                  {tag}
                  <button
                    onClick={() => {
                      const next = filterTags.filter((t) => t !== tag);
                      setFilterTags(next);
                      loadFeed(next);
                    }}
                    className="text-blue-400 hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => { setFilterTags([]); loadFeed([]); }}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
          {loading && posts.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-3">
              <MessageSquare className="w-12 h-12 text-gray-700" />
              <p className="text-gray-500">Loading posts…</p>
            </div>
          )}

          {!loading && posts.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-3">
              <MessageSquare className="w-12 h-12 text-gray-700" />
              <p className="text-gray-500">No posts yet</p>
              <p className="text-gray-600 text-sm">Content will appear here</p>
            </div>
          )}

          {posts.map((post) => {
            const avatarLetter = (post.author || "U")[0].toUpperCase();

            return (
              <article
                key={post.id}
                className="rounded-2xl border border-gray-800 bg-gray-900/70 overflow-hidden"
              >
                <div className="p-5 pb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium shrink-0">
                      {avatarLetter}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/user/${post.authorId}`}
                        className="font-medium text-white truncate hover:underline"
                      >
                        {post.author}
                      </Link>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500">{formatTime(post.timeISO)}</p>
                        {post.visibility === "friends" && (
                          <span className="text-xs text-gray-500 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700">
                            👥 Friends
                          </span>
                        )}
                      </div>
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

                <div className="px-5 py-3 border-t border-gray-800">
                  <span className="text-xs text-gray-500">
                    {post.likes > 0
                      ? `${post.likes} like${post.likes !== 1 ? "s" : ""}`
                      : "Be the first to like"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </CollapsibleSection>

      {showTagModal && (
        <SelectTabsModal
          initialSelected={filterTags}
          onClose={handleTagSave}
        />
      )}
    </div>
  );
}
