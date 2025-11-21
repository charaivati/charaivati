"use client";

import React, { useEffect, useState } from "react";
import {
  MessageSquare,
  Heart,
  Send,
  Cloud,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useGoogleDrive, type PostData } from "@/hooks/useGoogleDrive";

type StoredPost = PostData & {
  youtubeLinks?: string[];
  youtubeVideoId?: string | null; // YouTube video ID from EarningTab
  pageId?: string; // Page ID from EarningTab
};

const LS_POSTS_KEY = "ch_social_posts_v3";
const LS_EARN_POSTS_KEY = "earn_posts_v1"; // EarningTab posts key

// Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Get YouTube embed URL
function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?modestbranding=1`;
}

// Helper to extract Google Drive file ID from various URL formats
function extractDriveFileId(url?: string): string | null {
  if (!url) return null;
  
  // Handle: https://drive.google.com/uc?id=FILE_ID
  let match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  
  // Handle: https://drive.google.com/file/d/FILE_ID/view
  match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  
  // Handle: https://lh3.googleusercontent.com/d/FILE_ID=...
  match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  
  // Handle raw file ID
  if (/^[a-zA-Z0-9_-]+$/.test(url) && url.length > 20) {
    return url;
  }
  
  return null;
}

// Convert any Drive URL to proxy URL
function getImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  
  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `/api/social/proxy?id=${fileId}&type=image`;
  }
  
  // If it's already a proxy URL or other format, return as-is
  return url;
}

function getVideoUrl(url?: string): string | undefined {
  if (!url) return undefined;
  
  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `/api/social/proxy?id=${fileId}&type=video`;
  }
  
  return url;
}

export default function SocialTab() {
  const gDrive = useGoogleDrive();
  const [posts, setPosts] = useState<StoredPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");

  // Load posts
  useEffect(() => {
    const init = async () => {
      setLoadingFeed(true);
      try {
        const allPosts: StoredPost[] = [];

        // Load from SocialTab's localStorage
        const socialRaw = localStorage.getItem(LS_POSTS_KEY);
        if (socialRaw) {
          try {
            const parsed = JSON.parse(socialRaw) as StoredPost[];
            if (Array.isArray(parsed)) {
              allPosts.push(...parsed);
              console.log("Loaded posts from SocialTab localStorage:", parsed.length);
            }
          } catch (e) {
            console.warn("Failed to parse SocialTab localStorage posts:", e);
          }
        }

        // Load from EarningTab's localStorage
        const earnRaw = localStorage.getItem(LS_EARN_POSTS_KEY);
        if (earnRaw) {
          try {
            const parsed = JSON.parse(earnRaw) as StoredPost[];
            if (Array.isArray(parsed)) {
              allPosts.push(...parsed);
              console.log("Loaded posts from EarningTab localStorage:", parsed.length);
            }
          } catch (e) {
            console.warn("Failed to parse EarningTab localStorage posts:", e);
          }
        }

        // Sort by time (newest first)
        allPosts.sort((a, b) => new Date(b.timeISO).getTime() - new Date(a.timeISO).getTime());

        if (allPosts.length > 0) {
          setPosts(allPosts);
        }

        if (gDrive.isAuthenticated || gDrive.accessToken) {
          console.log("Fetching posts from Drive...");
          setSyncStatus("syncing");
          const drivePosts = await gDrive.fetchPosts();
          if (drivePosts && drivePosts.length > 0) {
            // Merge with existing posts
            const merged = [...allPosts, ...drivePosts];
            merged.sort((a, b) => new Date(b.timeISO).getTime() - new Date(a.timeISO).getTime());
            setPosts(merged);
            localStorage.setItem(LS_POSTS_KEY, JSON.stringify(drivePosts));
            console.log("Loaded posts from Drive:", drivePosts.length);
          }
          setSyncStatus("synced");
          setTimeout(() => setSyncStatus("idle"), 2000);
        }
      } catch (e) {
        console.error("Failed to load posts:", e);
        setFeedError("Could not load posts");
        setSyncStatus("error");
      } finally {
        setLoadingFeed(false);
      }
    };

    init();
  }, [gDrive.isAuthenticated, gDrive.accessToken]);

  // Listen for changes to EarningTab posts
  useEffect(() => {
    const handleStorageChange = () => {
      const earnRaw = localStorage.getItem(LS_EARN_POSTS_KEY);
      if (earnRaw) {
        try {
          const parsed = JSON.parse(earnRaw) as StoredPost[];
          if (Array.isArray(parsed)) {
            // Merge with existing posts
            const socialRaw = localStorage.getItem(LS_POSTS_KEY);
            let allPosts: StoredPost[] = [];
            
            if (socialRaw) {
              try {
                const socialParsed = JSON.parse(socialRaw) as StoredPost[];
                if (Array.isArray(socialParsed)) {
                  allPosts.push(...socialParsed);
                }
              } catch (e) {
                console.warn("Failed to parse SocialTab posts:", e);
              }
            }
            
            allPosts.push(...parsed);
            allPosts.sort((a, b) => new Date(b.timeISO).getTime() - new Date(a.timeISO).getTime());
            setPosts(allPosts);
          }
        } catch (e) {
          console.warn("Failed to parse EarningTab posts on storage change:", e);
        }
      }
    };

    // Listen for storage events (when EarningTab saves posts)
    window.addEventListener("storage", handleStorageChange);
    
    // Also check periodically (for same-tab updates)
    const interval = setInterval(handleStorageChange, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p
      )
    );
  };

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
    if (!a) return "Unknown";
    if (typeof a === "string") return a;
    if (a.name) return a.name;
    if (a.email) return a.email;
    return "Unknown";
  }

  return (
    <div className="w-full bg-gradient-to-br from-gray-900 via-black to-gray-900 min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-3xl font-light text-white tracking-wide">Social Feed</h1>
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
          </div>
        </div>
      </div>

      {/* Feed Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-20">
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
                Posts from your businesses will appear here
              </p>
            </div>
          )}

          {feedError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
              {feedError}
            </div>
          )}

          {posts.map((post) => {
            const author = authorDisplay(post.author);
            const avatarLetter = (author || "?")[0].toUpperCase();
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
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{author}</p>
                      <p className="text-sm text-gray-500">
                        {formatTime(post.timeISO)}{" "}
                        {post.synced && (
                          <span className="text-xs text-green-400">✓</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {post.content && (
                    <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap mb-4">
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
                    {post.images.map((url, i) => {
                      const imgUrl = getImageUrl(url);
                      return (
                        <img
                          key={i}
                          src={imgUrl}
                          alt={`Post image ${i + 1}`}
                          className="w-full object-cover"
                          style={{
                            height:
                              post.images?.length === 1 ? "auto" : "280px",
                          }}
                          loading="lazy"
                          onError={(e) => {
                            console.error("Image failed to load:", url, "Proxy URL:", imgUrl);
                            (e.target as HTMLImageElement).src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23333' width='100' height='100'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%23999' font-size='12'%3EImage unavailable%3C/text%3E%3C/svg%3E";
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {post.video && (
                  <video
                    src={getVideoUrl(post.video.url)}
                    controls
                    className="w-full bg-black"
                    style={{ maxHeight: "500px" }}
                  />
                )}

                {/* YouTube video from EarningTab (youtubeVideoId) */}
                {post.youtubeVideoId && (
                  <div className="px-6 pb-4">
                    <div className="rounded-lg overflow-hidden">
                      <div className="aspect-video w-full">
                        <iframe
                          title="YouTube video"
                          src={`https://www.youtube.com/embed/${post.youtubeVideoId}`}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* YouTube links from SocialTab (youtubeLinks) */}
                {post.youtubeLinks && post.youtubeLinks.length > 0 && (
                  <div className="px-6 pb-4 space-y-3">
                    {post.youtubeLinks.map((link, i) => {
                      const videoId = extractYouTubeId(link);
                      if (!videoId) return null;
                      return (
                        <div key={i} className="rounded-lg overflow-hidden">
                          <div className="aspect-video w-full">
                            <iframe
                              width="100%"
                              height="315"
                              src={getYouTubeEmbedUrl(videoId)}
                              title="YouTube video player"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="w-full h-full rounded-lg"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="px-6 py-4 flex items-center gap-6 border-t border-white/5">
                  <button
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors group"
                  >
                    <Heart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-sm">{post.likes || 0}</span>
                  </button>
                  <button className="flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors">
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-sm">Reply</span>
                  </button>
                  <button className="flex items-center gap-2 text-gray-400 hover:text-green-400 transition-colors ml-auto">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}