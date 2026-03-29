"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";

type FeedPost = {
  id: string;
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
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadFeed() {
    setLoading(true);
    try {
      const res = await fetch("/api/posts?limit=30");
      const json = await res.json();
      if (!json.ok) return;

      const mapped: FeedPost[] = json.data.map((p: any) => ({
        id: p.id,
        author:
          p.user?.profile?.displayName ||
          p.user?.name ||
          p.user?.email ||
          "User",
        timeISO: p.createdAt,
        content: p.content ?? undefined,
        // Cloudinary URLs — fall back to legacy GDrive thumbnails for old posts
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
    loadFeed();
  }, []);

  return (
    <div className="w-full bg-gradient-to-br from-gray-900 via-black to-gray-900 min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/5 mb-6">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-light text-white tracking-wide">Social</h1>
          <button
            onClick={loadFeed}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-2xl mx-auto px-4 pb-32">
        <div className="space-y-6">
          {loading && posts.length === 0 && (
            <div className="text-center py-20">
              <MessageSquare className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Loading posts…</p>
            </div>
          )}

          {!loading && posts.length === 0 && (
            <div className="text-center py-20">
              <MessageSquare className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No posts yet</p>
              <p className="text-gray-600 text-sm mt-2">Content will appear here</p>
            </div>
          )}

          {posts.map((post) => {
            const avatarLetter = (post.author || "U")[0].toUpperCase();

            return (
              <article
                key={post.id}
                className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden backdrop-blur-sm hover:bg-white/[0.08] transition-colors"
              >
                <div className="p-6 pb-4">
                  {/* Author row */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium shrink-0">
                      {avatarLetter}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{post.author}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-500">{formatTime(post.timeISO)}</p>
                        {post.visibility === "friends" && (
                          <span className="text-xs text-gray-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                            👥 Friends
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {post.content && (
                    <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {post.content}
                    </p>
                  )}
                </div>

                {/* Images */}
                {post.imageUrls.length > 0 && (
                  <div
                    className={
                      post.imageUrls.length === 1
                        ? ""
                        : post.imageUrls.length === 2
                        ? "grid grid-cols-2 gap-0.5"
                        : "grid grid-cols-2 gap-0.5"
                    }
                  >
                    {post.imageUrls.map((url, i) => {
                      // For 3+ images: first image spans full width, rest are 2-col
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

                {/* Video */}
                {post.videoUrl && (
                  <video
                    src={post.videoUrl}
                    controls
                    className="w-full bg-black max-h-[480px]"
                  />
                )}

                {/* YouTube embeds */}
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

                <div className="px-6 py-3 border-t border-white/5">
                  <span className="text-sm text-gray-500">
                    {post.likes > 0 ? `${post.likes} like${post.likes !== 1 ? "s" : ""}` : "Be the first to like"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
