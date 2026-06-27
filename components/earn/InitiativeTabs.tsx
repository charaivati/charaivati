"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import PartnersTab from "./PartnersTab";
import StoreTaxonomyPicker, { StoreTaxonomy } from "./StoreTaxonomyPicker";
import { useLanguage } from "@/components/LanguageProvider";
import { useTranslations } from "@/hooks/useTranslations";
import { uploadStoreImage } from "@/lib/store/uploadImage";

const CommunityGroupStudio = dynamic(() => import("./CommunityGroupStudio"), { ssr: false });
const WorkflowTab          = dynamic(() => import("./WorkflowTab"),          { ssr: false });
const TeamTab              = dynamic(() => import("./TeamTab"),              { ssr: false });
const StoreLocationForm    = dynamic(() => import("./StoreLocationForm"),    { ssr: false });
const VpaSettingCard       = dynamic(() => import("../payments/VpaSettingCard"), { ssr: false });
type Tab = "overview" | "store" | "team" | "partners" | "workflow" | "fleet";

const TAXONOMY_SLUGS =
  "store-categories-label,store-categories-prompt,store-tags-label,store-tags-prompt," +
  "store-taxonomy-save,store-taxonomy-saving,store-taxonomy-saved,store-categories-cap";

interface StoreLocation {
  line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  lat: number | null;
  lng: number | null;
}

interface InitiativeTabsProps {
  pageId: string;
  pageType: string;
  storeName: string | null;
  storeSlug: string | null;
  storeId: string | null;
  ownerPages: { id: string; title: string; pageType: string }[];
}

function CommunityGroupTabs({ pageId, ownerPages }: { pageId: string; ownerPages: { id: string; title: string; pageType: string }[] }) {
  const [activeTab, setActiveTab] = useState<"community" | "partners">("community");
  return (
    <div>
      <div className="flex gap-1 p-1 rounded-xl bg-gray-900 border border-gray-800 mb-6">
        {(["community", "partners"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "community" ? "Group" : "Partners"}
          </button>
        ))}
      </div>
      {activeTab === "community" && <CommunityGroupStudio pageId={pageId} />}
      {activeTab === "partners" && <PartnersTab pageId={pageId} ownerPages={ownerPages} />}
    </div>
  );
}


export default function InitiativeTabs({
  pageId,
  pageType,
  storeName,
  storeSlug,
  storeId,
  ownerPages,
}: InitiativeTabsProps) {
  const searchParams = useSearchParams();

  if (pageType === "community_group") {
    return <CommunityGroupTabs pageId={pageId} ownerPages={ownerPages} />;
  }

  const VALID_TABS: Tab[] = ["overview", "store", "team", "partners", "workflow", "fleet"];
  const tabParam = searchParams?.get("tab") as Tab | null;
  const initialTab: Tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "overview";

  const { locale } = useLanguage();
  const t = useTranslations(TAXONOMY_SLUGS);

  const [activeTab,       setActiveTab]       = useState<Tab>(initialTab);
  const [openingStore,    setOpeningStore]     = useState(false);
  const [canEdit,         setCanEdit]         = useState(true);
  const [storeOpen,       setStoreOpen]       = useState<boolean | null>(null);
  const [togglingOrders,  setTogglingOrders]  = useState(false);
  const [storeLocation,   setStoreLocation]   = useState<StoreLocation | null>(null);
  const [storeVpa,        setStoreVpa]        = useState<string | null | undefined>(undefined);
  const [storeAvatarUrl,  setStoreAvatarUrl]  = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const [savingLocation,  setSavingLocation]  = useState(false);
  const [taxonomy,            setTaxonomy]            = useState<StoreTaxonomy | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedTagIds,      setSelectedTagIds]      = useState<string[]>([]);
  const [taxonomySaveState,   setTaxonomySaveState]   = useState<"idle" | "saving" | "saved">("idle");

  // Transfer ownership state
  type XferStatus = { id: string; status: string; toEmail: string; sentTo?: string | null; otpExpiresAt?: string | null; recipientExpiry?: string | null } | null;
  const [xfer,        setXfer]        = useState<XferStatus | undefined>(undefined); // undefined = not yet fetched
  const [xferEmail,   setXferEmail]   = useState("");
  const [xferOtp,     setXferOtp]     = useState("");
  const [xferLoading, setXferLoading] = useState(false);
  const [xferError,   setXferError]   = useState<string | null>(null);
  const [xferOpen,    setXferOpen]    = useState(false);

  // Fetch team role to determine edit permissions (founder / co_founder = can edit)
  useEffect(() => {
    fetch(`/api/initiative/${pageId}/team`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const role: string | null = data.userTeamRole ?? null;
        // null = owner without explicit team record → full access
        setCanEdit(role === null || role === "founder" || role === "co_founder");
      })
      .catch(() => { /* keep default canEdit=true on error */ });
  }, [pageId]);

  const tabs: { id: Tab; label: string }[] = pageType === "fleet"
    ? [
        { id: "overview", label: "Overview" },
        { id: "fleet",    label: "Fleet" },
        { id: "team",     label: "Team" },
        { id: "partners", label: "Partners" },
        { id: "workflow", label: "Workflow" },
      ]
    : [
        { id: "overview", label: "Overview" },
        { id: "store",    label: "Store" },
        { id: "team",     label: "Team" },
        { id: "partners", label: "Partners" },
        { id: "workflow", label: "Workflow" },
      ];

  useEffect(() => {
    if ((activeTab !== "store" && activeTab !== "fleet") || !storeId || storeOpen !== null) return;
    fetch(`/api/store/${storeId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setStoreOpen(d.acceptingOrders ?? false);
        setStoreLocation(d.location ?? null);
        setStoreVpa(d.upiVpa ?? null);
        setStoreAvatarUrl(d.avatarUrl ?? null);
        setSelectedCategoryIds(d.categoryIds ?? []);
        setSelectedTagIds(d.tagIds ?? []);
      })
      .catch(() => {});
  }, [activeTab, storeId, storeOpen]);

  useEffect(() => {
    if (activeTab !== "store" || !storeId || taxonomy !== null) return;
    fetch(`/api/store/taxonomy?locale=${locale}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setTaxonomy({ categories: d.categories ?? [], tags: d.tags ?? [] });
      })
      .catch(() => {});
  }, [activeTab, storeId, taxonomy, locale]);

  async function handleSaveTaxonomy() {
    if (!storeId) return;
    setTaxonomySaveState("saving");
    try {
      const res = await fetch(`/api/store/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ categoryIds: selectedCategoryIds, tagIds: selectedTagIds }),
      });
      if (res.ok) {
        setTaxonomySaveState("saved");
        setTimeout(() => setTaxonomySaveState("idle"), 2000);
      } else {
        setTaxonomySaveState("idle");
      }
    } catch {
      setTaxonomySaveState("idle");
    }
  }

  async function handleSaveLocation(data: { line1: string; city: string; state: string; pincode: string; lat: number | null; lng: number | null }) {
    if (!storeId) return;
    setSavingLocation(true);
    try {
      const res = await fetch(`/api/store/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ location: data }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStoreLocation(updated.location ?? null);
        setEditingLocation(false);
      }
    } finally {
      setSavingLocation(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!storeId || avatarUploading) return;
    setAvatarUploading(true);
    try {
      const { url } = await uploadStoreImage(file, storeId);
      setStoreAvatarUrl(url);
      await fetch(`/api/store/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ avatarUrl: url }),
      });
    } catch (e) {
      console.error("[avatar upload]", e);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleToggleOrders() {
    if (!storeId || togglingOrders) return;
    const next = !(storeOpen ?? false);
    setStoreOpen(next);
    setTogglingOrders(true);
    try {
      const res = await fetch(`/api/store/${storeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ acceptingOrders: next }),
      });
      if (!res.ok) setStoreOpen(!next);
    } catch {
      setStoreOpen(!next);
    } finally {
      setTogglingOrders(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "overview" || xfer !== undefined) return;
    fetch(`/api/initiative/${pageId}/transfer/status`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setXfer(d?.transfer ?? null))
      .catch(() => setXfer(null));
  }, [activeTab, pageId, xfer]);

  async function handleTransferInitiate() {
    if (!xferEmail || xferLoading) return;
    setXferLoading(true); setXferError(null);
    try {
      const res = await fetch(`/api/initiative/${pageId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toEmail: xferEmail }),
      });
      const d = await res.json();
      if (!res.ok) { setXferError(d.error ?? "Something went wrong"); return; }
      setXfer(d.transfer);
      setXferEmail("");
    } finally { setXferLoading(false); }
  }

  async function handleTransferResend() {
    if (!xfer?.toEmail || xferLoading) return;
    setXferLoading(true); setXferOtp(""); setXferError(null);
    try {
      const res = await fetch(`/api/initiative/${pageId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toEmail: xfer.toEmail }),
      });
      const d = await res.json();
      if (!res.ok) { setXferError(d.error ?? "Something went wrong"); return; }
      setXfer(d.transfer);
    } finally { setXferLoading(false); }
  }

  async function handleTransferOtp() {
    if (xferOtp.length !== 6 || xferLoading) return;
    setXferLoading(true); setXferError(null);
    try {
      const res = await fetch(`/api/initiative/${pageId}/transfer/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: xferOtp }),
      });
      const d = await res.json();
      if (!res.ok) { setXferError(d.error ?? "Something went wrong"); return; }
      setXfer(d.transfer);
      setXferOtp("");
    } finally { setXferLoading(false); }
  }

  async function handleTransferCancel() {
    if (xferLoading) return;
    setXferLoading(true); setXferError(null);
    try {
      const res = await fetch(`/api/initiative/${pageId}/transfer`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) { setXfer(null); setXferOpen(false); }
    } finally { setXferLoading(false); }
  }

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
      {/* Tab bar — horizontally scrollable pill tabs */}
      <div
        className="flex gap-2 overflow-x-auto mb-6 pb-0.5"
        style={{ scrollbarWidth: "none" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 whitespace-nowrap text-sm font-medium transition-all px-4 py-2 rounded-[20px] ${
              activeTab === tab.id
                ? "bg-[#534AB7] text-white"
                : "bg-gray-800 text-gray-400"
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
            <>
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
            </>
          )}

          {/* Transfer Ownership */}
          <div className="border border-gray-800 rounded-xl overflow-hidden mt-2">
            <button
              onClick={() => setXferOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-900/30 transition-colors"
            >
              <span className="text-sm text-gray-500 font-medium">Transfer Ownership</span>
              <span className="text-gray-700 text-xs">{xferOpen ? "▲" : "▼"}</span>
            </button>

            {xferOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
                {xfer === undefined && (
                  <p className="text-xs text-gray-500 pt-3">Loading…</p>
                )}

                {/* Step 0 — idle */}
                {xfer === null && (
                  <div className="space-y-3 pt-3">
                    <p className="text-xs text-orange-400/80">
                      ⚠️ Transfers full control to another user. You have 7 days to revoke after they accept.
                    </p>
                    <input
                      type="email"
                      value={xferEmail}
                      onChange={(e) => setXferEmail(e.target.value)}
                      placeholder="Recipient's email address"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    />
                    {xferError && <p className="text-xs text-red-400">{xferError}</p>}
                    <button
                      onClick={handleTransferInitiate}
                      disabled={xferLoading || !xferEmail}
                      className="w-full py-2 rounded-lg bg-orange-700/80 text-white text-sm font-medium disabled:opacity-40 hover:bg-orange-700 transition-colors"
                    >
                      {xferLoading ? "Sending code…" : "Start Transfer"}
                    </button>
                  </div>
                )}

                {/* Step 1 — OTP pending */}
                {xfer?.status === "otp_pending" && (
                  <div className="space-y-3 pt-3">
                    <p className="text-xs text-gray-300">
                      A 6-digit code was sent to{" "}
                      <strong className="text-white">{xfer.sentTo ?? "your email"}</strong>.
                      {" "}Enter it to confirm the transfer to{" "}
                      <strong className="text-white">{xfer.toEmail}</strong>.
                      {" "}Check your spam folder if you don't see it.
                    </p>
                    {xfer.otpExpiresAt && (
                      <p className="text-xs text-gray-500">
                        Expires: {new Date(xfer.otpExpiresAt).toLocaleTimeString()}
                      </p>
                    )}
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={xferOtp}
                      onChange={(e) => setXferOtp(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 text-center tracking-widest"
                    />
                    {xferError && <p className="text-xs text-red-400">{xferError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleTransferOtp}
                        disabled={xferLoading || xferOtp.length !== 6}
                        className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-indigo-700 transition-colors"
                      >
                        {xferLoading ? "Verifying…" : "Confirm"}
                      </button>
                      <button
                        onClick={handleTransferCancel}
                        disabled={xferLoading}
                        className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm disabled:opacity-40 hover:border-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    <button
                      onClick={handleTransferResend}
                      disabled={xferLoading}
                      className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 underline-offset-2 hover:underline"
                    >
                      Resend code
                    </button>
                  </div>
                )}

                {/* Step 2 — awaiting recipient */}
                {xfer?.status === "awaiting_recipient" && (
                  <div className="space-y-3 pt-3">
                    <p className="text-xs text-gray-300">
                      ✉️ Confirmation email sent to{" "}
                      <strong className="text-white">{xfer.toEmail}</strong>. Waiting for them to accept.
                    </p>
                    {xfer.recipientExpiry && (
                      <p className="text-xs text-gray-500">
                        Link expires: {new Date(xfer.recipientExpiry).toLocaleString()}
                      </p>
                    )}
                    <button
                      onClick={handleTransferCancel}
                      disabled={xferLoading}
                      className="w-full py-2 rounded-lg border border-gray-700 text-gray-400 text-sm disabled:opacity-40 hover:border-gray-600 transition-colors"
                    >
                      {xferLoading ? "Cancelling…" : "Cancel Transfer"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fleet */}
      {activeTab === "fleet" && (
        <div className="space-y-4">
          {storeId ? (
            <>
              <a
                href={`/fleet/${pageId}`}
                className="flex items-center justify-between p-4 rounded-xl border border-amber-800/60 bg-amber-900/20 hover:bg-amber-900/40 transition-colors"
              >
                <div>
                  <p className="font-medium text-amber-300">{storeName ?? "Your Fleet"}</p>
                  <p className="text-sm text-gray-400 mt-0.5">View and manage your fleet</p>
                </div>
                <span className="text-amber-400">→</span>
              </a>

              {/* Fleet on Service toggle — same mechanism as Store's "Taking orders" */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-800 bg-gray-900/50">
                <button
                  onClick={handleToggleOrders}
                  disabled={togglingOrders || storeOpen === null}
                  style={{
                    position: "relative", width: 44, height: 24, borderRadius: 12,
                    background: storeOpen ? "#22C55E" : "#4B5563",
                    border: "none", cursor: togglingOrders ? "default" : "pointer",
                    opacity: storeOpen === null ? 0.5 : 1, flexShrink: 0, transition: "background 0.2s",
                  }}
                  aria-label={storeOpen ? "Turn off Fleet on Service" : "Turn on Fleet on Service"}
                >
                  <span style={{
                    position: "absolute", top: 2, left: storeOpen ? 22 : 2, width: 20, height: 20,
                    borderRadius: "50%", background: "#fff", transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }} />
                </button>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {storeOpen ? "Fleet on Service" : "Fleet off Service"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {storeOpen ? "Customers can book your fleet services." : "Customers can see your fleet but can't book yet."}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50 text-center space-y-4">
              <p className="text-gray-400">No fleet set up yet.</p>
              <button
                onClick={() => { window.location.href = `/fleet/${pageId}`; }}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors"
              >
                Set up fleet
              </button>
            </div>
          )}
        </div>
      )}

      {/* Store */}
      {activeTab === "store" && (
        <div className="space-y-4">
          {pageType === "helping" ? (
            <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50 text-center text-gray-400">
              Helping initiatives don&apos;t have a store.
            </div>
          ) : storeId ? (
            <>
              {/* Store profile pic + visit link — single combined card */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-emerald-800/60 bg-emerald-900/20">
                <div
                  className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0"
                  style={{ background: "#1f2937", border: "2px solid #374151", cursor: avatarUploading ? "default" : "pointer" }}
                  onClick={() => !avatarUploading && avatarFileRef.current?.click()}
                  title="Change store profile picture"
                >
                  {storeAvatarUrl
                    ? <img src={storeAvatarUrl} alt="store avatar" className="w-full h-full object-cover" />
                    : <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🏪</span>
                  }
                  <span style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 18,
                    opacity: avatarUploading ? 1 : 0, transition: "opacity 0.15s",
                  }}
                    onMouseEnter={e => { if (!avatarUploading) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                    onMouseLeave={e => { if (!avatarUploading) (e.currentTarget as HTMLElement).style.opacity = "0"; }}
                  >
                    {avatarUploading ? "⏳" : "📷"}
                  </span>
                </div>
                <input ref={avatarFileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { handleAvatarUpload(f); e.target.value = ""; } }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-emerald-300">{storeName ?? "Your Store"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {avatarUploading ? "Uploading…" : "Click photo to change · View and manage your store"}
                  </p>
                </div>
                <a href={`/store/${storeSlug ?? storeId}`} className="text-emerald-400 text-lg flex-shrink-0">→</a>
              </div>

              {/* Taking orders toggle */}
              <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-800 bg-gray-900/50">
                <button
                  onClick={handleToggleOrders}
                  disabled={togglingOrders || storeOpen === null}
                  style={{
                    position: "relative", width: 44, height: 24, borderRadius: 12,
                    background: storeOpen ? "#22C55E" : "#4B5563",
                    border: "none", cursor: togglingOrders ? "default" : "pointer",
                    opacity: storeOpen === null ? 0.5 : 1, flexShrink: 0, transition: "background 0.2s",
                  }}
                  aria-label={storeOpen ? "Stop taking orders" : "Start taking orders"}
                >
                  <span style={{
                    position: "absolute", top: 2, left: storeOpen ? 22 : 2, width: 20, height: 20,
                    borderRadius: "50%", background: "#fff", transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }} />
                </button>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {storeOpen ? "Taking orders" : "Not taking orders"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {storeOpen ? "Customers can place orders." : "Customers can see your store but can't order yet."}
                  </p>
                </div>
              </div>

              {/* Category/tag picker (TAG-STORE-1c) */}
              {taxonomy && (
                <div className="space-y-2">
                  <StoreTaxonomyPicker
                    taxonomy={taxonomy}
                    selectedCategoryIds={selectedCategoryIds}
                    selectedTagIds={selectedTagIds}
                    onChange={({ categoryIds, tagIds }) => {
                      setSelectedCategoryIds(categoryIds);
                      setSelectedTagIds(tagIds);
                    }}
                    labels={{
                      categoriesLabel: t("store-categories-label", "Categories"),
                      categoriesPrompt: t("store-categories-prompt", "What do you sell?"),
                      tagsLabel: t("store-tags-label", "Tags"),
                      tagsPrompt: t("store-tags-prompt", "How you operate"),
                      categoriesCap: t("store-categories-cap", "Pick up to 3"),
                    }}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveTaxonomy}
                      disabled={taxonomySaveState === "saving"}
                      className="px-4 py-2 rounded-lg bg-[#534AB7] hover:bg-[#453da0] text-white text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      {taxonomySaveState === "saving"
                        ? t("store-taxonomy-saving", "Saving…")
                        : taxonomySaveState === "saved"
                        ? t("store-taxonomy-saved", "Saved ✓")
                        : t("store-taxonomy-save", "Save")}
                    </button>
                  </div>
                </div>
              )}

              {/* Missing-location nag (GEO-STORE-1) */}
              {storeLocation && storeLocation.lat == null && !editingLocation && (
                <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-amber-700/60 bg-amber-900/20">
                  <p className="text-sm text-amber-300">
                    Add your store location — needed for delivery pricing and rider navigation.
                  </p>
                  <button
                    onClick={() => setEditingLocation(true)}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors"
                  >
                    Add location
                  </button>
                </div>
              )}

              {/* Store location */}
              <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Store Location</p>
                  {!editingLocation && (
                    <button
                      onClick={() => setEditingLocation(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {storeLocation?.lat != null ? "Edit" : "Set location"}
                    </button>
                  )}
                </div>

                {editingLocation ? (
                  <StoreLocationForm
                    initialValues={storeLocation ? {
                      line1: storeLocation.line1 ?? "",
                      city: storeLocation.city ?? "",
                      state: storeLocation.state ?? "",
                      pincode: storeLocation.pincode ?? "",
                      lat: storeLocation.lat,
                      lng: storeLocation.lng,
                    } : undefined}
                    onSave={handleSaveLocation}
                    onCancel={() => setEditingLocation(false)}
                    saving={savingLocation}
                  />
                ) : storeLocation?.lat != null ? (
                  <p className="text-xs text-gray-400">
                    {storeLocation.line1}, {storeLocation.city}, {storeLocation.state} – {storeLocation.pincode}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 italic">No location set yet.</p>
                )}
              </div>

              {/* UPI payment handle (REQBCAST-1b) — display/handoff only */}
              {storeVpa !== undefined && (
                <VpaSettingCard
                  key={`vpa-${storeId}-${storeVpa ?? ""}`}
                  endpoint={`/api/store/${storeId}`}
                  initialVpa={storeVpa}
                  tone="dark"
                />
              )}
            </>
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

      {/* Team */}
      {activeTab === "team" && (
        <TeamTab pageId={pageId} canEdit={canEdit} />
      )}

      {/* Partners */}
      {activeTab === "partners" && (
        <PartnersTab pageId={pageId} ownerPages={ownerPages} />
      )}

      {/* Workflow */}
      {activeTab === "workflow" && (
        <WorkflowTab pageId={pageId} canEdit={canEdit} />
      )}
    </div>
  );
}
