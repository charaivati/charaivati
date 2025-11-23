// ============================================================================
// UPDATED: app/(with-nav)/self/tabs/SocialTab.tsx
// Added: Delete post + Privacy controls (Public/Friends only)
// ============================================================================
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  Video,
  MessageSquare,
  Heart,
  Send,
  X,
  Cloud,
  AlertCircle,
  Upload,
  CheckCircle,
  Plus,
  Trash2,
  Lock,
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
  visibility?: "public" | "friends"; // ✅ ADDED: Privacy setting
};

const LS_POSTS_KEY = "ch_social_posts_v3";

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

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
  const [composerText, setComposerText] = useState("");
  const [posts, setPosts] = useState<StoredPost[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [youtubeLink, setYoutubeLink] = useState("");
  // ✅ ADDED: Privacy visibility state
  const [visibility, setVisibility] = useState<"public" | "friends">("public");

  const [showComposer, setShowComposer] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [postingInProgress, setPostingInProgress] = useState(false);
  // ✅ ADDED: Delete state
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const initPosts = async () => {
      setLoadingFeed(true);
      try {
        const raw = localStorage.getItem(LS_POSTS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredPost[];
          if (Array.isArray(parsed)) setPosts(parsed);
        }

        if (gDrive.isAuthenticated) {
          const drivePosts = await gDrive.fetchPosts();
          if (drivePosts && drivePosts.length > 0) {
            setPosts(drivePosts);
            localStorage.setItem(LS_POSTS_KEY, JSON.stringify(drivePosts));
          }
        }
      } catch (e) {
        console.warn("Failed to load posts:", e);
        setFeedError("Could not load posts");
      } finally {
        setLoadingFeed(false);
      }
    };

    initPosts();
  }, [gDrive.isAuthenticated]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_POSTS_KEY, JSON.stringify(posts.slice(0, 500)));
    } catch {
      console.error("Failed to save posts to localStorage");
    }
  }, [posts]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((p) => URL.revokeObjectURL(p));
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [imagePreviews, videoPreview]);

  const handleAddImages = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const toAdd = incoming.slice(0, 50 - images.length);
    const newPreviews = toAdd.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...toAdd].slice(0, 50));
    setImagePreviews((prev) => [...prev, ...newPreviews].slice(0, 50));
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
    setYoutubeLink("");
    setVisibility("public"); // ✅ Reset privacy
    setShowComposer(false);
  };

  const convertFileToDataURL = (f: File): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(String(reader.result));
      reader.onerror = (e) => rej(e);
      reader.readAsDataURL(f);
    });

  async function handlePost() {
    const txt = composerText.trim();
    if (!txt && images.length === 0 && !videoFile && !youtubeLink.trim()) {
      alert("Share something or add media before posting.");
      return;
    }
    if (txt.length > 10000) {
      alert("Post too long. Max 10,000 characters.");
      return;
    }

    setPostingInProgress(true);
    setSyncStatus("syncing");

    const youtubeId = youtubeLink.trim() ? extractYouTubeId(youtubeLink.trim()) : null;

    const nextPost: StoredPost = {
      id: Date.now().toString(),
      author: profile?.displayName ?? profile?.email ?? "You",
      timeISO: new Date().toISOString(),
      content: txt,
      likes: 0,
      synced: false,
      youtubeLinks: youtubeId ? [youtubeLink.trim()] : [],
      // ✅ ADDED: Include privacy setting
      visibility: visibility,
    };

    try {
      if (images.length > 0) {
        const converted = await Promise.all(images.map((f) => convertFileToDataURL(f)));
        nextPost.images = converted;
      }
      if (videoFile) {
        const vUrl = await convertFileToDataURL(videoFile);
        nextPost.video = { name: videoFile.name, size: videoFile.size, url: vUrl };
      }

      if (gDrive.isAuthenticated) {
        const savedPost = await gDrive.uploadPost(nextPost, images, videoFile);
        if (savedPost) {
          nextPost.gdriveId = savedPost.gdriveId;
          nextPost.images = savedPost.images;
          if (savedPost.video) nextPost.video = savedPost.video;
          nextPost.synced = true;
        }
      }

      setPosts((prev) => [nextPost, ...prev].slice(0, 500));

      handleClearComposer();
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } catch (e) {
      console.error("Failed to post:", e);
      setSyncStatus("error");
      alert("Failed to post. Please try again.");
    } finally {
      setPostingInProgress(false);
    }
  }

  // ✅ ADDED: Delete post function
  const handleDeletePost = async (postId: string, gdriveId?: string) => {
    if (!confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
      return;
    }

    setDeletingPostId(postId);
    try {
      // Delete from Google Drive if it exists
      if (gdriveId && gDrive.isAuthenticated) {
        try {
          const response = await fetch(`https://www.googleapis.com/drive/v3/files/${gdriveId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${gDrive.accessToken}`,
            },
          });
          if (response.ok) {
            console.log("Post deleted from Google Drive:", gdriveId);
          } else {
            console.warn("Failed to delete from Drive:", response.status);
          }
        } catch (driveErr) {
          console.error("Error deleting from Drive:", driveErr);
        }
      }

      // Remove from local state
      setPosts((prev) => prev.filter((p) => p.id !== postId));

      // Update localStorage
      const stored = localStorage.getItem(LS_POSTS_KEY);
      if (stored) {
        const posts = JSON.parse(stored);
        const updated = posts.filter((p: StoredPost) => p.id !== postId);
        localStorage.setItem(LS_POSTS_KEY, JSON.stringify(updated));
      }

      console.log("Post deleted successfully");
    } catch (e) {
      console.error("Failed to delete post:", e);
      alert("Failed to delete post. Please try again.");
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleLike = (postId: string) => {
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
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-light text-white tracking-wide">Social</h1>
          <div className="flex items-center gap-3">
            {syncStatus === "syncing" && <Cloud className="w-5 h-5 text-blue-400 animate-spin" />}
            {syncStatus === "synced" && <CheckCircle className="w-5 h-5 text-green-400" />}
            {syncStatus === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}
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
                <span className="text-xs text-green-400 font-medium">✓ {gDrive.userInfo.email}</span>
                <button
                  onClick={() => gDrive.disconnect()}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors ml-2"
                  title="Disconnect"
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
                  disabled={postingInProgress}
                />
              </div>

              {imagePreviews.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
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

              {videoPreview && (
                <div className="mb-4 relative rounded-2xl overflow-hidden">
                  <video src={videoPreview} controls className="w-full max-h-80 bg-black" />
                  <button onClick={handleRemoveVideo} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              {images.length > 0 && (
                <p className="text-xs text-gray-400 mb-2">{images.length} photo(s) selected</p>
              )}
              {videoFile && (
                <p className="text-xs text-gray-400 mb-2">{videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</p>
              )}

              {/* ✅ ADDED: Privacy settings */}
              <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <Lock className="w-4 h-4" />
                  <span>Privacy:</span>
                </label>
                <div className="flex gap-3 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility === "public"}
                      onChange={(e) => setVisibility(e.target.value as "public" | "friends")}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-300">Public</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="visibility"
                      value="friends"
                      checked={visibility === "friends"}
                      onChange={(e) => setVisibility(e.target.value as "public" | "friends")}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-gray-300">Friends Only</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
              <div className="flex gap-2">
                <label className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50" title="Add photos">
                  <Camera className="w-5 h-5 text-blue-400" />
                  <input type="file" accept="image/*" multiple onChange={(e) => handleAddImages(e.target.files)} className="hidden" disabled={postingInProgress} />
                </label>
                <label className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50" title="Add video">
                  <Video className="w-5 h-5 text-purple-400" />
                  <input type="file" accept="video/*" onChange={(e) => handlePickVideo(e.target.files)} className="hidden" disabled={postingInProgress} />
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleClearComposer}
                  disabled={postingInProgress}
                  className="px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePost}
                  disabled={postingInProgress}
                  className="px-6 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {postingInProgress ? (
                    <>
                      <Upload className="w-4 h-4 animate-pulse" />
                      Posting...
                    </>
                  ) : (
                    "Share"
                  )}
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
            const author = authorDisplay(post.author);
            const avatarLetter = (author || "Y")[0].toUpperCase();
            return (
              <article key={post.id} className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden backdrop-blur-sm hover:bg-white/8 transition-colors">
                <div className="p-6 pb-4">
                  <div className="flex items-center gap-3 mb-4 justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                        {avatarLetter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{author}</p>
                        <p className="text-sm text-gray-500">
                          {formatTime(post.timeISO)} {post.synced && <span className="text-xs text-green-400">✓</span>}
                          {post.visibility === "friends" && <span className="text-xs text-yellow-400 ml-2">👥 Friends</span>}
                        </p>
                      </div>
                    </div>
                    {/* ✅ ADDED: Delete button */}
                    <button
                      onClick={() => handleDeletePost(post.id, post.gdriveId)}
                      disabled={deletingPostId === post.id}
                      className="p-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                      title="Delete post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {post.content && <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap mb-4">{post.content}</p>}
                </div>

                {post.images && post.images.length > 0 && (
                  <div className={`${post.images.length === 1 ? "" : "grid grid-cols-2 gap-1"}`}>
                    {post.images.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-full object-cover" style={{ height: post.images?.length === 1 ? "auto" : "280px" }} loading="lazy" />
                    ))}
                  </div>
                )}

                {post.video && (
                  <video src={post.video.url} controls className="w-full bg-black" style={{ maxHeight: "500px" }} />
                )}

                {post.youtubeLinks && post.youtubeLinks.length > 0 && (
                  <div className="px-6 py-4 border-t border-white/10">
                    {post.youtubeLinks.map((link, i) => {
                      const youtubeId = extractYouTubeId(link);
                      return youtubeId ? (
                        <iframe
                          key={i}
                          width="100%"
                          height="315"
                          src={`https://www.youtube.com/embed/${youtubeId}`}
                          title="YouTube video"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="rounded-lg"
                        />
                      ) : null;
                    })}
                  </div>
                )}

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