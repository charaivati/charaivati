"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Trash2 } from "lucide-react";
import { useSelfSkills } from "@/lib/SelfSkillsContext";
import { CollapsibleSection } from "@/components/self/shared";
import type { SkillEntry } from "@/types/self";

// ─── Types ────────────────────────────────────────────────────────────────────

type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Mastered";
type SkillWithSource = SkillEntry & { source: string };

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


// ─── Component ────────────────────────────────────────────────────────────────

export default function LearningTab() {
  const { goals, generalSkills } = useSelfSkills();

  // ── Local editable skill state ────────────────────────────────────────────
  const [localSkills, setLocalSkills] = useState<SkillWithSource[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localSkillsRef = useRef<SkillWithSource[]>([]);

  useEffect(() => {
    const result: SkillWithSource[] = [];
    const seen = new Set<string>();

    function addBatch(skills: SkillEntry[], source: string) {
      for (const s of skills) {
        const key = (s.name || "").toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push({ ...s, source });
      }
    }

    addBatch(generalSkills, "general");
    for (const g of goals) {
      if (Array.isArray(g.skills)) addBatch(g.skills, g.id);
    }

    setLocalSkills(result);
    localSkillsRef.current = result;
  }, [goals, generalSkills]);

  // ── Group by level ────────────────────────────────────────────────────────
  const skillsByLevel = useMemo<Record<SkillLevel, SkillWithSource[]>>(() => {
    const groups: Record<SkillLevel, SkillWithSource[]> = {
      Beginner: [], Intermediate: [], Advanced: [], Mastered: [],
    };
    for (const s of localSkills) {
      const lvl = (COLUMNS as string[]).includes(s.level) ? (s.level as SkillLevel) : "Beginner";
      groups[lvl].push(s);
    }
    return groups;
  }, [localSkills]);

  const totalSkills = localSkills.length;

  // ── Per-column expand ──────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<Record<SkillLevel, boolean>>({
    Beginner: false, Intermediate: false, Advanced: false, Mastered: false,
  });
  function toggleColumn(lvl: SkillLevel) {
    setExpanded(prev => ({ ...prev, [lvl]: !prev[lvl] }));
  }

  // ── Skill selection (for feed filter) ────────────────────────────────────
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  function toggleSkill(name: string) {
    setSelectedSkills(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // ── Upgrade / Downgrade selected skills ──────────────────────────────────
  function shiftSelected(direction: 1 | -1) {
    setLocalSkills(prev => {
      const next = prev.map(s => {
        if (!selectedSkills.has(s.name)) return s;
        const idx = COLUMNS.indexOf(s.level as SkillLevel);
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= COLUMNS.length) return s;
        return { ...s, level: COLUMNS[newIdx] };
      });
      localSkillsRef.current = next;
      return next;
    });
    scheduleSave();
  }

  function deleteSelected() {
    setLocalSkills(prev => {
      const next = prev.filter(s => !selectedSkills.has(s.name));
      localSkillsRef.current = next;
      return next;
    });
    setSelectedSkills(new Set());
    scheduleSave();
  }

  function scheduleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doSave, 1500);
  }

  async function doSave() {
    const skills = localSkillsRef.current;
    const updatedGeneralSkills = skills
      .filter(s => s.source === "general")
      .map(({ source, ...s }) => s);

    const updatedGoals = goals.map(g => ({
      ...g,
      skills: (g.skills || []).map(s => {
        const updated = skills.find(ls => ls.id === s.id);
        return updated ? { ...s, level: updated.level } : s;
      }),
    }));

    try {
      await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generalSkills: updatedGeneralSkills, goals: updatedGoals }),
      });
    } catch (err) {
      console.error("Failed to save skill levels:", err);
    }
  }

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
        author: p.user?.profile?.displayName || p.user?.name || p.user?.email || "User",
        timeISO: p.createdAt,
        content: p.content ?? undefined,
        imageUrls: p.imageUrls?.length > 0
          ? p.imageUrls
          : (p.imageFileIds || []).map((id: string) => `https://drive.google.com/thumbnail?id=${id}&sz=w1200`),
        videoUrl: p.videoUrl ?? (p.videoFileId ? `https://drive.google.com/uc?id=${p.videoFileId}` : null),
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

  const finalPosts = useMemo(() => {
    if (selectedTeacher === "All") return skillFiltered;
    return skillFiltered.filter(p => p.author === selectedTeacher);
  }, [skillFiltered, selectedTeacher]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const skillControls = selectedSkills.size > 0 ? (
    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
      {/* Downgrade */}
      <button
        type="button"
        onClick={() => shiftSelected(-1)}
        title="Downgrade"
        className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 active:bg-gray-600 transition-colors
          px-3 py-2 sm:px-2.5 sm:py-1"
      >
        <ChevronsDown className="w-4 h-4 sm:w-3 sm:h-3 shrink-0" />
        <span className="hidden sm:inline text-xs">Downgrade</span>
      </button>

      {/* Upgrade */}
      <button
        type="button"
        onClick={() => shiftSelected(1)}
        title="Upgrade"
        className="flex items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-900/50 text-indigo-300 hover:bg-indigo-800/50 active:bg-indigo-700/50 transition-colors
          px-3 py-2 sm:px-2.5 sm:py-1"
      >
        <ChevronsUp className="w-4 h-4 sm:w-3 sm:h-3 shrink-0" />
        <span className="hidden sm:inline text-xs">Upgrade</span>
      </button>

      {/* Delete selected */}
      <button
        type="button"
        onClick={deleteSelected}
        title="Delete selected skills"
        className="flex items-center justify-center rounded-lg border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-500/40 active:bg-red-500/10 transition-colors
          p-2 sm:p-1"
      >
        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
      </button>
    </div>
  ) : null;

  const refreshButton = (
    <button
      onClick={(e) => { e.stopPropagation(); loadFeed(); }}
      disabled={loading}
      className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
    >
      {loading ? "Loading…" : "Refresh"}
    </button>
  );

  return (
    <div className="text-white space-y-5">

      {/* ── Skill Levels ── */}
      <CollapsibleSection
        title="Skill Levels"
        subtitle="Select skills, then upgrade or downgrade their level"
        defaultOpen={true}
        headerExtra={skillControls}
      >
        {totalSkills === 0 ? (
          <p className="text-xs text-gray-500 py-1">
            Add skills in the Personal tab — they&apos;ll appear here for filtering.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {COLUMNS.map(level => {
              const skills = skillsByLevel[level];
              const isOpen = expanded[level];
              const visible = isOpen ? skills : skills.slice(0, 3);
              const hiddenCount = skills.length - 3;

              return (
                <div
                  key={level}
                  className="rounded-xl border border-gray-800 bg-gray-900/50 p-2 min-h-[60px]"
                >
                  {/* Column header */}
                  <button
                    type="button"
                    onClick={() => toggleColumn(level)}
                    className="w-full flex items-center justify-between mb-2 group"
                  >
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${LEVEL_COLOR[level]}`}>
                      {level}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-600">{skills.length}</span>
                      {skills.length > 3 && (
                        isOpen
                          ? <ChevronUp className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                          : <ChevronDown className="w-3 h-3 text-gray-600 group-hover:text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Skill chips */}
                  <div className="space-y-1">
                    {visible.length === 0 && (
                      <p className="text-[10px] text-gray-700 px-1 text-center py-2">—</p>
                    )}
                    {visible.map(skill => {
                      const active = selectedSkills.has(skill.name);
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => toggleSkill(skill.name)}
                          className={`w-full text-left text-[11px] px-2 py-1 rounded-lg border transition-colors leading-tight truncate ${
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
      </CollapsibleSection>

      {/* ── Feed ── */}
      <CollapsibleSection title="Learn Feed" headerExtra={refreshButton}>

        {/* Teacher filter */}
        {teachers.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-4">
            {["All", ...teachers].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTeacher(t)}
                className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${
                  selectedTeacher === t
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                    : "border-gray-800 bg-gray-900/50 text-gray-400 hover:border-gray-600 hover:text-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-5">
          {loading && finalPosts.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-3">
              <BookOpen className="w-10 h-10 text-gray-700" />
              <p className="text-gray-500">Loading…</p>
            </div>
          )}

          {!loading && finalPosts.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-3">
              <BookOpen className="w-10 h-10 text-gray-700" />
              <p className="text-gray-500">No content found</p>
              <p className="text-gray-600 text-sm">
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
                className="rounded-2xl border border-gray-800 bg-gray-900/70 overflow-hidden"
              >
                <div className="p-5 pb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium shrink-0">
                      {avatarLetter}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{post.author}</p>
                      <p className="text-xs text-gray-500">{formatTime(post.timeISO)}</p>
                    </div>
                  </div>
                  {post.content && (
                    <p className="text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
                      {post.content}
                    </p>
                  )}
                </div>

                {post.imageUrls.length > 0 && (
                  <div className={post.imageUrls.length === 1 ? "" : "grid grid-cols-2 gap-0.5"}>
                    {post.imageUrls.map((url, i) => {
                      const isFirst = i === 0 && post.imageUrls.length >= 3;
                      return (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          loading="lazy"
                          className={`w-full object-cover ${
                            post.imageUrls.length === 1 ? "max-h-[480px]" : isFirst ? "col-span-2 max-h-64" : "h-40"
                          }`}
                        />
                      );
                    })}
                  </div>
                )}

                {post.videoUrl && (
                  <video src={post.videoUrl} controls className="w-full bg-black max-h-[480px]" />
                )}

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

                {post.slugTags.length > 0 && (
                  <div className="px-5 py-2.5 border-t border-gray-800 flex flex-wrap gap-1.5">
                    {post.slugTags.map(tag => {
                      const isMatched = selectedSkills.size > 0 &&
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
                              : "bg-gray-800 border-gray-700 text-gray-500"
                          }`}
                        >
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="px-5 py-3 border-t border-gray-800">
                  <span className="text-xs text-gray-500">
                    {post.likes > 0
                      ? `${post.likes} like${post.likes !== 1 ? "s" : ""}`
                      : "Be the first to like"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );
}
