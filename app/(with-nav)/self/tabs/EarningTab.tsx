// app/user/tabs/EarningTab.tsx
// Route /module identification: app/user/tabs/EarningTab.tsx
// Purpose: Earning page — manage pages/businesses and create posts (with images/video) attached to a selected page.
// Posts upload media to Google Drive via useGoogleDrive; metadata kept locally (and later can be sent to server).

"use client";
import React, { useEffect, useState, useRef } from "react";
import { useGoogleDrive, type PostData } from "@/hooks/useGoogleDrive"; // <- assumes your hook is at this path
import { Camera, Video, Upload, X, CheckCircle } from "lucide-react";

type PageItem = {
  id: string;
  title: string;
  description?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
};

type EarnPost = PostData & { pageId: string }; // reuse PostData shape and add page link

const LS_PAGES_KEY = "earn_pages_v1";
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // load pages & posts from localStorage on mount
  useEffect(() => {
    setLoadingPages(true);
    try {
      const raw = localStorage.getItem(LS_PAGES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PageItem[];
        if (Array.isArray(parsed)) setPages(parsed);
      }
    } catch (e) {
      console.warn("Failed to load pages", e);
    } finally {
      setLoadingPages(false);
    }

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

  // persist pages
  useEffect(() => {
    try {
      localStorage.setItem(LS_PAGES_KEY, JSON.stringify(pages));
    } catch (e) {
      console.error("Failed saving pages", e);
    }
  }, [pages]);

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
    const temp: PageItem = {
      id: `page-${Date.now()}`,
      title,
      description,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };
    setPages((prev) => [temp, ...prev]);
    try {
      // if you have server route to persist pages, call it here.
      setNewTitle("");
      setNewDesc("");
    } catch (e) {
      console.error("addPage error", e);
      setPages((prev) => prev.filter((p) => p.id !== temp.id));
      setPageError("Failed to create page");
    } finally {
      setAddingPage(false);
    }
  }

  function deletePage(id: string) {
    // remove page and its posts locally
    setPages((prev) => prev.filter((p) => p.id !== id));
    setPosts((prev) => prev.filter((pt) => pt.pageId !== id));
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

  const clearComposer = () => {
    setComposerText("");
    imagePreviews.forEach((p) => URL.revokeObjectURL(p));
    setImageFiles([]);
    setImagePreviews([]);
    removeVideo();
    setComposerOpen(false);
    setLocalError(null);
  };

  // ---------- POST submit ----------
  const handlePost = async () => {
    setLocalError(null);

    if (!selectedPageId) {
      setLocalError("Select a page to post under.");
      return;
    }

    if (!composerText.trim() && imageFiles.length === 0 && !videoFile) {
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

  // small helper: posts for currently selected page
  const postsFor = (pageId: string) => posts.filter((p) => p.pageId === pageId);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
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

      {/* Pages grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {pages.length === 0 ? (
          <div className="col-span-2 p-4 bg-white/6 rounded">No pages yet — create one below.</div>
        ) : (
          pages.map((p) => (
            <div key={p.id} className="p-4 bg-black/40 rounded">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="font-semibold">{p.title}</div>
                  {p.description && <div className="text-sm text-gray-400 mt-1">{p.description}</div>}
                  <div className="text-xs text-gray-500 mt-2">Created {new Date(p.createdAt).toLocaleString()}</div>
                  <div className="mt-3 text-sm">
                    <strong>{postsFor(p.id).length}</strong> post(s)
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-right">
                  <button className="text-xs px-2 py-1 rounded bg-white/6" onClick={() => { setSelectedPageId(p.id); setComposerOpen(true); }}>
                    Post
                  </button>
                  <button onClick={() => deletePage(p.id)} className="text-xs px-2 py-1 rounded bg-red-600">Delete</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create page form */}
      <div className="p-4 bg-black/40 rounded mb-6">
        <div className="mb-2 text-sm text-gray-300">Create a new page/business</div>
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

      {/* Composer (for posts) */}
      <div className="mb-6 p-4 bg-black/40 rounded">
        <div className="flex items-center gap-3 mb-3">
          <select value={selectedPageId ?? ""} onChange={(e) => setSelectedPageId(e.target.value || null)} className="p-2 rounded bg-white/6">
            <option value="">Select page to post under...</option>
            {pages.map((p) => <option value={p.id} key={p.id}>{p.title}</option>)}
          </select>

          <button onClick={() => { setComposerOpen((v) => !v); }} className="px-3 py-2 rounded bg-white/6">
            {composerOpen ? "Hide composer" : "New post"}
          </button>
        </div>

        {composerOpen && (
          <>
            <textarea value={composerText} onChange={(e) => setComposerText(e.target.value)} placeholder="Write your post..." className="w-full min-h-[100px] p-3 rounded bg-white/5 mb-3" />
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative rounded overflow-hidden">
                    <img src={src} className="w-full h-28 object-cover" alt="" />
                    <button onClick={() => removeImageAt(i)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {videoPreview && (
              <div className="mb-3 relative">
                <video src={videoPreview} controls className="w-full max-h-60" />
                <button onClick={removeVideo} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="p-2 bg-white/6 rounded cursor-pointer inline-flex items-center gap-2">
                <Camera className="w-4 h-4" />
                <span className="text-sm">Add images</span>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleAddImages(e.target.files)} className="hidden" />
              </label>

              <label className="p-2 bg-white/6 rounded cursor-pointer inline-flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span className="text-sm">Add video</span>
                <input ref={videoInputRef} type="file" accept="video/*" onChange={(e) => pickVideo(e.target.files)} className="hidden" />
              </label>

              <div className="ml-auto flex items-center gap-2">
                {gDrive.uploadProgress && (
                  <div className="text-sm text-gray-300 mr-2">
                    Upload: {gDrive.uploadProgress.percent}% 
                  </div>
                )}
                <button onClick={clearComposer} className="px-3 py-2 rounded bg-gray-700">Clear</button>
                <button onClick={handlePost} disabled={posting} className="px-4 py-2 rounded bg-blue-600 text-white flex items-center gap-2">
                  {posting ? "Posting…" : (<><Upload className="w-4 h-4" />Post</>)}
                </button>
              </div>
            </div>

            {localError && <div className="text-red-400 text-sm mt-2">{localError}</div>}
            {!gDrive.isAuthenticated && <div className="text-yellow-300 text-sm mt-2">Connect Drive to upload media; otherwise posts remain local only.</div>}
          </>
        )}
      </div>

      {/* Posts list (grouped by page) */}
      <div className="space-y-6">
        {pages.map((p) => (
          <section key={p.id}>
            <h4 className="text-lg font-medium mb-2">{p.title}</h4>
            <div className="space-y-3">
              {postsFor(p.id).length === 0 ? (
                <div className="p-4 bg-white/6 rounded">No posts for this page yet.</div>
              ) : (
                postsFor(p.id).map((pt) => (
                  <article key={pt.id} className="p-4 bg-black/40 rounded">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="text-sm text-gray-300 mb-2">{pt.content}</div>
                        {pt.images && pt.images.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                            {pt.images.map((u, i) => <img key={i} src={u} className="w-full h-40 object-cover rounded" alt="" />)}
                          </div>
                        )}
                        {pt.video && <video src={pt.video.url || pt.video.name} controls className="w-full max-h-72 rounded mb-2" />}
                        <div className="text-xs text-gray-500">
                          {new Date(pt.timeISO).toLocaleString()} {pt.synced ? <span className="ml-2 text-green-400">✓ synced</span> : <span className="ml-2 text-yellow-400">local</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <button className="px-2 py-1 rounded bg-white/6 text-xs">Edit</button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
