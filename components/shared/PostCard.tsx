"use client";

import { Trash2 } from "lucide-react";

export function extractYouTubeId(url: string): string | null {
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

export type PostCardPost = {
  id: string;
  content: string | null;
  imageUrls: string[];
  videoUrl: string | null;
  youtubeLinks: string[];
  createdAt: string;
  user: { id: string; name: string | null; avatarUrl: string | null };
  page?: { title: string } | null;
};

export function PostCard({
  post,
  isCreator = false,
  onDelete,
  theme = "light",
}: {
  post: PostCardPost;
  isCreator?: boolean;
  onDelete?: (id: string) => void;
  theme?: "dark" | "light";
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
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#e5e7eb" : "#1A1714" }}>
              {post.user.name ?? "Creator"}
            </div>
            {post.page && (
              <div style={{ fontSize: 11, color: isDark ? "#6b7280" : "#888" }}>
                {post.page.title}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: isDark ? "#6b7280" : "#888", fontFamily: "monospace" }}>
            {new Date(post.createdAt).toLocaleDateString()}
          </span>
          {isCreator && onDelete && (
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
