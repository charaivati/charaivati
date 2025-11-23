// app/sahayak/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TabData {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  category?: string | null;
  is_default?: boolean;
  translations?: Array<{ locale: string; title: string }>;
}

interface PostVideo {
  id: string;
  content?: string | null;
  youtubeLinks?: string[];
  videoFileId?: string | null;
  slugTags?: string[];
  user?: { id?: string; name?: string; avatarUrl?: string };
  createdAt?: string;
}

export default function SahayakPage() {
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [sections, setSections] = useState<TabData[]>([]);
  const [videosBySection, setVideosBySection] = useState<Record<string, PostVideo[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/tabs");
        const j = await res.json();
        if (!alive) return;
        if (j?.ok && Array.isArray(j.tabs)) {
          setTabs(j.tabs);
          // choose sections: prefer is_default tabs
          const defaults = j.tabs.filter((t: any) => t.is_default);
          if (defaults.length > 0) {
            setSections(defaults);
          } else {
            // fallback canonical list
            const slugs = ["epfo", "irctc", "ids", "health", "senior"];
            const found = slugs.map((s) => j.tabs.find((t: any) => t.slug === s)).filter(Boolean);
            setSections(found);
          }
        } else {
          setTabs([]);
          setSections([]);
        }
      } catch (e) {
        console.error("Failed to fetch tabs", e);
        setTabs([]);
        setSections([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!sections.length || !tabs.length) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const fetches = sections.map(async (sec) => {
          // collect related slugs:
          // 1) all tabs with same category as sec.category (if category present)
          // 2) all tabs whose slug startsWith `${sec.slug}-` (heuristic)
          // 3) ensure sec.slug itself is included
          const related = new Set<string>();
          related.add(sec.slug);
          if (sec.category) {
            tabs.forEach((t) => {
              if (t.category === sec.category) related.add(t.slug);
            });
          }
          // prefix heuristic
          tabs.forEach((t) => {
            if (t.slug.startsWith(`${sec.slug}-`)) related.add(t.slug);
          });

          const slugsArr = Array.from(related);
          if (slugsArr.length === 0) return { slug: sec.slug, posts: [] as PostVideo[] };

          const q = `/api/posts?tabSlugs=${encodeURIComponent(slugsArr.join(","))}&media=video&limit=50`;
          const r = await fetch(q);
          const json = await r.json();
          const posts = json?.ok ? (json.data as PostVideo[]) : json.posts || [];
          return { slug: sec.slug, posts };
        });

        const results = await Promise.all(fetches);
        if (!alive) return;

        const mapping: Record<string, PostVideo[]> = {};
        results.forEach((res) => {
          // dedupe posts by id
          const seen = new Set<string>();
          const dedup: PostVideo[] = [];
          (res.posts || []).forEach((p: any) => {
            if (!p || !p.id) return;
            if (!seen.has(p.id)) {
              seen.add(p.id);
              dedup.push(p);
            }
          });
          mapping[res.slug] = dedup;
        });

        setVideosBySection(mapping);
      } catch (e) {
        console.error("Error fetching section videos", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [sections, tabs]);

  const toggleExpanded = (k: string) => setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));

  function renderVideoCard(p: PostVideo) {
    const youtube = Array.isArray(p.youtubeLinks) && p.youtubeLinks[0] ? p.youtubeLinks[0] : null;
    const youtubeId = youtube ? (function (u: string) {
      const m = u.match(/(?:v=|\/)([A-Za-z0-9_-]{11})/);
      return m ? m[1] : null;
    })(youtube) : null;

    return (
      <div key={p.id} className="min-w-[320px] bg-white rounded shadow p-2 text-black">
        <div className="aspect-video w-[320px] mb-2 overflow-hidden rounded">
          {youtubeId ? (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title={String(p.content || p.id)}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          ) : p.videoFileId ? (
            <video controls className="w-full h-full bg-black">
              <source src={`/api/drive-video/${p.videoFileId}`} />
            </video>
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">No playable media</div>
          )}
        </div>
        <div className="text-sm font-medium">{(p.content || "").slice(0, 120)}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-white px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Digital Sahayak</h1>
        </div>

        {sections.map((sec) => {
          const videos = videosBySection[sec.slug] || [];
          const isOpen = expanded[sec.slug] ?? true;
          return (
            <div key={sec.slug} className="bg-gray-900 rounded-xl overflow-hidden mb-6">
              <div
                className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-gray-700 to-gray-600 cursor-pointer select-none hover:opacity-90 transition"
                onClick={() => toggleExpanded(sec.slug)}
              >
                <h2 className="font-bold text-lg">🎥 {sec.title}</h2>
                {isOpen ? <ChevronUp /> : <ChevronDown />}
              </div>

              {isOpen && (
                <div className="p-5 bg-white text-black">
                  {loading ? (
                    <div className="text-gray-500">Loading videos…</div>
                  ) : videos.length === 0 ? (
                    <div className="text-gray-500">No videos for {sec.title}</div>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {videos.map((p) => renderVideoCard(p))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
