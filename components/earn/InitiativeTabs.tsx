"use client";

import { useState } from "react";
import PartnersTab from "./PartnersTab";

type Tab = "overview" | "store" | "partners";

interface InitiativeTabsProps {
  pageId: string;
  pageType: string;
  storeName: string | null;
  storeSlug: string | null;
  storeId: string | null;
  ownerPages: { id: string; title: string; pageType: string }[];
}

export default function InitiativeTabs({
  pageId,
  pageType,
  storeName,
  storeSlug,
  storeId,
  ownerPages,
}: InitiativeTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [openingStore, setOpeningStore] = useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "store", label: "Store" },
    { id: "partners", label: "Partners" },
  ];

  async function handleOpenStore() {
    setOpeningStore(true);
    try {
      const res = await fetch(`/api/store/for-page/${pageId}`, { credentials: "include" });
      if (res.ok) {
        const { storeId: id, storeSlug: slug, isNew } = await res.json();
        window.location.href = isNew ? `/store/${id}/setup` : `/store/${slug ?? id}`;
      }
    } finally {
      setOpeningStore(false);
    }
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-900 border border-gray-800 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="space-y-3">
          {pageType === "helping" ? (
            <>
              <a
                href={`/business/helping/${pageId}`}
                className="flex items-center justify-between p-4 rounded-xl border border-teal-800/60 bg-teal-900/20 hover:bg-teal-900/40 transition-colors"
              >
                <div>
                  <p className="font-medium text-teal-300">Manage Initiative</p>
                  <p className="text-sm text-gray-400 mt-0.5">Edit objectives, metrics, awareness</p>
                </div>
                <span className="text-teal-400">→</span>
              </a>
              <a
                href={`/helping/${pageId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-xl border border-gray-800 bg-gray-900/50 hover:bg-gray-900 transition-colors"
              >
                <div>
                  <p className="font-medium text-white">View Public Page</p>
                  <p className="text-sm text-gray-400 mt-0.5">See how visitors see your initiative</p>
                </div>
                <span className="text-gray-400">↗</span>
              </a>
            </>
          ) : (
            <a
              href="/business"
              className="flex items-center justify-between p-4 rounded-xl border border-indigo-800/60 bg-indigo-900/20 hover:bg-indigo-900/40 transition-colors"
            >
              <div>
                <p className="font-medium text-indigo-300">Evaluate &amp; Plan</p>
                <p className="text-sm text-gray-400 mt-0.5">Business idea scoring and planning tools</p>
              </div>
              <span className="text-indigo-400">→</span>
            </a>
          )}
        </div>
      )}

      {/* Store */}
      {activeTab === "store" && (
        <div>
          {pageType === "helping" ? (
            <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50 text-center text-gray-400">
              Helping initiatives don&apos;t have a store.
            </div>
          ) : storeId ? (
            <a
              href={`/store/${storeSlug ?? storeId}`}
              className="flex items-center justify-between p-4 rounded-xl border border-emerald-800/60 bg-emerald-900/20 hover:bg-emerald-900/40 transition-colors"
            >
              <div>
                <p className="font-medium text-emerald-300">{storeName ?? "Your Store"}</p>
                <p className="text-sm text-gray-400 mt-0.5">View and manage your store</p>
              </div>
              <span className="text-emerald-400">→</span>
            </a>
          ) : (
            <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50 text-center space-y-4">
              <p className="text-gray-400">No store set up yet.</p>
              <button
                onClick={handleOpenStore}
                disabled={openingStore}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {openingStore ? "Opening…" : "Set up store"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Partners */}
      {activeTab === "partners" && (
        <PartnersTab pageId={pageId} ownerPages={ownerPages} />
      )}
    </div>
  );
}
