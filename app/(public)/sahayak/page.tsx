// app/sahayak/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Globe } from "lucide-react";

// Import tag matching config
import { SECTION_TAG_MAPPINGS, doesPostMatchSection } from "@/lib/sectionTagMappings";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिंदी" },
  { code: "as", name: "অসমীয়া" },
  { code: "ta", name: "தமிழ்" },
  { code: "te", name: "తెలుగు" },
  { code: "kn", name: "ಕನ್ನಡ" },
  { code: "ml", name: "മലയാളം" },
];

const LS_SAHAYAK_LANGUAGE = "sahayak_selected_language";

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
  const [allVideos, setAllVideos] = useState<PostVideo[]>([]);
  const [allLinks, setAllLinks] = useState<HelpLink[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");

  // Load language preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_SAHAYAK_LANGUAGE);
      if (saved) setSelectedLanguage(saved);
    } catch (e) {
      /* ignore */
    }
  }, []);

  // Save language preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_SAHAYAK_LANGUAGE, selectedLanguage);
    } catch (e) {
      /* ignore */
    }
  }, [selectedLanguage]);

  // 1) Load tabs with translations
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/tab-translations?locale=${selectedLanguage}`);
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
  }, [selectedLanguage]);

  // 2) Fetch ALL videos once, then filter by section on render
  useEffect(() => {
    if (!sections || sections.length === 0) return;
    let alive = true;
    (async () => {
      setLoadingVideos(true);
      try {
        const q = `/api/posts?media=video&limit=500`;
        const r = await fetch(q);
        const json = await r.json();
        const videos = json?.ok ? (json.data as PostVideo[]) : json.posts || [];
        if (alive) setAllVideos(videos);
      } catch (e) {
        console.error("Error fetching videos", e);
        if (alive) setAllVideos([]);
      } finally {
        if (alive) setLoadingVideos(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sections]);

  // 3) Fetch ALL help links once, then filter by section on render
  useEffect(() => {
    if (!sections || sections.length === 0) return;
    let alive = true;
    (async () => {
      setLoadingLinks(true);
      try {
        const q = `/api/help-links?limit=500`;
        const r = await fetch(q);
        const json = await r.json();
        const links = json?.ok ? (json.data as HelpLink[]) : [];
        if (alive) setAllLinks(links);
      } catch (e) {
        console.error("Error fetching links", e);
        if (alive) setAllLinks([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sections]);

  // ✅ Filter videos for a specific section based on tag matching
  const getVideosForSection = (sectionSlug: string): PostVideo[] => {
    return allVideos.filter(video => {
      const postTags = video.slugTags || [];
      return doesPostMatchSection(postTags, sectionSlug);
    });
  };

  // ✅ Filter links for a specific section based on tag matching
  const getLinksForSection = (sectionSlug: string): HelpLink[] => {
    return allLinks.filter(link => {
      const linkTags = link.slugTags || [];
      return doesPostMatchSection(linkTags, sectionSlug);
    });
  };

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

  function renderHelpLinks(sectionSlug: string) {
    const links = getLinksForSection(sectionSlug);
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
        {/* Header with Language Selector */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Digital Sahayak</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg border border-white/20">
              <Globe className="w-4 h-4 text-blue-400" />
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-transparent text-white text-sm font-medium outline-none cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-gray-900">
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {sections.map((sec) => {
          const videos = getVideosForSection(sec.slug);
          const isOpen = expanded[sec.slug] ?? true;
          const title = sec.translation?.title || sec.enTitle;
          const description = sec.translation?.description || sec.enDescription;

          return (
            <div key={sec.slug} className="bg-gray-900 rounded-xl overflow-hidden mb-6">
              <div
                className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-gray-700 to-gray-600 cursor-pointer select-none hover:opacity-90 transition"
                onClick={() => toggleExpanded(sec.slug)}
              >
                <div>
                  <h2 className="font-bold text-lg">🎥 {title}</h2>
                  {description && <p className="text-sm text-gray-300 mt-1">{description}</p>}
                </div>
                {isOpen ? <ChevronUp /> : <ChevronDown />}
              </div>

              {isOpen && (
                <div className="p-5 bg-white text-black space-y-6">
                  {/* Videos Section */}
                  <div>
                    <h3 className="font-semibold text-lg mb-3">
                      {selectedLanguage === "en" ? "Video Tutorials" : "भिडियो ट्यूटोरियल"}
                    </h3>
                    {loadingVideos ? (
                      <div className="text-gray-500">
                        {selectedLanguage === "en" ? "Loading videos…" : "भिडियो लोड हो रहा है..."}
                      </div>
                    ) : videos.length === 0 ? (
                      <div className="text-gray-500">
                        {selectedLanguage === "en" ? "No videos available" : "कोई भिडियो उपलब्ध नहीं है"}
                      </div>
                    ) : (
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {videos.map((p) => renderVideoCard(p))}
                      </div>
                    )}
                  </div>

                  {/* Help Links Section */}
                  <div className="border-t pt-6">
                    <h3 className="font-semibold text-lg mb-3">
                      {selectedLanguage === "en" ? "Official Links" : "आधिकारिक लिंक"}
                    </h3>
                    {loadingLinks ? (
                      <div className="text-gray-500">
                        {selectedLanguage === "en" ? "Loading links…" : "लिंक लोड हो रहे हैं..."}
                      </div>
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