"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

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
  const [locale, setLocale] = useState("en");
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLangs, setShowLangs] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
    const found = tabs.find((tab) => tab.slug.toLowerCase() === s);
    if (!found) return slug;
    if (locale === "en") return found.enTitle;
    return found.translation?.title || found.enTitle;
  }

  function td(slug: string): string {
    const s = slug.toLowerCase().trim();
    const found = tabs.find((tab) => tab.slug.toLowerCase() === s);
    if (!found) return "";
    if (locale === "en") return found.enDescription;
    return found.translation?.description || found.enDescription;
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
          <h4 className="font-semibold text-lg group-hover:text-blue-600">
            {title}
          </h4>
          {desc && (
            <p className="text-sm text-gray-600 mt-1">{desc}</p>
          )}
        </div>
        <ExternalLink className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0 ml-2" />
      </a>
    );
  };

  const HelpSection = ({
    sectionKey,
    titleSlug,
    links,
    bgGradient,
  }: {
    sectionKey: string;
    titleSlug: string;
    links: HelpLink[];
    bgGradient: string;
  }) => (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div
        className={`flex justify-between items-center px-5 py-4 ${bgGradient} cursor-pointer select-none hover:opacity-90 transition`}
        onClick={() => toggleExpanded(sectionKey)}
      >
        <h2 className="font-bold text-lg">{t(titleSlug)}</h2>
        {expanded[sectionKey] ? <ChevronUp /> : <ChevronDown />}
      </div>
      {expanded[sectionKey] && (
        <div className="p-5 grid md:grid-cols-2 gap-3 bg-white text-black">
          {links.map((link, idx) => (
            <LinkBox key={idx} {...link} />
          ))}
        </div>
      )}
    </div>
  );

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
            {/* EPFO Section */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div
                className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-orange-600 to-orange-500 cursor-pointer select-none hover:opacity-90 transition"
                onClick={() => toggleExpanded("epfo")}
              >
                <h2 className="font-bold text-lg">
                  🏢 {t("EPFO")} {t("Help")}
                </h2>
                {expanded["epfo"] ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expanded["epfo"] && (
                <div className="p-5 grid md:grid-cols-2 gap-3 bg-white text-black">
                  {epfoLinks.map((link, idx) => (
                    <LinkBox key={idx} {...link} />
                  ))}
                </div>
              )}
            </div>

            {/* IRCTC Section */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div
                className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-green-600 to-green-500 cursor-pointer select-none hover:opacity-90 transition"
                onClick={() => toggleExpanded("irctc")}
              >
                <h2 className="font-bold text-lg">
                  🚂 {t("IRCTC")} {t("Help")}
                </h2>
                {expanded["irctc"] ? <ChevronUp /> : <ChevronDown />}
              </div>
              {expanded["irctc"] && (
                <div className="p-5 grid md:grid-cols-2 gap-3 bg-white text-black">
                  {irctcLinks.map((link, idx) => (
                    <LinkBox key={idx} {...link} />
                  ))}
                </div>
              )}
            </div>

            {/* Category Sections from DB */}
            {Object.entries(grouped).map(([category, categoryTabs]) => {
              const isOpen = expanded[category] ?? true;
              return (
                <div key={category} className="bg-gray-900 rounded-xl overflow-hidden">
                  <div
                    className="flex justify-between items-center px-5 py-4 bg-gray-800 cursor-pointer select-none hover:bg-gray-700 transition"
                    onClick={() => toggleExpanded(category)}
                  >
                    <h2 className="font-bold text-lg">{category}</h2>
                    {isOpen ? <ChevronUp /> : <ChevronDown />}
                  </div>
                  {isOpen && (
                    <div className="p-5 grid md:grid-cols-2 gap-3 bg-white text-black">
                      {categoryTabs.map((tab) => (
                        <div
                          key={tab.tabId}
                          className="border border-gray-300 rounded-lg p-4 hover:shadow-lg transition"
                        >
                          <h3 className="font-semibold text-lg">
                            {locale === "en"
                              ? tab.enTitle
                              : tab.translation?.title || tab.enTitle}
                          </h3>
                          {(locale === "en"
                            ? tab.enDescription
                            : tab.translation?.description || tab.enDescription) && (
                            <p className="text-sm text-gray-700 mt-1 leading-snug">
                              {locale === "en"
                                ? tab.enDescription
                                : tab.translation?.description || tab.enDescription}
                            </p>
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
    </div>
  );
}