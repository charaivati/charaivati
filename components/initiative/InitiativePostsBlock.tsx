"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, LucideYoutube, Trash2, Upload, Video, X } from "lucide-react";
import { useCloudinaryUpload } from "@/hooks/useCloudinaryUpload";
import SelectTabsModal from "@/components/SelectTabsModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type Post = {
  id: string;
  content: string | null;
  imageUrls: string[];
  videoUrl: string | null;
  youtubeLinks: string[];
  createdAt: string;
  user: { id: string; name: string | null; avatarUrl: string | null };
};

export interface InitiativePostsBlockProps {
  pageId: string;
  isCreator: boolean;
  accentColor?: string;
  theme?: "dark" | "light";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

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

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  isCreator,
  onDelete,
  theme,
}: {
  post: Post;
  isCreator: boolean;
  onDelete: (id: string) => void;
  theme: "dark" | "light";
}) {
  const isDark = theme === "dark";
  const ytId = post.youtubeLinks[0] ? extractYouTubeId(post.youtubeLinks[0]) : null;

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${isDark ? "#1f2937" : "#E8E4DE"}`,
        background: isDark ? "#111827" : "#FFFFFF",
        padding: 16,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: isDark ? "#374151" : "#F0EDE9",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700,
            color: isDark ? "#9ca3af" : "#888",
            overflow: "hidden", flexShrink: 0,
          }}>
            {post.user.avatarUrl ? (
              <img src={post.user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              (post.user.name ?? "?")[0].toUpperCase()
            )}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#e5e7eb" : "#1A1714" }}>
            {post.user.name ?? "Creator"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: isDark ? "#6b7280" : "#888", fontFamily: "monospace" }}>
            {new Date(post.createdAt).toLocaleDateString()}
          </span>
          {isCreator && (
            <button
              onClick={() => onDelete(post.id)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: isDark ? "#6b7280" : "#aaa" }}
              title="Delete post"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: isDark ? "#d1d5db" : "#1A1714", margin: "0 0 10px", whiteSpace: "pre-wrap" }}>
          {post.content}
        </p>
      )}

      {/* Images */}
      {post.imageUrls.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: post.imageUrls.length === 1 ? "1fr" : "repeat(2, 1fr)", gap: 6, marginBottom: 10 }}>
          {post.imageUrls.slice(0, 4).map((url, i) => (
            <img key={i} src={url} alt="" style={{ width: "100%", borderRadius: 8, objectFit: "cover", maxHeight: 260 }} />
          ))}
        </div>
      )}

      {/* Video */}
      {post.videoUrl && (
        <video src={post.videoUrl} controls style={{ width: "100%", borderRadius: 8, maxHeight: 280, background: "#000", marginBottom: 10 }} />
      )}

      {/* YouTube */}
      {ytId && (
        <div style={{ marginBottom: 10 }}>
          <iframe
            width="100%" height="220"
            src={`https://www.youtube.com/embed/${ytId}`}
            frameBorder="0" allowFullScreen
            style={{ borderRadius: 8, display: "block" }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InitiativePostsBlock({
  pageId,
  isCreator,
  accentColor = "#818CF8",
  theme = "dark",
}: InitiativePostsBlockProps) {
  const isDark = theme === "dark";
  const cloudinary = useCloudinaryUpload();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const [composerText, setComposerText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [youtubeLink, setYoutubeLink] = useState("");
  const [visibility, setVisibility] = useState<"public" | "friends">("public");
  const [slugTags, setSlugTags] = useState<string[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [postingInProgress, setPostingInProgress] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [videoMenuOpen, setVideoMenuOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/by-page/${pageId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setPosts(d.posts ?? []); })
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
  }, [pageId]);

  function handleAddImages(files: FileList | null) {
    if (!files) return;
    const toAdd = Array.from(files).slice(0, 20 - images.length);
    const previews = toAdd.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...toAdd]);
    setImagePreviews((prev) => [...prev, ...previews]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function handleRemoveImageAt(i: number) {
    setImages((prev) => { const c = [...prev]; c.splice(i, 1); return c; });
    setImagePreviews((prev) => { const c = [...prev]; URL.revokeObjectURL(c.splice(i, 1)[0]); return c; });
  }

  function handlePickVideo(files: FileList | null) {
    if (!files?.length) return;
    const url = URL.createObjectURL(files[0]);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(files[0]);
    setVideoPreview(url);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function clearComposer() {
    setComposerText("");
    imagePreviews.forEach((p) => URL.revokeObjectURL(p));
    setImages([]); setImagePreviews([]);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null); setVideoPreview(null);
    setYoutubeLink("");
  }

  async function handlePost() {
    const txt = composerText.trim();
    if (!txt && images.length === 0 && !videoFile && !youtubeLink.trim()) {
      alert("Add content or media before posting.");
      return;
    }
    setPostingInProgress(true);
    try {
      const youtubeId = youtubeLink.trim() ? extractYouTubeId(youtubeLink.trim()) : null;
      const finalSlugTags = augmentWithParentSlugs(slugTags);
      const youtubeLinks = youtubeId ? [youtubeLink.trim()] : [];
      const { imageUrls, videoUrl } = await cloudinary.uploadFiles(images, videoFile);
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: txt || null, imageUrls, videoUrl, youtubeLinks, slugTags: finalSlugTags, pageId, visibility }),
      });
      const data = await res.json();
      if (data.ok && data.post) {
        setPosts((prev) => [data.post, ...prev]);
        clearComposer();
      } else {
        alert(data.error ?? "Failed to post.");
      }
    } catch (e) {
      alert("Failed to post. Please try again.");
    } finally {
      setPostingInProgress(false);
    }
  }

  async function handleDelete(postId: string) {
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/posts/${postId}`, { method: "DELETE", credentials: "include" });
    if ((await res.json()).ok) setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  // ─── Design tokens (matching Learning typography) ─────────────────────────
  const T = {
    sectionTitle:  { fontSize: 17, fontWeight: 700, fontFamily: "system-ui, -apple-system, sans-serif", color: isDark ? "#e5e7eb" : "#1A1714", marginBottom: 16 },
    label:         { fontSize: 11, fontWeight: 600, fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase" as const, color: isDark ? "#6b7280" : "#888" },
    inputBase:     { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${isDark ? "#1f2937" : "#E8E4DE"}`, background: isDark ? "#030712" : "#FAF8F5", color: isDark ? "#f9fafb" : "#1A1714", fontSize: 14, fontFamily: "system-ui, sans-serif", outline: "none", boxSizing: "border-box" as const },
    card:          { borderRadius: 14, border: `1px solid ${isDark ? "#1f2937" : "#E8E4DE"}`, background: isDark ? "#0f172a" : "#fff", padding: 20 },
    muted:         { color: isDark ? "#6b7280" : "#888", fontSize: 13, fontFamily: "system-ui, sans-serif" },
    btn:           { padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "system-ui, sans-serif", border: "none" },
    btnSecondary:  { padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "system-ui, sans-serif", border: `1px solid ${isDark ? "#1f2937" : "#E8E4DE"}`, background: "transparent", color: isDark ? "#9ca3af" : "#888" },
  };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── Section header ─────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${isDark ? "#1f2937" : "#E8E4DE"}`, paddingTop: 32, marginTop: 8 }}>
        <p style={T.label}>Activity</p>
        <h2 style={{ ...T.sectionTitle, marginTop: 6 }}>Posts</h2>
      </div>

      {/* ── Composer (creator only) ───────────────────────────────── */}
      {isCreator && (
        <div style={{ ...T.card, marginBottom: 24 }}>
          {/* Privacy + Tags row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <p style={{ ...T.label, marginBottom: 6 }}>Privacy</p>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "public" | "friends")}
                style={{ ...T.inputBase, padding: "8px 10px" }}
              >
                <option value="public">🌍 Public</option>
                <option value="friends">👥 Friends Only</option>
              </select>
            </div>
            <div>
              <p style={{ ...T.label, marginBottom: 6 }}>Tag Sections</p>
              <button
                type="button"
                onClick={() => setShowTagModal(true)}
                style={{ ...T.inputBase, padding: "8px 10px", cursor: "pointer", textAlign: "left" as const }}
              >
                {slugTags.length === 0 ? "Select tabs to tag" : `${slugTags.length} tag(s) selected`}
              </button>
            </div>
          </div>

          {/* Textarea */}
          <textarea
            placeholder="Share an update, insight, or announcement…"
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            disabled={postingInProgress}
            rows={3}
            style={{ ...T.inputBase, resize: "vertical" as const, minHeight: 80, marginBottom: 12 }}
          />

          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 12 }}>
              {imagePreviews.map((src, i) => (
                <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden" }}>
                  <img src={src} alt="" style={{ width: "100%", height: 80, objectFit: "cover" }} />
                  <button onClick={() => handleRemoveImageAt(i)} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={10} color="#fff" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Video preview */}
          {videoPreview && (
            <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
              <video src={videoPreview} controls style={{ width: "100%", maxHeight: 220, background: "#000" }} />
              <button onClick={() => { URL.revokeObjectURL(videoPreview); setVideoFile(null); setVideoPreview(null); }} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={11} color="#fff" />
              </button>
            </div>
          )}

          {/* YouTube */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <LucideYoutube size={16} color="#ef4444" />
            <input
              type="text"
              placeholder="Paste YouTube URL (optional)"
              value={youtubeLink}
              onChange={(e) => setYoutubeLink(e.target.value)}
              disabled={postingInProgress}
              style={{ ...T.inputBase, flex: 1, padding: "8px 12px" }}
            />
            {youtubeLink && (extractYouTubeId(youtubeLink) ? <span style={{ color: "#22c55e", fontSize: 12 }}>✓</span> : <span style={{ color: "#ef4444", fontSize: 12 }}>✗</span>)}
          </div>

          {/* Hidden inputs */}
          <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAddImages(e.target.files)} />
          <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handlePickVideo(e.target.files)} />

          {/* Action bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${isDark ? "#1f2937" : "#E8E4DE"}`, paddingTop: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Photo button */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => { setPhotoMenuOpen((v) => !v); setVideoMenuOpen(false); }}
                  disabled={postingInProgress}
                  style={{ ...T.btnSecondary, display: "flex", alignItems: "center", gap: 6, padding: "7px 12px" }}
                >
                  <Camera size={14} color="#60a5fa" />
                  <span style={{ fontSize: 12 }}>Photo</span>
                </button>
                {photoMenuOpen && (
                  <div style={{ position: "absolute", bottom: "100%", marginBottom: 4, left: 0, zIndex: 20, background: isDark ? "#1f2937" : "#fff", border: `1px solid ${isDark ? "#374151" : "#E8E4DE"}`, borderRadius: 8, overflow: "hidden", minWidth: 120, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                    {[["Gallery", false], ["Camera", true]].map(([label, capture]) => (
                      <button key={String(label)} type="button" onClick={() => { setPhotoMenuOpen(false); if (capture) imageInputRef.current?.setAttribute("capture","environment"); else imageInputRef.current?.removeAttribute("capture"); imageInputRef.current?.click(); }} style={{ width: "100%", padding: "9px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: isDark ? "#d1d5db" : "#1A1714", fontFamily: "system-ui, sans-serif" }}>
                        {label as string}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Video button */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => { setVideoMenuOpen((v) => !v); setPhotoMenuOpen(false); }}
                  disabled={postingInProgress}
                  style={{ ...T.btnSecondary, display: "flex", alignItems: "center", gap: 6, padding: "7px 12px" }}
                >
                  <Video size={14} color="#c084fc" />
                  <span style={{ fontSize: 12 }}>Video</span>
                </button>
                {videoMenuOpen && (
                  <div style={{ position: "absolute", bottom: "100%", marginBottom: 4, left: 0, zIndex: 20, background: isDark ? "#1f2937" : "#fff", border: `1px solid ${isDark ? "#374151" : "#E8E4DE"}`, borderRadius: 8, overflow: "hidden", minWidth: 120, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
                    {[["Gallery", false], ["Camera", true]].map(([label, capture]) => (
                      <button key={String(label)} type="button" onClick={() => { setVideoMenuOpen(false); if (capture) videoInputRef.current?.setAttribute("capture","environment"); else videoInputRef.current?.removeAttribute("capture"); videoInputRef.current?.click(); }} style={{ width: "100%", padding: "9px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: isDark ? "#d1d5db" : "#1A1714", fontFamily: "system-ui, sans-serif" }}>
                        {label as string}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={clearComposer} disabled={postingInProgress} style={T.btnSecondary}>Clear</button>
              <button
                onClick={handlePost}
                disabled={postingInProgress || cloudinary.uploading}
                style={{ ...T.btn, background: accentColor, color: "#fff", opacity: (postingInProgress || cloudinary.uploading) ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}
              >
                {postingInProgress || cloudinary.uploading ? <><Upload size={14} /> Posting…</> : "Publish Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Posts feed ────────────────────────────────────────────── */}
      {loadingPosts ? (
        <p style={{ ...T.muted, textAlign: "center", padding: "24px 0" }}>Loading posts…</p>
      ) : posts.length === 0 ? (
        <div style={{ ...T.card, textAlign: "center", padding: "40px 24px" }}>
          <p style={T.muted}>No posts yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} isCreator={isCreator} onDelete={handleDelete} theme={isDark ? "dark" : "light"} />
          ))}
        </div>
      )}

      {showTagModal && (
        <SelectTabsModal
          initialSelected={slugTags}
          onClose={(selected) => { setSlugTags(selected ?? []); setShowTagModal(false); }}
        />
      )}
    </div>
  );
}
