"use client";
import React, { useEffect, useRef, useState } from "react";
import { Camera, Video, MessageSquare, Heart, Send, X } from "lucide-react";

type StoredPost = {
  id: number | string;
  author?: string | { name?: string; email?: string } | null;
  timeISO: string;
  content?: string;
  images?: string[];
  video?: { name: string; size: number; url: string } | null;
  likes?: number;
};

const MAX_PHOTOS_PER_DAY = 4;
const MAX_VIDEOS_PER_DAY = 1;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_POST_CHARS = 5000;
const MAX_POSTS_STORED = 200;

const LS_POSTS_KEY = "ch_social_posts_v1";
const LS_DAILY_LIMITS_KEY = "ch_social_daily_limits_v1";

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

type DailyLimits = { date: string; photosUsed: number; videosUsed: number };

export default function SocialTab({ profile }: { profile?: any }) {
  const [composerText, setComposerText] = useState("");
  const [posts, setPosts] = useState<StoredPost[]>(() => {
    // lazy initializer — runs only on client
    try {
      const raw = localStorage.getItem(LS_POSTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as StoredPost[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Error reading posts from localStorage:", e);
      return [];
    }
  });

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [dailyLimits, setDailyLimits] = useState<DailyLimits>(() => {
    try {
      const raw = localStorage.getItem(LS_DAILY_LIMITS_KEY);
      if (!raw) return { date: todayKey(), photosUsed: 0, videosUsed: 0 };
      const parsed = JSON.parse(raw) as DailyLimits;
      if (!parsed || parsed.date !== todayKey()) return { date: todayKey(), photosUsed: 0, videosUsed: 0 };
      return parsed;
    } catch (e) {
      console.error("Error reading daily limits from localStorage:", e);
      return { date: todayKey(), photosUsed: 0, videosUsed: 0 };
    }
  });

  const [showComposer, setShowComposer] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // persist posts when they change
  useEffect(() => {
    try {
      localStorage.setItem(LS_POSTS_KEY, JSON.stringify(posts.slice(0, MAX_POSTS_STORED)));
    } catch (e) {
      console.error("Failed to save posts to localStorage:", e);
    }
  }, [posts]);

  // persist dailyLimits when changed
  useEffect(() => {
    try {
      localStorage.setItem(LS_DAILY_LIMITS_KEY, JSON.stringify(dailyLimits));
    } catch (e) {
      console.error("Failed to save daily limits to localStorage:", e);
    }
  }, [dailyLimits]);

  // cleanup object URLs
  useEffect(() => {
    return () => {
      imagePreviews.forEach((p) => URL.revokeObjectURL(p));
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [imagePreviews, videoPreview]);

  // Fetch server feed on mount (fallback to localStorage preserved posts)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingFeed(true);
      setFeedError(null);
      try {
        const res = await fetch("/api/social/posts", { credentials: "include" });
        if (!alive) return;
        if (!res.ok) {
          setFeedError(`Server returned ${res.status}`);
          setLoadingFeed(false);
          return;
        }
        const j = await res.json().catch(() => null);
        if (j && Array.isArray(j.posts)) {
          // Normalize incoming posts (defensive)
          const normalized = j.posts.map((p: any) => ({
            id: p.id,
            author: p.author ?? p.authorName ?? p.authorEmail ?? null,
            timeISO: p.createdAt ?? p.timeISO ?? new Date().toISOString(),
            content: p.content ?? "",
            images: Array.isArray(p.images) ? p.images : [],
            video: p.videoName ? { name: p.videoName, size: p.videoSize ?? 0, url: p.videoUrl } : null,
            likes: typeof p.likes === "number" ? p.likes : 0,
          }));
          setPosts(normalized);
        } else {
          // No feed available — keep local posts
        }
      } catch (e: any) {
        console.warn("Failed to fetch feed — using local cache:", e?.message ?? e);
        setFeedError("Offline / feed fetch failed");
      } finally {
        if (alive) setLoadingFeed(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Check server-side daily limits (so client can't exceed server quotas)
  async function refreshServerLimits() {
    try {
      const res = await fetch("/api/social/limits", { credentials: "include" });
      if (!res.ok) return;
      const j = await res.json().catch(() => null);
      if (j?.limits) {
        // server returns photosUsed/videosUsed — update local dailyLimits so UI matches server
        setDailyLimits((prev) => {
          const next = { ...prev };
          next.date = todayKey();
          next.photosUsed = j.limits.photosUsed ?? j.limits.photosUsed ?? prev.photosUsed;
          next.videosUsed = j.limits.videosUsed ?? prev.videosUsed;
          return next;
        });
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // refresh on mount
    refreshServerLimits();
  }, []);

  const handleAddImages = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const remainingToday = MAX_PHOTOS_PER_DAY - dailyLimits.photosUsed;
    const canAdd = Math.max(0, remainingToday - images.length);
    if (canAdd <= 0) {
      alert(`You've reached the daily photo limit of ${MAX_PHOTOS_PER_DAY}.`);
      return;
    }
    const toTake = incoming.slice(0, canAdd);
    const newPreviews = toTake.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...toTake].slice(0, MAX_PHOTOS_PER_DAY));
    setImagePreviews((prev) => [...prev, ...newPreviews].slice(0, MAX_PHOTOS_PER_DAY));
  };

  const handleRemoveImageAt = (index: number) => {
    setImages((prev) => {
      const c = [...prev];
      c.splice(index, 1);
      return c;
    });
    setImagePreviews((prev) => {
      const c = [...prev];
      const removed = c.splice(index, 1);
      removed.forEach((p) => URL.revokeObjectURL(p));
      return c;
    });
  };

  const handlePickVideo = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const remainingVideosToday = MAX_VIDEOS_PER_DAY - dailyLimits.videosUsed;
    if (remainingVideosToday <= 0 && !videoFile) {
      alert(`You already used your ${MAX_VIDEOS_PER_DAY} video for today.`);
      return;
    }
    if (f.size > MAX_VIDEO_BYTES) {
      alert(`Video too large. Max ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))} MB.`);
      return;
    }
    const url = URL.createObjectURL(f);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(f);
    setVideoPreview(url);
  };

  const handleRemoveVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
  };

  const handleClearComposer = () => {
    setComposerText("");
    imagePreviews.forEach((p) => URL.revokeObjectURL(p));
    setImages([]);
    setImagePreviews([]);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
    setShowComposer(false);
  };

  const convertFileToDataURL = (f: File): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(String(reader.result));
      reader.onerror = (e) => rej(e);
      reader.readAsDataURL(f);
    });

  // send post to server; falls back to local-only if server not available
  async function handlePost() {
    const txt = composerText.trim();
    if (!txt && images.length === 0 && !videoFile) {
      alert("Share something or add media before posting.");
      return;
    }
    if (txt.length > MAX_POST_CHARS) {
      alert(`Post too long. Max ${MAX_POST_CHARS} characters.`);
      return;
    }

    // check remaining quotas from server one more time
    await refreshServerLimits();
    if (dailyLimits.photosUsed + images.length > MAX_PHOTOS_PER_DAY) {
      alert(`You can't post that many photos today (limit ${MAX_PHOTOS_PER_DAY}).`);
      return;
    }
    if (dailyLimits.videosUsed + (videoFile ? 1 : 0) > MAX_VIDEOS_PER_DAY) {
      alert(`You can't post that many videos today (limit ${MAX_VIDEOS_PER_DAY}).`);
      return;
    }

    const nextPost: StoredPost = {
      id: Date.now(),
      author: profile?.displayName ?? profile?.email ?? "You",
      timeISO: new Date().toISOString(),
      content: txt,
      likes: 0,
    };

    // convert images/videos to data URL for persistence (local/dev)
    if (images.length > 0) {
      try {
        const converted = await Promise.all(images.map((f) => convertFileToDataURL(f)));
        nextPost.images = converted;
      } catch (e) {
        console.error("Failed converting images", e);
        alert("Failed to process images.");
        return;
      }
    }
    if (videoFile) {
      try {
        const vUrl = await convertFileToDataURL(videoFile);
        nextPost.video = { name: videoFile.name, size: videoFile.size, url: vUrl };
      } catch (e) {
        console.error("Failed converting video", e);
        alert("Failed to process video.");
        return;
      }
    }

    // optimistic local update first
    setPosts((prev) => [nextPost, ...prev].slice(0, MAX_POSTS_STORED));
    // update dailyLimits locally (server will be authoritative)
    setDailyLimits((prev) => {
      const next = { ...prev };
      if (next.date !== todayKey()) {
        next.date = todayKey();
        next.photosUsed = 0;
        next.videosUsed = 0;
      }
      next.photosUsed = next.photosUsed + images.length;
      next.videosUsed = next.videosUsed + (videoFile ? 1 : 0);
      return next;
    });

    // clear composer UI now
    handleClearComposer();

    // try to POST to server endpoint
    try {
      const body = {
        content: txt,
        images: nextPost.images ?? [],
        video: nextPost.video ?? null,
      };
      const res = await fetch("/api/social/post", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => null);

      if (!res.ok || !j?.ok) {
        // server rejected; inform user and keep local copy
        console.warn("Server post failed:", j || res.status);
        alert(j?.error || "Failed to post to server — saved locally.");
      } else if (j.post) {
        // if server returns canonical post object, replace optimistic local post with server post
        setPosts((prev) => {
          // replace first matching optimistic by id (timestamp) if present; otherwise just prepend server post
          const idx = prev.findIndex((p) => p.id === nextPost.id);
          const normalized: StoredPost = {
            id: j.post.id ?? j.post._id ?? j.post.createdAt ?? Math.random(),
            author: j.post.authorName ?? j.post.author ?? profile?.displayName ?? "You",
            timeISO: j.post.createdAt ?? j.post.timeISO ?? new Date().toISOString(),
            content: j.post.content ?? "",
            images: Array.isArray(j.post.images) ? j.post.images : nextPost.images ?? [],
            video: j.post.videoUrl ? { name: j.post.videoName, size: j.post.videoSize ?? 0, url: j.post.videoUrl } : nextPost.video ?? null,
            likes: j.post.likes ?? 0,
          };
          if (idx >= 0) {
            const copy = [...prev];
            copy.splice(idx, 1, normalized);
            return copy;
          } else {
            return [normalized, ...prev].slice(0, MAX_POSTS_STORED);
          }
        });
      }
    } catch (e) {
      console.warn("Network error posting to server (post saved locally)", e);
    }
  }

  const handleLike = (postId: number | string) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p)));
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

  const photosRemaining = Math.max(0, MAX_PHOTOS_PER_DAY - dailyLimits.photosUsed - images.length);
  const videosRemaining = Math.max(0, MAX_VIDEOS_PER_DAY - dailyLimits.videosUsed - (videoFile ? 1 : 0));

  // Helper to safely get author string for UI
  function authorDisplay(a?: any) {
    if (!a) return profile?.displayName ?? "You";
    if (typeof a === "string") return a;
    if (a.name) return a.name;
    if (a.email) return a.email;
    return profile?.displayName ?? "You";
  }

  return (
    <div className="w-full bg-gradient-to-br from-gray-900 via-black to-gray-900" style={{ minHeight: "200vh" }}>
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-light text-white tracking-wide">Social</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {/* Composer Trigger */}
        {!showComposer && (
          <button
            onClick={() => setShowComposer(true)}
            className="w-full mb-6 p-6 rounded-3xl bg-white/5 hover:bg-white/8 border border-white/10 transition-all duration-300 text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                {(profile?.displayName || "Y")[0].toUpperCase()}
              </div>
              <span className="text-gray-400 text-lg group-hover:text-gray-300 transition-colors">Share your journey...</span>
            </div>
          </button>
        )}

        {/* Composer */}
        {showComposer && (
          <div className="mb-6 rounded-3xl bg-white/5 border border-white/10 overflow-hidden backdrop-blur-sm">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium flex-shrink-0">
                  {(profile?.displayName || "Y")[0].toUpperCase()}
                </div>
                <textarea
                  ref={textareaRef}
                  placeholder="Share your health journey, progress, or thoughts..."
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder-gray-500 text-lg outline-none resize-none min-h-[120px]"
                  autoFocus
                />
              </div>

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative rounded-2xl overflow-hidden group">
                      <img src={src} alt="" className="w-full h-48 object-cover" />
                      <button
                        onClick={() => handleRemoveImageAt(i)}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Video Preview */}
              {videoPreview && (
                <div className="mb-4 relative rounded-2xl overflow-hidden">
                  <video src={videoPreview} controls className="w-full max-h-80 bg-black" />
                  <button onClick={handleRemoveVideo} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}
            </div>

            {/* Actions Bar */}
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
              <div className="flex gap-2">
                <label className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors">
                  <Camera className="w-5 h-5 text-blue-400" />
                  <input type="file" accept="image/*" multiple onChange={(e) => handleAddImages(e.target.files)} className="hidden" />
                </label>
                <label className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors">
                  <Video className="w-5 h-5 text-purple-400" />
                  <input type="file" accept="video/*" onChange={(e) => handlePickVideo(e.target.files)} className="hidden" />
                </label>
              </div>

              <div className="flex gap-2">
                <button onClick={handleClearComposer} className="px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
                  Cancel
                </button>
                <button onClick={handlePost} className="px-6 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all">
                  Share
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Posts Feed */}
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
              <p className="text-gray-600 text-sm mt-2">Share your first moment</p>
            </div>
          )}

          {posts.map((post) => {
            // Defensive: ensure author string safe
            const author = authorDisplay(post.author);
            const avatarLetter = (author || "Y")[0].toUpperCase();
            return (
              <article key={String(post.id)} className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden backdrop-blur-sm hover:bg-white/8 transition-colors">
                {/* Post Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                      {avatarLetter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{author}</p>
                      <p className="text-sm text-gray-500">{formatTime(post.timeISO)}</p>
                    </div>
                  </div>

                  {/* Post Content */}
                  {post.content && (
                    <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap mb-4">{post.content}</p>
                  )}
                </div>

                {/* Post Images */}
                {post.images && post.images.length > 0 && (
                  <div className={`${post.images.length === 1 ? "" : "grid grid-cols-2 gap-1"}`}>
                    {post.images.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-full object-cover" style={{ height: post.images?.length === 1 ? "auto" : "280px" }} />
                    ))}
                  </div>
                )}

                {/* Post Video */}
                {post.video && <video src={post.video.url} controls className="w-full bg-black" />}

                {/* Post Actions */}
                <div className="px-6 py-4 flex items-center gap-6 border-t border-white/5">
                  <button onClick={() => handleLike(post.id)} className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors group">
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
