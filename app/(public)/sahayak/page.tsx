// app/sahayak/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

interface TabData {
  tabId: string;
  slug: string;
  enTitle: string;
  enDescription?: string;
  category?: string | null;
  translation?: {
    title: string | null;
    description: string | null;
  } | null;
}

interface PostVideo {
  id: string;
  content?: string | null;
  youtubeLinks?: string[];
  videoFileId?: string | null;
  slugTags?: string[];
  user?: { id?: string; name?: string; avatarUrl?: string };
}

interface HelpLink {
  id: string;
  pageSlug?: string | null;
  slugTags?: string[];
  country: string;
  title: string;
  url: string;
  notes?: string | null;
}

export default function SahayakPage() {
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [sections, setSections] = useState<TabData[]>([]);
  const [videosBySection, setVideosBySection] = useState<Record<string, PostVideo[]>>({});
  const [linksBySection, setLinksBySection] = useState<Record<string, HelpLink[]>>({});
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // 1) Load tabs with translations
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/tab-translations?locale=en");
        const j = await res.json();
        if (!alive) return;
        if (j?.ok && Array.isArray(j.data)) {
          setTabs(j.data || []);
          const defaults = (j.data || []).filter((t: any) => t.is_default);
          if (defaults.length > 0) setSections(defaults);
          else {
            const slugs = ["epfo", "irctc", "ids", "health", "senior"];
            const found = slugs
              .map((s) => (j.data || []).find((t: any) => t.slug === s))
              .filter(Boolean);
            setSections(found);
          }
        } else {
          console.warn("tab-translations returned unexpected format", j);
          setTabs([]);
          setSections([]);
        }
      } catch (e) {
        console.error("Failed to load tab-translations", e);
        setTabs([]);
        setSections([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2) Fetch videos for each section (using related slugs)
  useEffect(() => {
    if (!sections || sections.length === 0 || !tabs.length) return;
    let alive = true;
    (async () => {
      setLoadingVideos(true);
      try {
        const fetches = sections.map(async (sec) => {
          const related = new Set<string>();
          related.add(sec.slug);

          const secCat = (sec as any).category;
          if (secCat) {
            tabs.forEach((t) => {
              if ((t as any).category === secCat) related.add(t.slug);
            });
          }

          tabs.forEach((t) => {
            if (t.slug.startsWith(`${sec.slug}-`)) related.add(t.slug);
          });

          const slugsArr = Array.from(related);
          if (slugsArr.length === 0) return { slug: sec.slug, videos: [] };

          const q = `/api/posts?tabSlugs=${encodeURIComponent(slugsArr.join(","))}&media=video&limit=50`;
          const r = await fetch(q);
          const json = await r.json();
          const videos = json?.ok ? (json.data as PostVideo[]) : json.posts || [];
          return { slug: sec.slug, videos };
        });

        const results = await Promise.all(fetches);
        if (!alive) return;

        const mapping: Record<string, PostVideo[]> = {};
        results.forEach((res) => {
          mapping[res.slug] = res.videos || [];
        });
        setVideosBySection(mapping);
      } catch (e) {
        console.error("Error fetching section videos", e);
      } finally {
        if (alive) setLoadingVideos(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sections, tabs]);

  // 3) Fetch help links for each section
  useEffect(() => {
    if (!sections || sections.length === 0 || !tabs.length) return;
    let alive = true;
    (async () => {
      setLoadingLinks(true);
      try {
        const fetches = sections.map(async (sec) => {
          const related = new Set<string>();
          related.add(sec.slug);

          const secCat = (sec as any).category;
          if (secCat) {
            tabs.forEach((t) => {
              if ((t as any).category === secCat) related.add(t.slug);
            });
          }

          tabs.forEach((t) => {
            if (t.slug.startsWith(`${sec.slug}-`)) related.add(t.slug);
          });

          const slugsArr = Array.from(related);
          if (slugsArr.length === 0) return { slug: sec.slug, links: [] };

          const q = `/api/help-links?tabSlugs=${encodeURIComponent(slugsArr.join(","))}`;
          console.log(`[Sahayak] Fetching links for ${sec.slug}:`, q);
          const r = await fetch(q);
          const json = await r.json();
          console.log(`[Sahayak] Links response for ${sec.slug}:`, json);
          const links = json?.ok ? (json.data as HelpLink[]) : [];
          return { slug: sec.slug, links };
        });

        const results = await Promise.all(fetches);
        if (!alive) return;

        const mapping: Record<string, HelpLink[]> = {};
        results.forEach((res) => {
          mapping[res.slug] = res.links || [];
        });
        setLinksBySection(mapping);
      } catch (e) {
        console.error("Error fetching section links", e);
      } finally {
        if (alive) setLoadingLinks(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sections, tabs]);

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  function renderVideoCard(p: PostVideo) {
    const youtube =
      Array.isArray(p.youtubeLinks) && p.youtubeLinks.length > 0
        ? p.youtubeLinks[0]
        : null;
    const youtubeId = youtube
      ? (function (u: string) {
          const m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
          return m ? m[1] : null;
        })(youtube)
      : null;

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
              sandbox="allow-same-origin allow-scripts allow-popups allow-presentation"
              className="w-full h-full"
            />
          ) : p.videoFileId ? (
            <video controls className="w-full h-full bg-black">
              <source src={`/api/drive-video/${p.videoFileId}`} />
            </video>
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">
              No playable media
            </div>
          )}
        </div>
        <div className="text-sm font-medium">{(p.content || "").slice(0, 120)}</div>
      </div>
    );
  }

  function renderHelpLinks(slug: string) {
    const links = linksBySection[slug] || [];
    if (links.length === 0) {
      return (
        <div className="text-sm text-gray-500">No official links configured</div>
      );
    }

    return (
      <ul className="space-y-2">
        {links.map((link) => (
          <li
            key={link.id}
            className="flex items-center justify-between bg-gray-100 p-3 rounded hover:bg-gray-200 transition"
          >
            <div className="flex-1">
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2 break-words"
              >
                {link.title}
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
              </a>
              {link.notes && (
                <div className="text-xs text-gray-600 mt-1">{link.notes}</div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {link.country} {link.pageSlug && `• ${link.pageSlug}`}
              </div>
            </div>
          </li>
        ))}
      </ul>
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
          const links = linksBySection[sec.slug] || [];
          const isOpen = expanded[sec.slug] ?? true;
          const title = sec.translation?.title || sec.enTitle;

          return (
            <div key={sec.slug} className="bg-gray-900 rounded-xl overflow-hidden mb-6">
              <div
                className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-gray-700 to-gray-600 cursor-pointer select-none hover:opacity-90 transition"
                onClick={() => toggleExpanded(sec.slug)}
              >
                <h2 className="font-bold text-lg">🎥 {title}</h2>
                {isOpen ? <ChevronUp /> : <ChevronDown />}
              </div>

              {isOpen && (
                <div className="p-5 bg-white text-black space-y-6">
                  {/* Videos Section */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Video Tutorials</h3>
                    {loadingVideos ? (
                      <div className="text-gray-500">Loading videos…</div>
                    ) : videos.length === 0 ? (
                      <div className="text-gray-500">No videos available</div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {videos.map((p) => renderVideoCard(p))}
                      </div>
                    )}
                  </div>

                  {/* Help Links Section */}
                  <div className="border-t pt-6">
                    <h3 className="font-semibold text-lg mb-3">Official Links</h3>
                    {loadingLinks ? (
                      <div className="text-gray-500">Loading links…</div>
                    ) : (
                      renderHelpLinks(sec.slug)
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}