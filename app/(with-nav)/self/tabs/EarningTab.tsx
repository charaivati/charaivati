// app/(with-nav)/self/tabs/EarningTab.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Video,
  X,
  Cloud,
  AlertCircle,
  Upload,
  CheckCircle,
  Trash2,
  LucideYoutube,
} from "lucide-react";
import { CollapsibleSection } from "@/components/self/shared";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import SelectTabsModal from "@/components/SelectTabsModal";

type PageItem = {
  id: string;
  title: string;
  description?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  type?: string;
  pageType?: string;
};

const LS_SELECTED_BUSINESS = "earn_selected_business_v1";
const LS_SELECTED_PRIVACY = "earn_selected_privacy_v1";
const LS_SELECTED_TAGS = "earn_selected_tags_v1";

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

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
    /(?:v=|\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function EarningTab() {
  const router = useRouter();
  const cloudinary = useCloudinaryUpload();

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [pages, setPages] = useState<PageItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [hbSpecialty, setHbSpecialty] = useState<string>("");
  const [hbCredentials, setHbCredentials] = useState<string>("");
  const [hbConsultMode] = useState<string>("manual");
  const [hbTagsInput, setHbTagsInput] = useState<string>("");
  const [hbTiers, setHbTiers] = useState<{ name: string; price: string; description: string }[]>([
    { name: "", price: "", description: "" },
  ]);
  const [selectedType, setSelectedType] = useState<"health" | "store" | "learning" | "service" | "helping">("store");
  const [courseType, setCourseType] = useState<"skill" | "academic" | "art" | "growth">("skill");

  const [composerText, setComposerText] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<string>("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [youtubeLink, setYoutubeLink] = useState("");
  const [showComposer, setShowComposer] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [postingInProgress, setPostingInProgress] = useState(false);

  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [slugTags, setSlugTags] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [videoMenuOpen, setVideoMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const sb = localStorage.getItem(LS_SELECTED_BUSINESS);
      const sp = localStorage.getItem(LS_SELECTED_PRIVACY);
      const st = localStorage.getItem(LS_SELECTED_TAGS);
      if (sb) setSelectedBusiness(sb);
      if (sp === "friends") setVisibility("friends");
      if (st) setSlugTags(JSON.parse(st));
    } catch (e) {
      /* ignore */
    }

    let alive = true;
    setLoading(true);
    safeFetchJson("/api/user/pages", { method: "GET", credentials: "include" })
      .then((r) => {
        if (!alive) return;
        if (r.ok && r.json?.ok) {
          setPages(r.json.pages || []);
          if (r.json.pages?.length > 0 && !selectedBusiness) {
            const firstId = r.json.pages[0].id;
            setSelectedBusiness(firstId);
            try {
              localStorage.setItem(LS_SELECTED_BUSINESS, firstId);
            } catch {}
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

  useEffect(() => {
    try {
      if (selectedBusiness) localStorage.setItem(LS_SELECTED_BUSINESS, selectedBusiness);
      if (visibility) localStorage.setItem(LS_SELECTED_PRIVACY, visibility);
      if (slugTags) localStorage.setItem(LS_SELECTED_TAGS, JSON.stringify(slugTags || []));
    } catch (e) {
      /* ignore */
    }
  }, [selectedBusiness, visibility, slugTags]);

  function resetHealthForm() {
    setHbSpecialty("");
    setHbCredentials("");
    setHbTagsInput("");
    setHbTiers([{ name: "", price: "", description: "" }]);
  }

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
    if (selectedType === "health" && !hbSpecialty) {
      setError("Please select a specialty");
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
        body: JSON.stringify({ title, description, type: selectedType === "health" ? "health" : "standard", pageType: selectedType === "health" ? "store" : selectedType === "helping" ? "helping" : selectedType }),
      });
      if (!resp.ok) {
        const m = resp.json?.error || resp.rawText || `Status ${resp.status}`;
        throw new Error(m);
      }
      if (!resp.json?.ok) throw new Error(resp.json?.error || "Unknown error");
      const created = resp.json.page as PageItem;
      setPages((prev) => (prev ? prev.map((p) => (p.id === temp.id ? created : p)) : [created]));

      if (selectedType === "learning") {
        await safeFetchJson("/api/course", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ pageId: created.id, courseType }),
        });
      }

      if (selectedType === "health") {
        const tagSet = new Set(
          hbTagsInput.split(",").map((t) => t.trim()).filter(Boolean)
        );
        tagSet.add(hbSpecialty);
        const hbResp = await safeFetchJson("/api/health-business/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            pageId: created.id,
            specialty: hbSpecialty,
            credentials: hbCredentials.trim() || null,
            consultationMode: hbConsultMode,
            searchTags: Array.from(tagSet),
            tiers: hbTiers.filter((t) => t.name.trim()),
          }),
        });
        if (!hbResp.ok || !hbResp.json?.ok) {
          throw new Error(hbResp.json?.error || "Failed to save health business details");
        }
      }

      if (selectedType === "helping") {
        await safeFetchJson("/api/helping-initiative", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ pageId: created.id }),
        });
      }

      setNewTitle("");
      setNewDesc("");
      setSelectedType("store");
      setCourseType("skill");
      resetHealthForm();
      setSelectedBusiness(created.id);
      try {
        localStorage.setItem(LS_SELECTED_BUSINESS, created.id);
      } catch {}
    } catch (err: any) {
      console.error("add page error", err);
      setPages((prev) => (prev ? prev.filter((p) => p.id !== temp.id) : []));
      setError(err?.message || "Failed to add page");
    } finally {
      setAdding(false);
    }
  }

  const [openingStore, setOpeningStore] = useState<string | null>(null);

  const openStore = useCallback(async (pageId: string) => {
    setOpeningStore(pageId);
    try {
      const res = await fetch(`/api/store/for-page/${pageId}`, { credentials: "include" });
      if (res.ok) {
        const { storeId } = await res.json();
        router.push(`/store/${storeId}`);
      }
    } finally {
      setOpeningStore(null);
    }
  }, [router]);

  async function deletePage(id: string) {
    if (!confirm("Are you sure you want to delete this initiative?")) return;
    setDeleting(id);
    try {
      const resp = await safeFetchJson("/api/user/pages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id }),
      });
      if (resp.ok && resp.json?.ok) {
        setPages((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
        if (selectedBusiness === id) {
          const fallback = pages?.find((p) => p.id !== id)?.id || "";
          setSelectedBusiness(fallback);
          if (fallback) localStorage.setItem(LS_SELECTED_BUSINESS, fallback);
        }
      } else {
        alert(resp.json?.error || "Failed to delete page");
      }
    } catch (err) {
      console.error("delete page error", err);
      alert("Failed to delete page");
    } finally {
      setDeleting(null);
    }
  }

  const handleAddImages = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    const toAdd = incoming.slice(0, 50 - images.length);
    const newPreviews = toAdd.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...toAdd].slice(0, 50));
    setImagePreviews((prev) => [...prev, ...newPreviews].slice(0, 50));
    if (imageInputRef.current) imageInputRef.current.value = "";
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
    if (videoInputRef.current) videoInputRef.current.value = "";
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
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  function augmentWithParentSlugs(slugs: string[]) {
    const set = new Set(slugs);
    for (const s of slugs) {
      if (s.includes("-")) {
        const prefix = s.split("-")[0];
        if (prefix && prefix.length > 1) set.add(prefix);
      }
    }
    return Array.from(set);
  }

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
    const finalSlugTags = augmentWithParentSlugs(slugTags || []);
    const youtubeLinks = youtubeId ? [youtubeLink.trim()] : [];

    try {
      const { imageUrls, videoUrl } = await cloudinary.uploadFiles(images, videoFile);

      const dbRes = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: txt || null,
          imageUrls,
          videoUrl,
          youtubeLinks,
          slugTags: finalSlugTags,
          pageId: selectedBusiness || null,
          visibility,
        }),
      });

      const dbData = await dbRes.json();
      if (dbData.ok && dbData.post) {
        handleClearComposer();
        setSyncStatus("synced");
        setTimeout(() => setSyncStatus("idle"), 2000);
      } else {
        setSyncStatus("error");
        alert(`Failed to save post: ${dbData.error}`);
      }
    } catch (e) {
      console.error("Failed to post:", e);
      setSyncStatus("error");
      alert("Failed to post. Please try again.");
    } finally {
      setPostingInProgress(false);
    }
  }

  const publishDisabled = postingInProgress || cloudinary.uploading;
  const publishLabel = postingInProgress || cloudinary.uploading ? "Posting..." : "Publish Post";

  const syncIndicator = syncStatus === "syncing" ? (
    <Cloud className="w-4 h-4 text-blue-400 animate-spin" />
  ) : syncStatus === "synced" ? (
    <CheckCircle className="w-4 h-4 text-green-400" />
  ) : syncStatus === "error" ? (
    <AlertCircle className="w-4 h-4 text-red-400" />
  ) : null;

  return (
    <div className="text-white space-y-5">

      {/* Upload progress bar */}
      {cloudinary.uploading && cloudinary.progress > 0 && (
        <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
            style={{ width: `${cloudinary.progress}%` }}
          />
        </div>
      )}

      {/* ── Create Post ── */}
      <CollapsibleSection
        title="Create Post"
        subtitle="Share content with your community"
        defaultOpen={true}
        headerExtra={syncIndicator}
      >
        {/* Business, Privacy & Tag Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 p-3 rounded-xl bg-gray-950/60 border border-gray-800">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-semibold uppercase tracking-wider">Initiative / Page</label>
            <select
              value={selectedBusiness}
              onChange={(e) => setSelectedBusiness(e.target.value)}
              className="w-full p-2 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm"
            >
              <option value="">— Select an initiative —</option>
              {pages?.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-semibold uppercase tracking-wider">Privacy</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "friends")}
              className="w-full p-2 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm"
            >
              <option value="public">🌍 Public</option>
              <option value="friends">👥 Friends Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-semibold uppercase tracking-wider">Tag Sections</label>
            <button
              type="button"
              onClick={() => setShowTagModal(true)}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 hover:border-gray-500 text-sm text-white transition text-left"
            >
              {slugTags.length === 0 ? "Select tabs to tag" : `${slugTags.length} tag(s) selected`}
            </button>
          </div>
        </div>

        {/* Composer */}
        <textarea
          ref={textareaRef}
          placeholder="Share something..."
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500 outline-none resize-none min-h-[100px] mb-4"
          disabled={postingInProgress}
        />

        {/* Image previews */}
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

        {/* Video preview */}
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

        {/* YouTube */}
        <div className="flex items-center gap-2 mb-4">
          <LucideYoutube className="w-4 h-4 text-red-500 shrink-0" />
          <input
            type="text"
            placeholder="Paste YouTube URL (optional)"
            value={youtubeLink}
            onChange={(e) => setYoutubeLink(e.target.value)}
            disabled={postingInProgress}
            className="flex-1 p-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500 outline-none"
          />
          {youtubeLink && extractYouTubeId(youtubeLink) && <span className="text-xs text-green-400">✓</span>}
          {youtubeLink && !extractYouTubeId(youtubeLink) && <span className="text-xs text-red-400">✗</span>}
        </div>

        {/* Hidden file inputs */}
        <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={(e) => handleAddImages(e.target.files)} className="hidden" disabled={postingInProgress} />
        <input ref={videoInputRef} type="file" accept="video/*" onChange={(e) => handlePickVideo(e.target.files)} className="hidden" disabled={postingInProgress} />

        {/* Action bar */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-800">
          {/* Media buttons with Gallery / Camera sub-menu */}
          <div className="flex gap-2">
            {/* Photo button */}
            <div className="relative">
              <button
                onClick={() => { setPhotoMenuOpen(v => !v); setVideoMenuOpen(false); }}
                disabled={postingInProgress}
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-900 hover:border-gray-500 text-sm text-gray-300 transition-colors disabled:opacity-50"
              >
                <Camera className="w-4 h-4 text-blue-400" />
                <span className="hidden sm:inline">Photo</span>
              </button>
              {photoMenuOpen && (
                <div className="absolute bottom-full mb-1 left-0 z-20 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-lg min-w-[130px]">
                  <button type="button" onClick={() => { setPhotoMenuOpen(false); imageInputRef.current?.removeAttribute("capture"); imageInputRef.current?.click(); }}
                    className="w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                    Gallery
                  </button>
                  <button type="button" onClick={() => { setPhotoMenuOpen(false); imageInputRef.current?.setAttribute("capture", "environment"); imageInputRef.current?.click(); }}
                    className="w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                    Camera
                  </button>
                </div>
              )}
            </div>
            {/* Video button */}
            <div className="relative">
              <button
                onClick={() => { setVideoMenuOpen(v => !v); setPhotoMenuOpen(false); }}
                disabled={postingInProgress}
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-900 hover:border-gray-500 text-sm text-gray-300 transition-colors disabled:opacity-50"
              >
                <Video className="w-4 h-4 text-purple-400" />
                <span className="hidden sm:inline">Video</span>
              </button>
              {videoMenuOpen && (
                <div className="absolute bottom-full mb-1 left-0 z-20 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-lg min-w-[130px]">
                  <button type="button" onClick={() => { setVideoMenuOpen(false); videoInputRef.current?.removeAttribute("capture"); videoInputRef.current?.click(); }}
                    className="w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                    Gallery
                  </button>
                  <button type="button" onClick={() => { setVideoMenuOpen(false); videoInputRef.current?.setAttribute("capture", "environment"); videoInputRef.current?.click(); }}
                    className="w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                    Camera
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClearComposer}
              disabled={postingInProgress}
              className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 hover:border-gray-500 text-sm text-gray-300 transition-colors disabled:opacity-50"
            >
              Clear
            </button>
            <button
              onClick={handlePost}
              disabled={publishDisabled}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium flex items-center gap-2 hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {postingInProgress || cloudinary.uploading ? (
                <><Upload className="w-4 h-4 animate-pulse" /> Posting...</>
              ) : (
                publishLabel
              )}
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Your Businesses ── */}
      <CollapsibleSection
        title="Your Initiatives"
        subtitle="Manage your pages and initiatives"
        defaultOpen={true}
      >
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 py-2">Loading...</p>
          ) : pages && pages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="p-4 rounded-xl border border-gray-800 bg-gray-950/60 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">{page.title}</h3>
                      {page.description && <p className="text-sm text-gray-400 mt-0.5">{page.description}</p>}
                      <p className="text-xs text-gray-600 mt-2">Created {new Date(page.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {page.pageType === "helping" ? (
                        <>
                          <a
                            href={`/business/helping/${page.id}`}
                            className="px-3 py-1 rounded-lg text-xs bg-teal-700/80 hover:bg-teal-600 text-white transition-colors text-center"
                          >
                            Manage Initiative
                          </a>
                          <a
                            href={`/helping/${page.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg text-xs bg-gray-700/80 hover:bg-gray-600 text-white transition-colors text-center"
                          >
                            View Public ↗
                          </a>
                        </>
                      ) : (
                        <>
                          <a
                            href="/business"
                            className="px-3 py-1 rounded-lg text-xs bg-blue-600/80 hover:bg-blue-600 text-white transition-colors text-center"
                          >
                            Evaluate & Plan
                          </a>
                          <button
                            onClick={() => openStore(page.id)}
                            disabled={openingStore === page.id}
                            className="px-3 py-1 rounded-lg text-xs bg-emerald-600/70 hover:bg-emerald-600 text-white transition-colors text-center disabled:opacity-50"
                          >
                            {openingStore === page.id ? "Opening…" : "Your Store"}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deletePage(page.id)}
                        disabled={deleting === page.id}
                        className="px-3 py-1 rounded-lg text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        {deleting === page.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-2">No initiatives yet. Create one below.</p>
          )}

          {/* Create New Initiative */}
          <div className="pt-2 border-t border-gray-800 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add an Initiative</p>

            {/* Type selector — single select */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedType("health")}
                disabled={adding}
                className={`p-3 rounded-xl border text-left transition-all disabled:opacity-50 ${
                  selectedType === "health"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-gray-700 bg-gray-900 hover:border-gray-500"
                }`}
              >
                <p className={`text-sm font-medium ${selectedType === "health" ? "text-emerald-300" : "text-white"}`}>
                  Health &amp; Wellness
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Coaching, nutrition, fitness, mental health</p>
              </button>
              {([
                { value: "store" as const, label: "Store", sub: "Sell products" },
                { value: "learning" as const, label: "Learning", sub: "Teach a skill or subject" },
                { value: "service" as const, label: "Service", sub: "Consulting or sessions" },
                { value: "helping" as const, label: "Helping Initiative", sub: "Community cause, volunteering, civic engagement" },
              ]).map(({ value, label, sub }) => (
                <button
                  key={value}
                  type="button"
                  disabled={adding}
                  onClick={() => setSelectedType(value)}
                  className={`p-3 rounded-xl border text-left transition-all disabled:opacity-50 ${
                    selectedType === value
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-gray-700 bg-gray-900 hover:border-gray-500"
                  }`}
                >
                  <p className={`text-sm font-medium ${selectedType === value ? "text-violet-300" : "text-white"}`}>{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                </button>
              ))}
            </div>

            {selectedType === "learning" && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Course Type</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "skill", label: "Skill / Sport" },
                    { value: "academic", label: "Academic" },
                    { value: "art", label: "Art" },
                    { value: "growth", label: "Personal Growth" },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      disabled={adding}
                      onClick={() => setCourseType(value)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all disabled:opacity-50 ${
                        courseType === value
                          ? "border-violet-500 bg-violet-500/20 text-violet-300"
                          : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Initiative name"
              disabled={adding}
              className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500 outline-none"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              disabled={adding}
              className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500 resize-none min-h-[70px] outline-none"
              rows={3}
            />

            {selectedType === "health" && (
              <div className="space-y-4 p-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20">

                {/* Specialty */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Specialty *</p>
                  <div className="flex flex-wrap gap-2">
                    {(["nutrition", "fitness", "sleep", "mental", "holistic"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={adding}
                        onClick={() => setHbSpecialty(s)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-all capitalize disabled:opacity-50 ${
                          hbSpecialty === s
                            ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                            : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Credentials */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Credentials</p>
                  <textarea
                    value={hbCredentials}
                    onChange={(e) => setHbCredentials(e.target.value)}
                    placeholder="e.g. MSc Nutrition, 8 years experience..."
                    disabled={adding}
                    rows={2}
                    className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500 resize-none outline-none"
                  />
                </div>

                {/* Consultation mode */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Consultation Mode</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-emerald-600/50 bg-emerald-900/20 cursor-pointer">
                      <span className="w-4 h-4 rounded-full border-2 border-emerald-500 flex items-center justify-center shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      </span>
                      <div>
                        <p className="text-sm text-white font-medium">Manual</p>
                        <p className="text-xs text-gray-500">I&apos;ll respond personally</p>
                      </div>
                    </label>
                    {[
                      { key: "rules", label: "Rules", sub: "Set automated protocols" },
                      { key: "agent", label: "Agent", sub: "AI trained on my advice" },
                    ].map(({ key, label, sub }) => (
                      <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed">
                        <span className="w-4 h-4 rounded-full border-2 border-gray-600 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-500 font-medium">{label}</p>
                          <p className="text-xs text-gray-600">{sub}</p>
                        </div>
                        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">Coming soon</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Search tags */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Search Tags</p>
                  <input
                    value={hbTagsInput}
                    onChange={(e) => setHbTagsInput(e.target.value)}
                    placeholder="e.g. bengali-diet, weight-loss, cortisol"
                    disabled={adding}
                    className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500 outline-none"
                  />
                  <p className="text-xs text-gray-600 mt-1">Comma separated. Specialty is auto-included.</p>
                </div>

                {/* Subscription tiers */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Subscription Tiers</p>
                  <div className="space-y-2">
                    {hbTiers.map((tier, i) => (
                      <div key={i} className="p-3 rounded-lg border border-gray-700 bg-gray-900 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            value={tier.name}
                            onChange={(e) => {
                              const next = [...hbTiers];
                              next[i] = { ...next[i], name: e.target.value };
                              setHbTiers(next);
                            }}
                            placeholder="Tier name (e.g. Basic)"
                            disabled={adding}
                            className="flex-1 p-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 outline-none"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">₹</span>
                            <input
                              value={tier.price}
                              onChange={(e) => {
                                const next = [...hbTiers];
                                next[i] = { ...next[i], price: e.target.value };
                                setHbTiers(next);
                              }}
                              placeholder="0/mo"
                              disabled={adding}
                              className="w-20 p-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 outline-none"
                            />
                          </div>
                          {hbTiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setHbTiers((prev) => prev.filter((_, idx) => idx !== i))}
                              disabled={adding}
                              className="text-gray-600 hover:text-red-400 transition-colors text-sm"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <input
                          value={tier.description}
                          onChange={(e) => {
                            const next = [...hbTiers];
                            next[i] = { ...next[i], description: e.target.value };
                            setHbTiers(next);
                          }}
                          placeholder="What's included in this tier..."
                          disabled={adding}
                          className="w-full p-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  {hbTiers.length < 3 && (
                    <button
                      type="button"
                      onClick={() => setHbTiers((prev) => [...prev, { name: "", price: "", description: "" }])}
                      disabled={adding}
                      className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                    >
                      + Add tier
                    </button>
                  )}
                </div>
              </div>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setNewTitle(""); setNewDesc(""); setError(null); resetHealthForm(); setSelectedType("store"); setCourseType("skill"); setError(null); }}
                className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 hover:border-gray-500 text-sm text-gray-300 transition-colors disabled:opacity-50"
                disabled={adding}
              >
                Clear
              </button>
              <button
                onClick={addPage}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-medium hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50"
                disabled={adding}
              >
                {adding ? "Creating..." : "Create Initiative"}
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {showTagModal && (
        <SelectTabsModal
          initialSelected={slugTags}
          onClose={(selected) => {
            setSlugTags(selected || []);
            setShowTagModal(false);
          }}
        />
      )}
    </div>
  );
}
