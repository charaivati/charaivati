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

  // Sync context locale to local state, converting name to code if needed
  useEffect(() => {
    if (languages.length === 0) return;

    const matchByCode = languages.find((l) => l.code && l.code.toLowerCase() === contextLocale.toLowerCase());
    const matchByName = languages.find((l) => l.name.toLowerCase() === contextLocale.toLowerCase());

    const actualCode = matchByCode?.code || matchByName?.code || "en";
    setLocaleState(actualCode);
  }, [contextLocale, languages]);

  // Core help links (existing)
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

  // New government service links
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

  // Notices dashboard (placeholder endpoint; you can implement /api/gov-notices server-side to return JSON feed)
  const [notices, setNotices] = useState<{ id: string; title: string; date?: string; url?: string }[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/gov-notices");
        const j = await res.json().catch(() => null);
        if (!alive) return;
        if (j && Array.isArray(j.data)) setNotices(j.data.slice(0, 10));
      } catch (e) {
        // silently ignore; show no notices
      }
    })();
    return () => { alive = false; };
  }, []);

  // YouTube videos for each section
  const sectionVideos: Record<string, Array<{ title: string; videoId: string }>> = {
    epfo: [
      { title: "How to check EPF balance", videoId: "dQw4w9WgXcQ" },
      { title: "EPFO login guide", videoId: "dQw4w9WgXcQ" },
      { title: "How to download UAN", videoId: "dQw4w9WgXcQ" },
    ],
    irctc: [
      { title: "IRCTC registration guide", videoId: "dQw4w9WgXcQ" },
      { title: "How to book train tickets", videoId: "dQw4w9WgXcQ" },
      { title: "IRCTC PNR status check", videoId: "dQw4w9WgXcQ" },
    ],
    ids: [
      { title: "How to download Aadhaar", videoId: "dQw4w9WgXcQ" },
      { title: "PAN card download guide", videoId: "dQw4w9WgXcQ" },
      { title: "Voter ID download process", videoId: "dQw4w9WgXcQ" },
    ],
    health: [
      { title: "Ayushman Bharat registration", videoId: "dQw4w9WgXcQ" },
      { title: "COVID vaccination booking", videoId: "dQw4w9WgXcQ" },
    ],
    senior: [
      { title: "Senior citizen pension schemes", videoId: "dQw4w9WgXcQ" },
      { title: "Senior citizen ID card application", videoId: "dQw4w9WgXcQ" },
    ],
  };

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

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

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

  const VideoSection = ({ sectionKey }: { sectionKey: string }) => {
    const videos = sectionVideos[sectionKey] || [];
    if (videos.length === 0) return null;
    
    const videoKey = `${sectionKey}-video`;
    const isExpanded = expanded[videoKey] || false;

    return (
      <div className="mt-4 border-t border-gray-200 pt-4">
        <button
          onClick={() => toggleExpanded(videoKey)}
          className="flex items-center justify-between w-full text-left mb-3 hover:text-blue-600 transition"
        >
          <h3 className="font-semibold text-lg flex items-center gap-2">
            🎥 {t("Help Videos")}
          </h3>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        {isExpanded && (
          <div className="space-y-4">
            {videos.map((video, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="aspect-video w-full mb-2">
                  <iframe
                    title={video.title}
                    src={`https://www.youtube.com/embed/${video.videoId}`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full rounded"
                  />
                </div>
                <div className="text-sm font-medium text-gray-700">{video.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const grouped = tabs.reduce<Record<string, TabData[]>>((acc, tab) => {
    const cat = tab.category || "General Help";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tab);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#0b1220] text-white px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">{t("Digital Sahayak")}</h1>

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
                    className={`block w-full text-left px-4 py-2 hover:bg-blue-700 transition ${
                      locale === l.code ? "bg-blue-600 text-white" : "text-gray-200"
                    }`}
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
                    {epfoLinks.map((link, idx) => <LinkBox key={idx} {...link} />)}
                  </div>
                  <VideoSection sectionKey="epfo" />
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
                    {irctcLinks.map((link, idx) => <LinkBox key={idx} {...link} />)}
                  </div>
                  <VideoSection sectionKey="irctc" />
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
                    {idLinks.map((link, idx) => <LinkBox key={idx} {...link} />)}
                  </div>
                  <VideoSection sectionKey="ids" />
                </div>
              )}
            </div>

            {/* Health */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-red-600 to-red-500 cursor-pointer select-none hover:opacity-90 transition" onClick={() => toggleExpanded("health")}>
                <h2 className="font-bold text-lg">❤️ {t("Health Services")}</h2>
                {expanded["health"] ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expanded["health"] && (
                <div className="p-5 bg-white text-black">
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    {healthLinks.map((link, idx) => <LinkBox key={idx} {...link} />)}
                  </div>
                  <VideoSection sectionKey="health" />
                </div>
              )}
            </div>

            {/* Senior Citizens */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 cursor-pointer select-none hover:opacity-90 transition" onClick={() => toggleExpanded("senior")}>
                <h2 className="font-bold text-lg">👵👴 {t("Senior Citizen Help")}</h2>
                {expanded["senior"] ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expanded["senior"] && (
                <div className="p-5 bg-white text-black">
                  <div className="grid md:grid-cols-2 gap-3 mb-4">
                    {seniorLinks.map((link, idx) => <LinkBox key={idx} {...link} />)}
                  </div>
                  <VideoSection sectionKey="senior" />
                </div>
              )}
            </div>

            {/* Notices Dashboard */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 bg-gray-800 cursor-pointer select-none hover:bg-gray-700 transition" onClick={() => toggleExpanded("notices")}>
                <h2 className="font-bold text-lg">📢 {t("Government Notices")}</h2>
                {expanded["notices"] ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expanded["notices"] && (
                <div className="p-5 bg-white text-black rounded-b-lg">
                  {notices.length === 0 ? (
                    <div className="text-sm text-gray-600">{t("No notices available")}</div>
                  ) : (
                    <ul className="space-y-3">
                      {notices.map((n) => (
                        <li key={n.id} className="border rounded p-3">
                          <a href={n.url || "#"} target="_blank" rel="noreferrer" className="font-semibold text-blue-700">{n.title}</a>
                          {n.date && <div className="text-xs text-gray-600">{n.date}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 text-xs text-gray-500">{t("You can subscribe to RSS or return here for latest updates.")}</div>
                </div>
              )}
            </div>

            {/* Generic DB driven sections */}
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
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50 p-6">
          <div className="max-w-4xl w-full text-center">
            <p className="text-gray-400 mb-12">{t("Choose your language to continue")}</p>

            {languages.length === 0 ? (
              <div className="text-gray-400">Loading languages...</div>
            ) : (
              <div className="flex flex-wrap justify-center gap-6">
                {languages.map((l) => (
                  <button key={l.code} onClick={() => { setLocale(l.code); setLocaleState(l.code); setShowLanguagePicker(false); }} className="w-44 h-28 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 flex flex-col items-center justify-center gap-1 transform hover:scale-105 transition-all">
                    <div className="text-xl font-semibold">{l.name}</div>
                    <div className="text-xs text-gray-400">{l.code}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
