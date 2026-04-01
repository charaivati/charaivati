"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useProfile } from "@/lib/ProfileContext";
import type { SkillEntry } from "@/types/self";

// ─── Types ────────────────────────────────────────────────────────────────────

type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Mastered";

const COLUMNS: SkillLevel[] = ["Beginner", "Intermediate", "Advanced", "Mastered"];

type FeedPost = {
  id: string;
  author: string;
  timeISO: string;
  content?: string;
  imageUrls: string[];
  videoUrl: string | null;
  likes: number;
  youtubeLinks: string[];
  slugTags: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Normalize a skill name to a slug-like string for tag matching
function toSlugKey(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-");
}

// ─── Level style tokens ───────────────────────────────────────────────────────

const LEVEL_COLOR: Record<SkillLevel, string> = {
  Beginner:     "text-emerald-400",
  Intermediate: "text-blue-400",
  Advanced:     "text-purple-400",
  Mastered:     "text-amber-400",
};

const LEVEL_BORDER: Record<SkillLevel, string> = {
  Beginner:     "border-emerald-500/30",
  Intermediate: "border-blue-500/30",
  Advanced:     "border-purple-500/30",
  Mastered:     "border-amber-500/30",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LearningTab() {
  const { profile } = useProfile();

  // ── Derive skills grouped by level ────────────────────────────────────────
  const skillsByLevel = useMemo<Record<SkillLevel, SkillEntry[]>>(() => {
    const groups: Record<SkillLevel, SkillEntry[]> = {
      Beginner: [], Intermediate: [], Advanced: [], Mastered: [],
    };
    const seen = new Set<string>();

    function addBatch(skills: SkillEntry[]) {
      for (const s of skills) {
        const key = (s.name || "").toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const lvl = (COLUMNS as string[]).includes(s.level) ? (s.level as SkillLevel) : "Beginner";
        groups[lvl].push(s);
      }
    }

    if (Array.isArray(profile?.generalSkills)) addBatch(profile.generalSkills);
    if (Array.isArray(profile?.goals)) {
      for (const g of profile.goals) {
        if (Array.isArray(g.skills)) addBatch(g.skills);
      }
    }

    return groups;
  }, [profile]);

  const totalSkills = COLUMNS.reduce((acc, l) => acc + skillsByLevel[l].length, 0);

  // ── Per-column expand ──────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<Record<SkillLevel, boolean>>({
    Beginner: false, Intermediate: false, Advanced: false, Mastered: false,
  });

  function toggleColumn(lvl: SkillLevel) {
    setExpanded(prev => ({ ...prev, [lvl]: !prev[lvl] }));
  }

  // ── Skill selection ────────────────────────────────────────────────────────
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());

  function toggleSkill(name: string) {
    setSelectedSkills(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // ── Scroll-aware panel ─────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (y > lastScrollY.current + 40) setPanelOpen(false);
      else if (y < lastScrollY.current - 15) setPanelOpen(true);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Feed ───────────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/posts?limit=30");
      const json = await res.json();
      if (!json.ok) return;
      const mapped: FeedPost[] = json.data.map((p: any) => ({
        id: p.id,
        author:
          p.user?.profile?.displayName ||
          p.user?.name ||
          p.user?.email ||
          "User",
        timeISO: p.createdAt,
        content: p.content ?? undefined,
        imageUrls:
          p.imageUrls?.length > 0
            ? p.imageUrls
            : (p.imageFileIds || []).map(
                (id: string) =>
                  `https://drive.google.com/thumbnail?id=${id}&sz=w1200`
              ),
        videoUrl:
          p.videoUrl ??
          (p.videoFileId ? `https://drive.google.com/uc?id=${p.videoFileId}` : null),
        likes: p.likes ?? 0,
        youtubeLinks: p.youtubeLinks ?? [],
        slugTags: p.slugTags ?? [],
      }));
      setPosts(mapped);
    } catch (err) {
      console.error("LearnTab feed error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // ── Skill filtering ────────────────────────────────────────────────────────
  const skillFiltered = useMemo(() => {
    if (selectedSkills.size === 0) return posts;
    const slugKeys = Array.from(selectedSkills).map(toSlugKey);
    return posts.filter(p =>
      p.slugTags.some(tag => {
        const t = tag.toLowerCase();
        return slugKeys.some(s => t.includes(s) || s.includes(t));
      })
    );
  }, [posts, selectedSkills]);

  // ── Teacher list (order of first appearance = priority) ───────────────────
  const teachers = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const p of skillFiltered) {
      if (!seen.has(p.author)) { seen.add(p.author); list.push(p.author); }
    }
    return list;
  }, [skillFiltered]);

  const [selectedTeacher, setSelectedTeacher] = useState("All");

  useEffect(() => { setSelectedTeacher("All"); }, [selectedSkills]);

  // ── Final posts ────────────────────────────────────────────────────────────
  const finalPosts = useMemo(() => {
    if (selectedTeacher === "All") return skillFiltered;
    return skillFiltered.filter(p => p.author === selectedTeacher);
  }, [skillFiltered, selectedTeacher]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full bg-gradient-to-br from-gray-900 via-black to-gray-900 min-h-screen">

      {/* ── Sticky skill panel ── */}
      <div className="sticky top-0 z-40">
        <div
          className={`overflow-hidden transition-all duration-300 ${
            panelOpen ? "max-h-[480px]" : "max-h-0"
          }`}
        >
          <div className="backdrop-blur-xl bg-black/60 border-b border-white/10">
            <div className="max-w-2xl mx-auto px-4 pt-3 pb-4">

              {/* Panel header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Skills
                </span>
                {selectedSkills.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSkills(new Set())}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Clear {selectedSkills.size} selected
                  </button>
                )}
              </div>

              {totalSkills === 0 ? (
                <p className="text-xs text-gray-600 py-1">
                  Add skills in the Personal tab — they&apos;ll appear here for filtering.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {COLUMNS.map(level => {
                    const skills = skillsByLevel[level];
                    const isOpen = expanded[level];
                    const visible = isOpen ? skills : skills.slice(0, 2);
                    const hiddenCount = skills.length - 2;

                    return (
                      <div
                        key={level}
                        className={`rounded-xl border ${LEVEL_BORDER[level]} bg-white/[0.03] p-2`}
                      >
                        {/* Column header */}
                        <button
                          type="button"
                          onClick={() => toggleColumn(level)}
                          className="w-full flex items-center justify-between mb-1.5 group"
                        >
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${LEVEL_COLOR[level]}`}>
                            {level}
                          </span>
                          {skills.length > 2 && (
                            isOpen
                              ? <ChevronUp className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                              : <ChevronDown className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                          )}
                        </button>

                        {/* Skill chips */}
                        <div className="space-y-1">
                          {visible.length === 0 && (
                            <p className="text-[10px] text-gray-700 px-1">—</p>
                          )}
                          {visible.map(skill => {
                            const active = selectedSkills.has(skill.name);
                            return (
                              <button
                                key={skill.id}
                                type="button"
                                onClick={() => toggleSkill(skill.name)}
                                className={`w-full text-left text-[11px] px-2 py-1 rounded-lg border transition-colors leading-tight ${
                                  active
                                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                                    : "border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                                }`}
                              >
                                {skill.name}
                              </button>
                            );
                          })}
                          {!isOpen && hiddenCount > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleColumn(level)}
                              className="w-full text-[10px] text-gray-600 hover:text-gray-400 transition-colors text-center pt-0.5"
                            >
                              +{hiddenCount} more
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Collapsed indicator bar */}
        {!panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="w-full backdrop-blur-xl bg-black/60 border-b border-white/10 py-1.5 flex items-center justify-center gap-2"
          >
            <ChevronDown className="w-3 h-3 text-gray-600" />
            <span className="text-[10px] text-gray-600 tracking-widest uppercase">Skills</span>
            {selectedSkills.size > 0 && (
              <span className="text-[10px] text-indigo-500">
                ({selectedSkills.size} selected)
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Page header ── */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-light text-white tracking-wide">Learn</h1>
        <button
          onClick={loadFeed}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* ── Teacher filter ── */}
      {teachers.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {["All", ...teachers].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTeacher(t)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedTeacher === t
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Feed ── */}
      <div className="max-w-2xl mx-auto px-4 pb-32">
        <div className="space-y-6">

          {loading && finalPosts.length === 0 && (
            <div className="text-center py-20">
              <BookOpen className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Loading…</p>
            </div>
          )}

          {!loading && finalPosts.length === 0 && (
            <div className="text-center py-20">
              <BookOpen className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No content found</p>
              <p className="text-gray-600 text-sm mt-2">
                {selectedSkills.size > 0
                  ? "Try selecting different skills or clear the filter"
                  : "Videos from teachers will appear here"}
              </p>
            </div>
          )}

          {finalPosts.map(post => {
            const avatarLetter = (post.author || "U")[0].toUpperCase();
            return (
              <article
                key={post.id}
                className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden backdrop-blur-sm hover:bg-white/[0.08] transition-colors"
              >
                {/* Author row */}
                <div className="p-6 pb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium shrink-0">
                      {avatarLetter}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{post.author}</p>
                      <p className="text-sm text-gray-500">{formatTime(post.timeISO)}</p>
                    </div>
                  </div>
                  {post.content && (
                    <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {post.content}
                    </p>
                  )}
                </div>

                {/* Images */}
                {post.imageUrls.length > 0 && (
                  <div
                    className={
                      post.imageUrls.length === 1
                        ? ""
                        : "grid grid-cols-2 gap-0.5"
                    }
                  >
                    {post.imageUrls.map((url, i) => {
                      const isFirst = i === 0 && post.imageUrls.length >= 3;
                      return (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          loading="lazy"
                          className={`w-full object-cover ${
                            post.imageUrls.length === 1
                              ? "max-h-[480px]"
                              : isFirst
                              ? "col-span-2 max-h-64"
                              : "h-40"
                          }`}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Video */}
                {post.videoUrl && (
                  <video
                    src={post.videoUrl}
                    controls
                    className="w-full bg-black max-h-[480px]"
                  />
                )}

                {/* YouTube embeds */}
                {post.youtubeLinks.map((link, i) => {
                  const id = extractYouTubeId(link);
                  if (!id) return null;
                  return (
                    <div key={i} className="aspect-video">
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${id}`}
                        allowFullScreen
                        className="border-0"
                      />
                    </div>
                  );
                })}

                {/* Tags */}
                {post.slugTags.length > 0 && (
                  <div className="px-6 py-2.5 border-t border-white/5 flex flex-wrap gap-1.5">
                    {post.slugTags.map(tag => {
                      const isMatched =
                        selectedSkills.size > 0 &&
                        Array.from(selectedSkills).some(s => {
                          const sk = toSlugKey(s);
                          const t = tag.toLowerCase();
                          return t.includes(sk) || sk.includes(t);
                        });
                      return (
                        <span
                          key={tag}
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            isMatched
                              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                              : "bg-white/5 border-white/10 text-gray-600"
                          }`}
                        >
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Likes */}
                <div className="px-6 py-3 border-t border-white/5">
                  <span className="text-sm text-gray-500">
                    {post.likes > 0
                      ? `${post.likes} like${post.likes !== 1 ? "s" : ""}`
                      : "Be the first to like"}
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
