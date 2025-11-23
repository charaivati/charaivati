// app/sahayak/page.tsx (or your existing SahayakPage component file)
"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

interface TabData {
  tabId: string;
  slug: string;
  enTitle: string;
  enDescription: string;
  category?: string | null;
  translation?: {
    title: string | null;
    description: string | null;
  } | null;
}

interface Language {
  code: string;
  name: string;
}

interface HelpLink {
  slug: string;
  url: string;
}

export default function SahayakPage() {
  const { locale: contextLocale, setLocale } = useLanguage();
  const [locale, setLocaleState] = useState<string>("en");
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLangs, setShowLangs] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  // Check if language is already saved
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("lang") : null;
    if (!saved) {
      setShowLanguagePicker(true);
    }
  }, []);

  // Sync context locale to local state
  useEffect(() => {
    if (languages.length === 0) return;

    const matchByCode = languages.find((l) => l.code && l.code.toLowerCase() === contextLocale.toLowerCase());
    const matchByName = languages.find((l) => l.name.toLowerCase() === contextLocale.toLowerCase());

    const actualCode = matchByCode?.code || matchByName?.code || "en";
    setLocaleState(actualCode);
  }, [contextLocale, languages]);

  // YouTube etc replaced by posts-driven videos
  const [sahayakVideos, setSahayakVideos] = useState<
    Array<{ id: string; title?: string; youtube?: string; gdriveVideoId?: string }>
  >([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  // fetch posts that are tagged for sahayak (backend should support this query)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingVideos(true);
      try {
        // adjust API query to fit your backend: here example filters posts that have slugTags including "sahayak"
        const res = await fetch("/api/posts?tag=sahayak&media=video");
        const j = await res.json().catch(() => null);
        if (!alive) return;
        if (j?.ok && Array.isArray(j.posts)) {
          const videos = j.posts.map((p: any) => ({
            id: p.id,
            title: p.content?.slice(0, 80) || (Array.isArray(p.slugTags) ? p.slugTags.join(", ") : "Post video"),
            youtube: Array.isArray(p.youtubeLinks) && p.youtubeLinks.length > 0 ? p.youtubeLinks[0] : undefined,
            gdriveVideoId: p.videoFileId || p.video?.gdriveId || undefined,
          }));
          setSahayakVideos(videos);
        } else {
          setSahayakVideos([]);
        }
      } catch (e) {
        console.error("fetch sahayak posts", e);
        setSahayakVideos([]);
      } finally {
        alive && setLoadingVideos(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // fetch languages and tabs (as before)
  useEffect(() => {
    fetch("/api/languages")
      .then((r) => r.json())
      .then((res) => {
        if (res.ok && Array.isArray(res.data)) setLanguages(res.data);
      })
      .catch(() => setLanguages([]));
  }, []);

  useEffect(() => {
    async function loadTabs() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tab-translations?locale=${locale.toLowerCase()}`);
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Failed to fetch");
        setTabs(json.data || []);
      } catch (e: any) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    loadTabs();
  }, [locale]);

  function t(slug: string): string {
    const s = slug.toLowerCase().trim();
    const found = tabs.find((tab) => tab.slug && tab.slug.toLowerCase() === s);
    if (!found) return slug;
    if (locale === "en") return found.enTitle;
    return found.translation?.title || found.enTitle;
  }

  function td(slug: string): string {
    const s = slug.toLowerCase().trim();
    const found = tabs.find((tab) => tab.slug && tab.slug.toLowerCase() === s);
    if (!found) return "";
    if (locale === "en") return found.enDescription;
    return found.translation?.description || found.enDescription || "";
  }

  const toggleExpanded = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const LinkBox = ({ slug, url }: HelpLink) => {
    const title = t(slug);
    const desc = td(slug);

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="border border-gray-300 rounded-lg p-4 hover:shadow-lg hover:border-blue-500 transition bg-white text-black flex items-start justify-between group"
      >
        <div className="flex-1">
          <h4 className="font-semibold text-lg group-hover:text-blue-600">{title}</h4>
          {desc && <p className="text-sm text-gray-600 mt-1">{desc}</p>}
        </div>
        <ExternalLink className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0 ml-2" />
      </a>
    );
  };

  const grouped = tabs.reduce<Record<string, TabData[]>>((acc, tab) => {
    const cat = tab.category || "General Help";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tab);
    return acc;
  }, {});

  // core help links (unchanged)
  const epfoLinks: HelpLink[] = [
    { slug: "epfo login", url: "https://www.epfindia.gov.in/" },
    { slug: "epfo change password", url: "https://www.epfindia.gov.in/" },
    { slug: "epfo download uan", url: "https://www.epfindia.gov.in/" },
    { slug: "epfo check claim", url: "https://www.epfindia.gov.in/" },
    { slug: "epfo update contact", url: "https://www.epfindia.gov.in/" },
  ];

  const irctcLinks: HelpLink[] = [
    { slug: "irctc login", url: "https://www.irctc.co.in/" },
    { slug: "irctc register", url: "https://www.irctc.co.in/nget/profile/user-registration" },
    { slug: "irctc forgot password", url: "https://www.irctc.co.in/nget/profile/user-registration" },
    { slug: "irctc check pnr", url: "https://www.irctc.co.in/nget/pnr" },
    { slug: "irctc cancel ticket", url: "https://www.irctc.co.in/nget/booking/cancel" },
  ];

  const idLinks: HelpLink[] = [
    { slug: "aadhar download", url: "https://eaadhaar.uidai.gov.in/" },
    { slug: "aadhar update", url: "https://resident.uidai.gov.in/offline-kyc" },
    { slug: "voter id search", url: "https://electoralsearch.in/" },
    { slug: "download voter id (epic)", url: "https://www.nvsp.in/" },
    { slug: "pan download", url: "https://www.incometax.gov.in/iec/foportal" },
  ];

  const healthLinks: HelpLink[] = [
    { slug: "ayushman bharat portal", url: "https://www.pmjay.gov.in/" },
    { slug: "national health portal", url: "https://www.nhp.gov.in/" },
    { slug: "covid vaccination", url: "https://www.cowin.gov.in/" },
    { slug: "senior citizen health help", url: "https://www.india.gov.in/" },
  ];

  const seniorLinks: HelpLink[] = [
    { slug: "pension schemes", url: "https://eshram.gov.in/" },
    { slug: "senior citizen id card", url: "https://www.india.gov.in/" },
    { slug: "senior citizen welfare", url: "https://socialjustice.gov.in/" },
  ];

  return (
    <div className="min-h-screen bg-[#0b1220] text-white px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Digital Sahayak</h1>

          <div className="relative">
            <button
              onClick={() => setShowLangs((v) => !v)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white font-semibold transition"
            >
              🌐 {languages.find((l) => l.code === locale)?.name || locale.toUpperCase()}
            </button>
            {showLangs && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-10">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLocale(l.code);
                      setLocaleState(l.code);
                      setShowLangs(false);
                    }}
                    className={`block w-full text-left px-4 py-2 hover:bg-blue-700 transition ${locale === l.code ? "bg-blue-600 text-white" : "text-gray-200"}`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main */}
        {loading && <div className="text-gray-400">Loading translations…</div>}
        {error && <div className="text-red-400">{error}</div>}

        {!loading && !error && (
          <div className="space-y-5">
            {/* EPFO */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-orange-600 to-orange-500 cursor-pointer select-none hover:opacity-90 transition" onClick={() => toggleExpanded("epfo")}>
                <h2 className="font-bold text-lg">🏢 {t("EPFO")} {t("Help")}</h2>
                {expanded["epfo"] ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expanded["epfo"] && (
                <div className="p-5 bg-white text-black">
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    {epfoLinks.map((link, idx) => (
                      <LinkBox key={idx} {...link} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* IRCTC */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-green-600 to-green-500 cursor-pointer select-none hover:opacity-90 transition" onClick={() => toggleExpanded("irctc")}>
                <h2 className="font-bold text-lg">🚂 {t("IRCTC")} {t("Help")}</h2>
                {expanded["irctc"] ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expanded["irctc"] && (
                <div className="p-5 bg-white text-black">
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    {irctcLinks.map((link, idx) => (
                      <LinkBox key={idx} {...link} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Identity & Documents */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 cursor-pointer select-none hover:opacity-90 transition" onClick={() => toggleExpanded("ids")}>
                <h2 className="font-bold text-lg">🪪 {t("Identity & Documents")}</h2>
                {expanded["ids"] ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expanded["ids"] && (
                <div className="p-5 bg-white text-black">
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    {idLinks.map((link, idx) => (
                      <LinkBox key={idx} {...link} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Community videos for Sahayak - scrollable */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 bg-gray-800 cursor-pointer select-none hover:bg-gray-700 transition">
                <h2 className="font-bold text-lg">🎥 Community Help Videos</h2>
              </div>
              <div className="p-5 bg-white text-black">
                {loadingVideos ? (
                  <div className="text-gray-400">Loading videos…</div>
                ) : sahayakVideos.length === 0 ? (
                  <div className="text-gray-500">No videos yet. Users who tag posts for “sahayak” will appear here.</div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {sahayakVideos.map((v) => {
                      const youtubeId = v.youtube ? (function extract(url: string) {
                        const m = url.match(/(?:v=|\/)([A-Za-z0-9_-]{11})/);
                        return m ? m[1] : null;
                      })(v.youtube) : null;

                      return (
                        <div key={v.id} className="min-w-[320px] bg-white rounded shadow p-2 text-black">
                          <div className="aspect-video w-[320px] mb-2 overflow-hidden rounded">
                            {youtubeId ? (
                              <iframe
                                src={`https://www.youtube.com/embed/${youtubeId}`}
                                title={v.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full"
                              />
                            ) : v.gdriveVideoId ? (
                              <video controls className="w-full h-full bg-black">
                                <source src={`/api/drive-video/${v.gdriveVideoId}`} />
                              </video>
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500">No playable media</div>
                            )}
                          </div>
                          <div className="text-sm font-medium">{v.title}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Other sections (health, senior, grouped tabs...) */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 bg-red-800 cursor-pointer select-none hover:opacity-90 transition" onClick={() => toggleExpanded("health")}>
                <h2 className="font-bold text-lg">❤️ {t("Health Services")}</h2>
                {expanded["health"] ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expanded["health"] && (
                <div className="p-5 bg-white text-black">
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    {healthLinks.map((link, idx) => <LinkBox key={idx} {...link} />)}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 bg-yellow-700 cursor-pointer select-none hover:opacity-90 transition" onClick={() => toggleExpanded("senior")}>
                <h2 className="font-bold text-lg">👵👴 {t("Senior Citizen Help")}</h2>
                {expanded["senior"] ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expanded["senior"] && (
                <div className="p-5 bg-white text-black">
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    {seniorLinks.map((link, idx) => <LinkBox key={idx} {...link} />)}
                  </div>
                </div>
              )}
            </div>

            {/* DB driven grouped tabs */}
            {Object.entries(grouped).map(([category, categoryTabs]) => {
              const isOpen = expanded[category] ?? true;
              return (
                <div key={category} className="bg-gray-900 rounded-xl overflow-hidden">
                  <div className="flex justify-between items-center px-5 py-4 bg-gray-800 cursor-pointer select-none hover:bg-gray-700 transition" onClick={() => toggleExpanded(category)}>
                    <h2 className="font-bold text-lg">{category}</h2>
                    {isOpen ? <ChevronUp /> : <ChevronDown />}
                  </div>
                  {isOpen && (
                    <div className="p-5 grid md:grid-cols-2 gap-3 bg-white text-black">
                      {categoryTabs.map((tab) => (
                        <div key={tab.tabId} className="border border-gray-300 rounded-lg p-4 hover:shadow-lg transition">
                          <h3 className="font-semibold text-lg">{locale === "en" ? tab.enTitle : tab.translation?.title || tab.enTitle}</h3>
                          {(locale === "en" ? tab.enDescription : tab.translation?.description || tab.enDescription) && (
                            <p className="text-sm text-gray-700 mt-1 leading-snug">{locale === "en" ? tab.enDescription : tab.translation?.description || tab.enDescription}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Language Picker Popup */}
      {showLanguagePicker && (
        <div className="fixed inset-0 bg-black z-50 overflow-y-auto">
          <div className="w-full min-h-full flex flex-col items-center p-4 md:p-6 pt-8 md:pt-12">
            <div className="max-w-4xl w-full text-center">
              <p className="text-gray-400 mb-6 md:mb-12">Choose your language to continue</p>

              {languages.length === 0 ? (
                <div className="text-gray-400">Loading languages...</div>
              ) : (
                <div className="flex flex-wrap justify-center gap-4 md:gap-6 pb-8">
                  {languages.map((l) => (
                    <button key={l.code} onClick={() => { setLocale(l.code); setLocaleState(l.code); setShowLanguagePicker(false); }} className="w-36 h-24 md:w-44 md:h-28 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 active:bg-white/10 p-4 flex flex-col items-center justify-center gap-1 transform active:scale-95 transition-all">
                      <div className="text-lg md:text-xl font-semibold">{l.name}</div>
                      <div className="text-xs text-gray-400">{l.code}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
