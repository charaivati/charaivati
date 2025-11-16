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
} from "lucide-react";
import { useGoogleDrive, type PostData } from "@/hooks/useGoogleDrive";

type PageItem = {
  id: string;
  title: string;
  description?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
};

type StoredPost = PostData & {
  youtubeLinks?: string[];
};

const LS_POSTS_KEY = "ch_social_posts_v3";

async function safeFetchJson(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, rawText: text, json: null };
  }
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

// Extract YouTube video ID from URL
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

function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?modestbranding=1`;
}

export default function EarningTab() {
  const gDrive = useGoogleDrive();

  // Pages/Business state
  const [pages, setPages] = useState<PageItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Post creation state
  const [composerText, setComposerText] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<string>("");
  const [selectedDrive, setSelectedDrive] = useState<"google" | "onedrive">("google");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [youtubeLink, setYoutubeLink] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [postingInProgress, setPostingInProgress] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load pages
  useEffect(() => {
    let alive = true;
    setLoading(true);
    safeFetchJson("/api/user/pages", { method: "GET", credentials: "include" })
      .then((r) => {
        if (!alive) return;
        if (r.ok && r.json?.ok) {
          setPages(r.json.pages || []);
          if (r.json.pages?.length > 0) {
            setSelectedBusiness(r.json.pages[0].id);
          }
        } else {
          setPages([]);
          setError(r.json?.error || r.rawText || `Status ${r.status}`);
        }
      })
      .catch((e) => {
        console.error("fetch pages error", e);
        setPages([]);
        setError("Could not load pages");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // Add page
  async function addPage() {
    setError(null);
    const title = newTitle.trim();
    const description = newDesc.trim();
    if (!title) {
      setError("Please enter a title");
      return;
    }

    if (pages?.some((p) => p.title.toLowerCase() === title.toLowerCase())) {
      setError("You already have a page with this title");
      return;
    }

    const temp: PageItem = {
      id: `temp-${Date.now()}`,
      title,
      description,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };

    setPages((prev) => (prev ? [temp, ...prev] : [temp]));
    setAdding(true);

    try {
      const resp = await safeFetchJson("/api/user/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, description }),
      });

      if (!resp.ok) {
        const m = resp.json?.error || resp.rawText || `Status ${resp.status}`;
        throw new Error(m);
      }
      if (!resp.json?.ok) throw new Error(resp.json?.error || "Unknown error");

      const created = resp.json.page as PageItem;
      setPages((prev) => (prev ? prev.map((p) => (p.id === temp.id ? created : p)) : [created]));
      setNewTitle("");
      setNewDesc("");
      setSelectedBusiness(created.id);
    } catch (err: any) {
      console.error("add page error", err);
      setPages((prev) => (prev ? prev.filter((p) => p.id !== temp.id) : []));
      setError(err?.message || "Failed to add page");
    } finally {
      setAdding(false);
    }
  }

  async function deletePage(id: string) {
    setPages((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    if (selectedBusiness === id) {
      setSelectedBusiness(pages?.[0]?.id || "");
    }
  }

  // Post handlers
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
    setShowComposer(false);
  };

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
    if (!selectedBusiness) {
      alert("Please select a business to post from.");
      return;
    }

    setPostingInProgress(true);
    setSyncStatus("syncing");

    const nextPost: StoredPost = {
      id: Date.now().toString(),
      author: selectedBusiness,
      timeISO: new Date().toISOString(),
      content: txt,
      likes: 0,
      synced: false,
      youtubeLinks: youtubeLink.trim() ? [youtubeLink.trim()] : [],
    };

    try {
      if (gDrive.isAuthenticated || gDrive.accessToken) {
        const saved = await gDrive.uploadPost(nextPost, images, videoFile);
        if (saved) {
          nextPost.gdriveId = saved.gdriveId;
          nextPost.images = saved.images;
          if (saved.video) nextPost.video = saved.video;
          nextPost.synced = true;
          console.log("Post uploaded successfully:", nextPost);
        }
      } else {
        console.warn("Not connected to Drive: post saved locally without media");
      }

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

  return (
    <div className="w-full bg-gradient-to-br from-gray-900 via-black to-gray-900 min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/5 mb-6">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-3xl font-light text-white tracking-wide">Earning</h1>
          <div className="flex items-center gap-3">
            {syncStatus === "syncing" && <Cloud className="w-5 h-5 text-blue-400 animate-spin" />}
            {syncStatus === "synced" && <CheckCircle className="w-5 h-5 text-green-400" />}
            {syncStatus === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}

            {!gDrive.isAuthenticated && !gDrive.accessToken && (
              <button
                onClick={() => gDrive.connectDrive()}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm hover:from-blue-600 hover:to-blue-700 transition-all font-medium"
              >
                Connect Drive
              </button>
            )}

            {(gDrive.isAuthenticated || gDrive.accessToken) && (
              <div className="text-xs text-green-400 font-medium px-3 py-1 rounded-full bg-green-500/10">
                ✓ Connected
              </div>
            )}
          </div>
        </div>

        {gDrive.uploadProgress && (
          <div className="h-1 bg-gray-700">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
              style={{ width: `${gDrive.uploadProgress.percent}%` }}
            />
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-20">
        {/* Post Creation Block */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Create Post
          </h2>

          {!showComposer ? (
            <button
              onClick={() => setShowComposer(true)}
              className="w-full p-6 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-white/10 hover:border-white/20 transition-all text-left"
            >
              <span className="text-gray-300">What would you like to share from your business?</span>
            </button>
          ) : (
            <div className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden backdrop-blur-sm">
              <div className="p-6">
                {/* Business & Drive Selection */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2 font-semibold">Business/Page</label>
                    <select
                      value={selectedBusiness}
                      onChange={(e) => setSelectedBusiness(e.target.value)}
                      disabled={postingInProgress}
                      className="w-full p-2 rounded bg-white/10 border border-white/20 text-white text-sm"
                    >
                      <option value="">Select business...</option>
                      {pages?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-2 font-semibold">Drive Service</label>
                    <select
                      value={selectedDrive}
                      onChange={(e) => setSelectedDrive(e.target.value as "google" | "onedrive")}
                      disabled={postingInProgress}
                      className="w-full p-2 rounded bg-white/10 border border-white/20 text-white text-sm"
                    >
                      <option value="google">Google Drive</option>
                      <option value="onedrive">OneDrive</option>
                    </select>
                  </div>
                </div>

                {/* Composer */}
                <div className="mb-4">
                  <textarea
                    ref={textareaRef}
                    placeholder="Share your business update..."
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm outline-none resize-none min-h-[100px]"
                    autoFocus
                    disabled={postingInProgress}
                  />
                </div>

                {/* Image Previews */}
                {imagePreviews.length > 0 && (
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden group">
                        <img src={src} alt="" className="w-full h-24 object-cover" />
                        <button
                          onClick={() => handleRemoveImageAt(i)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Video Preview */}
                {videoPreview && (
                  <div className="mb-4 relative rounded-lg overflow-hidden">
                    <video src={videoPreview} controls className="w-full max-h-64 bg-black" />
                    <button
                      onClick={handleRemoveVideo}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}

                {images.length > 0 && <p className="text-xs text-gray-400 mb-2">{images.length} photo(s)</p>}
                {videoFile && <p className="text-xs text-gray-400 mb-2">{videoFile.name}</p>}

                {/* YouTube Link Input */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-2 font-semibold">YouTube Link (optional)</label>
                  <input
                    type="text"
                    placeholder="Paste YouTube URL (youtube.com/watch?v=... or youtu.be/...)"
                    value={youtubeLink}
                    onChange={(e) => setYoutubeLink(e.target.value)}
                    disabled={postingInProgress}
                    className="w-full p-2 rounded bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm"
                  />
                  {youtubeLink && extractYouTubeId(youtubeLink) && <p className="text-xs text-green-400 mt-1">✓ Valid YouTube link</p>}
                  {youtubeLink && !extractYouTubeId(youtubeLink) && <p className="text-xs text-red-400 mt-1">✗ Invalid YouTube link</p>}
                </div>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex gap-2">
                  <label className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors">
                    <Camera className="w-4 h-4 text-blue-400" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleAddImages(e.target.files)}
                      className="hidden"
                      disabled={postingInProgress}
                    />
                  </label>
                  <label className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors">
                    <Video className="w-4 h-4 text-purple-400" />
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => handlePickVideo(e.target.files)}
                      className="hidden"
                      disabled={postingInProgress}
                    />
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleClearComposer}
                    disabled={postingInProgress}
                    className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 text-sm transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePost}
                    disabled={postingInProgress}
                    className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium flex items-center gap-2 hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50"
                  >
                    {postingInProgress ? (
                      <>
                        <Upload className="w-4 h-4 animate-pulse" />
                        Posting...
                      </>
                    ) : (
                      "Publish Post"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Businesses Section */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Your Businesses</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {loading ? (
              <div className="col-span-2 p-4 bg-white/5 rounded-lg">Loading...</div>
            ) : pages && pages.length > 0 ? (
              pages.map((page) => (
                <div key={page.id} className="p-4 bg-gradient-to-br from-white/10 to-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white text-lg">{page.title}</h3>
                      {page.description && <p className="text-sm text-gray-400 mt-1">{page.description}</p>}
                      <p className="text-xs text-gray-500 mt-3">Created {new Date(page.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button className="px-3 py-1 rounded text-xs bg-white/10 hover:bg-white/20 text-white transition-colors">
                        View
                      </button>
                      <button
                        onClick={() => deletePage(page.id)}
                        className="px-3 py-1 rounded text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 p-6 bg-white/5 rounded-lg text-center">
                <p className="text-gray-400">No businesses yet</p>
              </div>
            )}
          </div>

          {/* Add Business Form */}
          <div className="p-6 bg-gradient-to-br from-white/5 to-transparent rounded-xl border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Business</h3>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Business name"
              className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm mb-3"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm resize-none min-h-[80px] mb-3"
              rows={3}
            />
            {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setNewTitle("");
                  setNewDesc("");
                  setError(null);
                }}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-sm transition-colors disabled:opacity-50"
                disabled={adding}
              >
                Cancel
              </button>
              <button
                onClick={addPage}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-medium hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50"
                disabled={adding}
              >
                {adding ? "Creating..." : "Create Business"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}