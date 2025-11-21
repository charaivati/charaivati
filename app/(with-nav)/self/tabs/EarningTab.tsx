// app/user/tabs/EarningTab.tsx
// Route /module identification: app/user/tabs/EarningTab.tsx
// Purpose: Earning page — manage pages/businesses and create posts (with images/video) attached to a selected page.
// Posts upload media to Google Drive via useGoogleDrive; metadata kept locally (and later can be sent to server).

"use client";
import React, { useEffect, useState, useRef } from "react";
import { useGoogleDrive, type PostData } from "@/hooks/useGoogleDrive"; // <- assumes your hook is at this path
import { Camera, Video, Upload, X, CheckCircle, Youtube } from "lucide-react";

type PageItem = {
  id: string;
  title: string;
  description?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
};

type EarnPost = PostData & { 
  pageId: string;
  youtubeVideoId?: string | null; // YouTube video ID for embedding
}; // reuse PostData shape and add page link

const LS_POSTS_KEY = "earn_posts_v1";

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

export default function EarningTab() {
  const gDrive = useGoogleDrive();

  // pages
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [addingPage, setAddingPage] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);

  // posts
  const [posts, setPosts] = useState<EarnPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // composer (post)
  const [composerOpen, setComposerOpen] = useState(true); // Open by default
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // load pages from database API and posts from localStorage on mount
  useEffect(() => {
    async function loadPages() {
      setLoadingPages(true);
      try {
        const res = await fetch("/api/user/pages");
        const data = await res.json();
        if (data.ok && Array.isArray(data.pages)) {
          setPages(data.pages);
        } else {
          console.warn("Failed to load pages from API:", data.error);
        }
      } catch (e) {
        console.error("Failed to load pages:", e);
      } finally {
        setLoadingPages(false);
      }
    }

    loadPages();

    setLoadingPosts(true);
    try {
      const raw = localStorage.getItem(LS_POSTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EarnPost[];
        if (Array.isArray(parsed)) setPosts(parsed);
      }
    } catch (e) {
      console.warn("Failed to load posts", e);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  // persist posts
  useEffect(() => {
    try {
      localStorage.setItem(LS_POSTS_KEY, JSON.stringify(posts.slice(0, 1000)));
    } catch (e) {
      console.error("Failed saving posts", e);
    }
  }, [posts]);

  // composer cleanup on unmount
  useEffect(() => {
    return () => {
      imagePreviews.forEach((p) => URL.revokeObjectURL(p));
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [imagePreviews, videoPreview]);

  // ---------- PAGES: add / delete ----------
  async function addPage() {
    setPageError(null);
    const title = newTitle.trim();
    const description = newDesc.trim();
    if (!title) {
      setPageError("Please enter a title");
      return;
    }
    if (pages.some((p) => p.title.toLowerCase() === title.toLowerCase())) {
      setPageError("You already have a page with this title");
      return;
    }

    setAddingPage(true);
    try {
      const res = await fetch("/api/user/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });

      const data = await res.json();
      if (data.ok && data.page) {
        // Add the page from the database response
        setPages((prev) => [data.page, ...prev]);
        setNewTitle("");
        setNewDesc("");
      } else {
        setPageError(data.error || "Failed to create page");
      }
    } catch (e) {
      console.error("addPage error", e);
      setPageError("Failed to create page. Please try again.");
    } finally {
      setAddingPage(false);
    }
  }

  async function deletePage(id: string) {
    if (!confirm("Are you sure you want to delete this page? This will also delete all posts associated with it.")) {
      return;
    }

    try {
      const res = await fetch("/api/user/pages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (data.ok) {
        // Remove page and its posts locally
        setPages((prev) => prev.filter((p) => p.id !== id));
        setPosts((prev) => prev.filter((pt) => pt.pageId !== id));
      } else {
        console.error("Failed to delete page:", data.error);
        alert("Failed to delete page: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error("deletePage error", e);
      alert("Failed to delete page. Please try again.");
    }
  }

  // ---------- POST COMPOSER helpers ----------
  const handleAddImages = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 10 - imageFiles.length);
    const newPreviews = arr.map((f) => URL.createObjectURL(f));
    setImageFiles((prev) => [...prev, ...arr].slice(0, 10));
    setImagePreviews((prev) => [...prev, ...newPreviews].slice(0, 10));
  };

  const removeImageAt = (idx: number) => {
    setImageFiles((prev) => {
      const c = [...prev];
      c.splice(idx, 1);
      return c;
    });
    setImagePreviews((prev) => {
      const c = [...prev];
      const removed = c.splice(idx, 1);
      removed.forEach((u) => URL.revokeObjectURL(u));
      return c;
    });
  };

  const pickVideo = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(f);
    setVideoPreview(URL.createObjectURL(f));
  };

  const removeVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
  };

  // Extract YouTube video ID from URL
  const extractYoutubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  };

  const handleYoutubeUrlChange = (url: string) => {
    setYoutubeUrl(url);
    const videoId = extractYoutubeId(url);
    setYoutubeVideoId(videoId);
  };

  const removeYoutube = () => {
    setYoutubeUrl("");
    setYoutubeVideoId(null);
  };

  const clearComposer = () => {
    setComposerText("");
    imagePreviews.forEach((p) => URL.revokeObjectURL(p));
    setImageFiles([]);
    setImagePreviews([]);
    removeVideo();
    removeYoutube();
    setLocalError(null);
  };

  // ---------- POST submit ----------
  const handlePost = async () => {
    setLocalError(null);

    if (!selectedPageId) {
      setLocalError("Select a page to post under.");
      return;
    }

    if (!composerText.trim() && imageFiles.length === 0 && !videoFile && !youtubeVideoId) {
      setLocalError("Write something or attach media before posting.");
      return;
    }

    // create a local post item (optimistic)
    const newPost: EarnPost = {
      id: `post-${Date.now()}`,
      author: gDrive.userInfo?.name || gDrive.userInfo?.email || "You",
      timeISO: new Date().toISOString(),
      content: composerText.trim(),
      images: imageFiles.length ? imagePreviews.map((p) => p) : undefined,
      video: videoFile ? { name: videoFile.name, size: videoFile.size, url: videoPreview || "", gdriveId: undefined } : undefined,
      youtubeVideoId: youtubeVideoId || null,
      likes: 0,
      synced: false,
      gdriveId: undefined,
      pageId: selectedPageId,
    };

    setPosts((prev) => [newPost, ...prev].slice(0, 1000));
    setPosting(true);

    try {
      // if not connected to drive - prompt user
      if (!gDrive.isAuthenticated) {
        // either auto-call connect or show instruction
        setLocalError("Not connected to Google Drive — click Connect to upload media.");
        // keep the post only locally (already added). stop here.
        setPosting(false);
        return;
      }

      // upload media via useGoogleDrive.uploadPost
      const saved = await gDrive.uploadPost(newPost, imageFiles, videoFile);
      if (saved) {
        // update the post entry with returned metadata
        setPosts((prev) =>
          prev.map((p) => (p.id === newPost.id ? { ...p, ...saved, synced: true, pageId: selectedPageId } : p))
        );
      } else {
        setLocalError("Upload failed — saved locally only.");
        setPosts((prev) => prev.map((p) => (p.id === newPost.id ? { ...p, synced: false } : p)));
      }

      clearComposer();
    } catch (e) {
      console.error("handlePost error", e);
      setLocalError("Failed to post. See console.");
      // leave optimistic post as unsynced
      setPosts((prev) => prev.map((p) => (p.id === newPost.id ? { ...p, synced: false } : p)));
    } finally {
      setPosting(false);
    }
  };


  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-semibold">Earning — Pages & Posts</h3>
        <div className="flex items-center gap-3">
          {!gDrive.isAuthenticated ? (
            <button onClick={() => gDrive.connectDrive()} className="px-4 py-2 rounded bg-blue-600 text-white">
              Connect Google Drive
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-green-400">✓ {gDrive.userInfo?.email}</span>
              <button onClick={() => gDrive.disconnect()} className="text-sm px-2 py-1 rounded bg-red-600 text-white">Disconnect</button>
            </div>
          )}
        </div>
      </div>

      {/* Business/Page Selection - At Top */}
      <div className="mb-6 p-5 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl border border-blue-500/30">
        <h4 className="text-lg font-semibold mb-3">Select Business/Page to Tag Your Post</h4>
        {pages.length === 0 ? (
          <div className="p-4 bg-white/6 rounded text-center">
            <p className="text-gray-300 mb-3">No pages yet. Create one below to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {pages.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPageId(p.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedPageId === p.id
                    ? "border-blue-500 bg-blue-500/20 shadow-lg"
                    : "border-gray-600 bg-black/40 hover:border-blue-400 hover:bg-blue-500/10"
                }`}
              >
                <div className="font-semibold text-left">{p.title}</div>
                {p.description && <div className="text-xs text-gray-400 mt-1 text-left">{p.description}</div>}
                <div className="text-xs text-gray-500 mt-2 text-left">{posts.filter((pt) => pt.pageId === p.id).length} post(s)</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Post Composer Box - Prominent */}
      <div className="mb-6 p-5 bg-black/60 rounded-xl border border-gray-700 shadow-xl">
        <h4 className="text-lg font-semibold mb-4">Create New Post</h4>
        
        <textarea 
          value={composerText} 
          onChange={(e) => setComposerText(e.target.value)} 
          placeholder="What's on your mind? Write your post here..." 
          className="w-full min-h-[120px] p-4 rounded-lg bg-white/5 border border-gray-600 mb-4 focus:outline-none focus:border-blue-500" 
        />

        {/* Image Previews */}
        {imagePreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden">
                <img src={src} className="w-full h-32 object-cover" alt="" />
                <button onClick={() => removeImageAt(i)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/80 flex items-center justify-center hover:bg-red-600 transition">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Video Preview */}
        {videoPreview && (
          <div className="mb-4 relative rounded-lg overflow-hidden">
            <video src={videoPreview} controls className="w-full max-h-80 rounded-lg" />
            <button onClick={removeVideo} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/80 flex items-center justify-center hover:bg-red-600 transition">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        )}

        {/* YouTube Embed Preview */}
        {youtubeVideoId && (
          <div className="mb-4 relative rounded-lg overflow-hidden">
            <div className="aspect-video w-full">
              <iframe
                title="YouTube video"
                src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full rounded-lg"
              />
            </div>
            <button onClick={removeYoutube} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/80 flex items-center justify-center hover:bg-red-600 transition">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        )}

        {/* Media Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="px-4 py-2 bg-white/10 rounded-lg cursor-pointer inline-flex items-center gap-2 hover:bg-white/20 transition">
            <Camera className="w-4 h-4" />
            <span className="text-sm">Images</span>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleAddImages(e.target.files)} className="hidden" />
          </label>

          <label className="px-4 py-2 bg-white/10 rounded-lg cursor-pointer inline-flex items-center gap-2 hover:bg-white/20 transition">
            <Video className="w-4 h-4" />
            <span className="text-sm">Video</span>
            <input ref={videoInputRef} type="file" accept="video/*" onChange={(e) => pickVideo(e.target.files)} className="hidden" />
          </label>

          <div className="flex-1 flex items-center gap-2">
            <Youtube className="w-4 h-4 text-red-500" />
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => handleYoutubeUrlChange(e.target.value)}
              placeholder="Paste YouTube URL here..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-gray-600 focus:outline-none focus:border-red-500 text-sm"
            />
          </div>
        </div>

        {/* Error Messages */}
        {localError && <div className="text-red-400 text-sm mb-3">{localError}</div>}
        {!gDrive.isAuthenticated && <div className="text-yellow-300 text-sm mb-3">Connect Drive to upload media; otherwise posts remain local only.</div>}

        {/* Post Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {gDrive.uploadProgress && (
              <div className="text-sm text-gray-300">
                Upload: {gDrive.uploadProgress.percent}% 
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={clearComposer} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition">
              Clear
            </button>
            <button 
              onClick={handlePost} 
              disabled={posting || !selectedPageId} 
              className="px-6 py-2 rounded-lg bg-blue-600 text-white flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {posting ? "Posting…" : (<><Upload className="w-4 h-4" />Post</>)}
            </button>
          </div>
        </div>
      </div>

      {/* Create Page Form */}
      <div className="p-4 bg-black/40 rounded-lg mb-6">
        <div className="mb-2 text-sm text-gray-300 font-semibold">Create a new page/business</div>
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Page or business name" className="w-full p-2 rounded bg-white/6 mb-2" />
        <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Short description (optional)" className="w-full p-2 rounded bg-white/6 mb-2" rows={3} />
        {pageError && <div className="text-red-400 text-sm mb-2">{pageError}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={() => { setNewTitle(""); setNewDesc(""); setPageError(null); }} className="px-4 py-2 rounded bg-gray-700" disabled={addingPage}>
            Cancel
          </button>
          <button onClick={addPage} className="px-4 py-2 rounded bg-green-600" disabled={addingPage}>
            {addingPage ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

    </div>
  );
}
