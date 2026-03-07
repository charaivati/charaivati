"use client";

import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  Cloud,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

type StoredPost = {
  id: string;
  gdriveId?: string;
  author?: string | { name?: string; email?: string } | null;
  timeISO: string;
  content?: string;
  images?: string[];
  video?: { name: string; size: number; url: string; gdriveId?: string } | null;
  likes?: number;
  synced?: boolean;
  youtubeLinks?: string[];
  pageId?: string;
  visibility?: "public" | "friends" | "private";
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

export default function SocialTab({ profile }: { profile?: any }) {
  const gDrive = useGoogleDrive();

  const [posts, setPosts] = useState<StoredPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "synced" | "error"
  >("idle");

  // -------- LOAD FEED --------
  async function loadFeed() {
    setLoadingFeed(true);

    try {
      const res = await fetch("/api/posts?limit=30");
      const json = await res.json();

      if (json.ok) {
        const mapped = json.data.map((p: any) => ({
          id: p.id,
          author:
            p.user?.profile?.displayName ||
            p.user?.name ||
            p.user?.email ||
            "User",

          timeISO: p.createdAt,
          content: p.content,
          likes: p.likes,
          visibility: p.visibility,
          youtubeLinks: p.youtubeLinks || [],

          images: (p.imageFileIds || []).map(
            (id: string) =>
              `https://drive.google.com/thumbnail?id=${id}&sz=w1200`
          ),

          video: p.videoFileId
            ? {
                name: "video",
                size: 0,
                url: `https://drive.google.com/uc?id=${p.videoFileId}`,
              }
            : null,
        }));

        setPosts(mapped);
      }
    } catch (err) {
      console.error("Feed load error:", err);
    } finally {
      setLoadingFeed(false);
    }
  }

  // Load once
  useEffect(() => {
    loadFeed();
  }, []);

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  };

  function authorDisplay(a?: any) {
    if (!a) return profile?.displayName ?? "You";
    if (typeof a === "string") return a;
    if (a.name) return a.name;
    if (a.email) return a.email;
    return profile?.displayName ?? "You";
  }

  return (
    <div
      className="w-full bg-gradient-to-br from-gray-900 via-black to-gray-900"
      style={{ minHeight: "200vh" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-light text-white tracking-wide">
            Social
          </h1>

          <div className="flex items-center gap-3">
            {syncStatus === "syncing" && (
              <Cloud className="w-5 h-5 text-blue-400 animate-spin" />
            )}
            {syncStatus === "synced" && (
              <CheckCircle className="w-5 h-5 text-green-400" />
            )}
            {syncStatus === "error" && (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}

            {!gDrive.isAuthenticated && (
              <button
                onClick={() => gDrive.connectDrive()}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm hover:from-blue-600 hover:to-blue-700 transition-all font-medium"
              >
                Connect Google Drive
              </button>
            )}

            {gDrive.isAuthenticated && gDrive.userInfo && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10">
                <span className="text-xs text-green-400 font-medium">
                  ✓ {gDrive.userInfo.email}
                </span>
                <button
                  onClick={() => gDrive.disconnect()}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors ml-2"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {gDrive.uploadProgress && (
          <div className="h-1 bg-gray-700">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all"
              style={{ width: `${gDrive.uploadProgress.percent}%` }}
            />
          </div>
        )}
      </div>

      {/* Feed */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        <div className="space-y-6">
          {loadingFeed && posts.length === 0 && (
            <div className="text-center py-20">
              <MessageSquare className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Loading posts…</p>
            </div>
          )}

          {!loadingFeed && posts.length === 0 && (
            <div className="text-center py-20">
              <MessageSquare className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No posts yet</p>
              <p className="text-gray-600 text-sm mt-2">
                Content will appear here
              </p>
            </div>
          )}

          {posts.map((post) => {
            const author = authorDisplay(post.author);
            const avatarLetter = (author || "Y")[0].toUpperCase();

            return (
              <article
                key={post.id}
                className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden backdrop-blur-sm hover:bg-white/8 transition-colors"
              >
                <div className="p-6 pb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                      {avatarLetter}
                    </div>

                    <div>
                      <p className="font-medium text-white">{author}</p>
                      <p className="text-sm text-gray-500">
                        {formatTime(post.timeISO)}
                      </p>
                    </div>
                  </div>

                  {post.content && (
                    <p className="text-gray-200 whitespace-pre-wrap">
                      {post.content}
                    </p>
                  )}
                </div>

                {post.images && post.images.length > 0 && (
                  <div
                    className={`${
                      post.images.length === 1 ? "" : "grid grid-cols-2 gap-1"
                    }`}
                  >
                    {post.images.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        className="w-full object-cover"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

                {post.video && (
                  <video
                    src={post.video.url}
                    controls
                    className="w-full bg-black"
                  />
                )}

                {post.youtubeLinks?.map((link, i) => {
                  const id = extractYouTubeId(link);
                  if (!id) return null;

                  return (
                    <iframe
                      key={i}
                      width="100%"
                      height="315"
                      src={`https://www.youtube.com/embed/${id}`}
                      className="rounded-lg"
                    />
                  );
                })}

                <div className="px-6 py-4 border-t border-white/5">
                  <span className="text-sm text-gray-400">
                    Likes: {post.likes || 0}
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