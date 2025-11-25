// app/sahayak/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type TabPayloadItem = {
  tabId: string;
  slug: string;
  enTitle: string;
  enDescription?: string | null;
  translation?: { title?: string | null; description?: string | null } | null;
  // note: other fields from your tab-translations endpoint may exist; we only use these
};

type PostVideo = {
  id: string;
  content?: string | null;
  youtubeLinks?: string[];
  videoFileId?: string | null;
  slugTags?: string[];
  user?: { id?: string; name?: string; avatarUrl?: string };
  createdAt?: string;
};

function getYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v && v.length === 11) return v;
    if (u.hostname.includes("youtu.be")) {
      const p = u.pathname.split("/").filter(Boolean);
      if (p[0] && p[0].length === 11) return p[0];
    }
    const embed = u.pathname.match(/\/embed\/([A-Za-z0-9_-]{11})/);
    if (embed) return embed[1];
  } catch (e) {
    // proceed to regex fallback
  }
  const reg = /(?:youtube\.com\/.*v=|youtu\.be\/|youtube\.com\/embed\/|v=|\/)([A-Za-z0-9_-]{11})/;
  const m = url.match(reg);
  return m ? m[1] : null;
}

export default function SahayakPage() {
  const [tabs, setTabs] = useState<TabPayloadItem[]>([]);
  const [sections, setSections] = useState<TabPayloadItem[]>([]);
  const [videosBySection, setVideosBySection] = useState<Record<string, PostVideo[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [cardOpen, setCardOpen] = useState<Record<string, boolean>>({});

  // load tabs via your tab-translations endpoint (includes translations)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/tab-translations?locale=en");
        const j = await res.json();
        if (!alive) return;
        if (j?.ok && Array.isArray(j.data)) {
          const payload = j.data as TabPayloadItem[];
          setTabs(payload);
          const defaults = payload.filter((t) => (t as any).is_default); // optional flag
          if (defaults.length > 0) setSections(defaults);
          else {
            // fallback canonical slugs
            const canonical = ["epfo", "irctc", "ids", "health", "senior"];
            const found = canonical.map((s) => payload.find((p) => p.slug === s)).filter(Boolean) as TabPayloadItem[];
            setSections(found);
          }
        } else {
          console.warn("tab-translations returned unexpected payload", j);
          setTabs([]);
          setSections([]);
        }
      } catch (e) {
        console.error("Failed to fetch tab-translations", e);
        setTabs([]);
        setSections([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  // fetch videos per section using related slugs
  useEffect(() => {
    if (!sections.length || !tabs.length) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const fetches = sections.map(async (sec) => {
          const related = new Set<string>();
          related.add(sec.slug);
          // include all tabs that share the same category (if any)
          const secCat = (sec as any).category;
          if (secCat) {
            tabs.forEach((t) => { if ((t as any).category === secCat) related.add(t.slug); });
          }
          // prefix heuristic: include tabs that start with `${sec.slug}-`
          tabs.forEach((t) => { if (t.slug.startsWith(`${sec.slug}-`)) related.add(t.slug); });

          const slugsArr = Array.from(related);
          if (slugsArr.length === 0) return { slug: sec.slug, posts: [] as PostVideo[] };

          const q = `/api/posts?tabSlugs=${encodeURIComponent(slugsArr.join(","))}&media=video&limit=50`;
          const r = await fetch(q);
          const json = await r.json();
          console.debug(`[Sahayak] fetched for ${sec.slug} slugs=${slugsArr.length} posts=${(json?.data || json?.posts || []).length}`);
          const posts = json?.ok ? (json.data as PostVideo[]) : json.posts || [];
          return { slug: sec.slug, posts };
        });

        const results = await Promise.all(fetches);
        if (!alive) return;

        const mapping: Record<string, PostVideo[]> = {};
        results.forEach((res) => {
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

    return () => { alive = false; };
  }, [sections, tabs]);

  const toggleExpanded = (key: string) => setExpanded((s) => ({ ...s, [key]: !s[key] }));

  function renderVideoCard(p: PostVideo) {
    const youtube = Array.isArray(p.youtubeLinks) && p.youtubeLinks[0] ? p.youtubeLinks[0] : null;
    const youtubeId = getYouTubeId(youtube || undefined);
    const thumbnail = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : "/placeholder-video.png";

    const text = (p.content || "").trim();
    const isLong = text.length > 140;
    const short = isLong ? text.slice(0, 140) : text;

    return (
      <div key={p.id} className="min-w-[320px] bg-white rounded shadow p-3 text-black mr-3">
        <div className="relative rounded overflow-hidden mb-3">
          <img src={thumbnail} alt="thumbnail" className="w-full h-[180px] object-cover" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 bg-black/50 rounded-full flex items-center justify-center">
              <svg viewBox="0 0 24 24" width="28" height="28" className="text-white fill-current"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        </div>

        <div className="mb-2 text-sm text-gray-800">
          {!cardOpen[p.id] ? (
            <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {short}
            </div>
          ) : (
            <div>{text}</div>
          )}

          {isLong && (
            <button onClick={() => setCardOpen((s) => ({ ...s, [p.id]: !s[p.id] }))} className="text-xs text-blue-600 mt-2">
              {cardOpen[p.id] ? "less" : "more"}
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex gap-2 flex-wrap">
            {(p.slugTags || []).slice(0, 6).map((t) => <span key={t} className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full">{t}</span>)}
            {(p.slugTags || []).length > 6 && <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full">+{(p.slugTags || []).length - 6}</span>}
          </div>
          <div className="ml-2">{p.user?.name ?? "You"}</div>
        </div>
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
          const title = sec.translation?.title ?? sec.enTitle ?? sec.slug;
          return (
            <div key={sec.slug} className="bg-gray-900 rounded-xl overflow-hidden mb-6">
              <div className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-gray-700 to-gray-600 cursor-pointer select-none hover:opacity-90 transition" onClick={() => toggleExpanded(sec.slug)}>
                <h2 className="font-bold text-lg">🎥 {title}</h2>
                {isOpen ? <ChevronUp /> : <ChevronDown />}
              </div>

              {isOpen && (
                <div className="p-5 bg-white text-black">
                  {loading ? (
                    <div className="text-gray-500">Loading videos…</div>
                  ) : videos.length === 0 ? (
                    <div className="text-gray-500">No videos for {title}</div>
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
