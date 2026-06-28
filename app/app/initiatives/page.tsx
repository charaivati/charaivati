"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "@/hooks/useTranslations";
import { kindLabel } from "@/lib/pages/kindLabel";

const InitiativePostsBlock = dynamic(
  () => import("@/components/initiative/InitiativePostsBlock"),
  { ssr: false }
);

const INITIATIVES_SLUGS = [
  "app-initiatives-heading","app-initiatives-subtitle","app-initiatives-empty","app-initiatives-add-btn",
  "app-initiatives-open","app-initiatives-delete","app-initiatives-deleting",
  "app-initiatives-delete-title","app-initiatives-delete-warning",
  "app-initiatives-cancel","app-initiatives-confirm-delete",
  "app-initiatives-form-title",
  "app-initiatives-type-health","app-initiatives-type-health-sub",
  "app-initiatives-type-store","app-initiatives-type-store-sub",
  "app-initiatives-type-learning","app-initiatives-type-learning-sub",
  "app-initiatives-type-service","app-initiatives-type-service-sub",
  "app-initiatives-type-helping","app-initiatives-type-helping-sub",
  "app-initiatives-course-type",
  "app-initiatives-course-skill","app-initiatives-course-academic",
  "app-initiatives-course-art","app-initiatives-course-growth",
  "app-initiatives-name-placeholder","app-initiatives-desc-placeholder",
  "app-initiatives-create-btn","app-initiatives-creating",
  "app-initiatives-coming-soon",
  "app-initiatives-sign-in-title","app-initiatives-sign-in-sub","app-initiatives-sign-in-btn",
  "app-initiatives-kind-health","app-initiatives-kind-helping",
  "app-initiatives-kind-learning","app-initiatives-kind-service","app-initiatives-kind-store",
  "app-initiatives-type-community","app-initiatives-type-community-sub",
  "app-initiatives-kind-community",
].join(",");

const A = {
  bg: "#F3F4F6",
  border: "#E5E7EB",
  text: "#111827",
  textMuted: "#6B7280",
  accent: "#6366f1",
  surface: "#FFFFFF",
};

type PageItem = {
  id: string;
  title: string;
  description?: string | null;
  pageType?: string | null;
  type?: string | null;
  createdAt: string;
};

type PendingDelete = { id: string; name: string };
type InitiativeType = "store" | "learning" | "service" | "health" | "helping" | "community_group" | "fleet";
type CourseType = "skill" | "academic" | "art" | "growth";

// To re-enable a type, just add its key to this array — nothing else needs to change.
const ACTIVE_INITIATIVE_TYPES: InitiativeType[] = ["store", "service", "fleet", "community_group"];

function InitiativeCardSkeleton() {
  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      border: "0.5px solid #e2e8f0",
      padding: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse flex-shrink-0" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h-4 bg-gray-200 rounded animate-pulse mb-1.5" style={{ width: "65%" }} />
          <div className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: "40%" }} />
        </div>
        <div className="h-5 w-14 bg-gray-200 rounded-full animate-pulse flex-shrink-0" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div className="h-8 bg-gray-200 rounded-lg animate-pulse flex-1" />
        <div className="h-8 bg-gray-200 rounded-lg animate-pulse flex-1" />
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  item,
  onCancel,
  onConfirm,
  loading,
  t,
}: {
  item: PendingDelete;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  t: (slug: string, fallback: string) => string;
}) {
  return (
    <div
      onClick={loading ? undefined : onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 20px",
        pointerEvents: loading ? "none" : "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 20,
          padding: "28px 24px 24px", maxWidth: 360, width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          pointerEvents: "auto",
        }}
      >
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "rgba(239,68,68,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 11v6M14 11v6" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: A.text, textAlign: "center", margin: "0 0 8px" }}>
          {t("app-initiatives-delete-title", "Delete initiative?")}
        </h2>
        <p style={{ fontSize: 14, color: A.textMuted, textAlign: "center", margin: "0 0 6px", lineHeight: 1.5 }}>
          <strong style={{ color: A.text }}>{item.name}</strong> will be permanently deleted.
        </p>
        <p style={{ fontSize: 13, color: "#EF4444", textAlign: "center", margin: "0 0 24px", lineHeight: 1.5 }}>
          {t("app-initiatives-delete-warning", "All data will be lost forever. This cannot be undone.")}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 10,
              border: `1px solid ${A.border}`, background: A.surface, color: A.text,
              fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {t("app-initiatives-cancel", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
              background: loading ? "#fca5a5" : "#EF4444", color: "#fff",
              fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "background 0.15s",
            }}
          >
            {loading && (
              <span style={{
                width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)",
                borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                animation: "spin 0.7s linear infinite", flexShrink: 0,
              }} />
            )}
            {loading ? t("app-initiatives-deleting", "Deleting...") : t("app-initiatives-confirm-delete", "Yes, delete")}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 20,
          padding: "28px 24px 24px", maxWidth: 320, width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          textAlign: "center",
        }}
      >
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: "#FEF3C7",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: 26,
        }}>🚧</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: A.text, margin: "0 0 8px" }}>
          Coming Soon
        </h2>
        <p style={{ fontSize: 14, color: A.textMuted, margin: "0 0 24px", lineHeight: 1.5 }}>
          This initiative type is under development. Check back soon.
        </p>
        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 10,
            border: "none", background: "#F59E0B", color: "#fff",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

const INPUT = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1px solid #E5E7EB`, fontSize: 13, color: "#111827",
  background: "#F9FAFB", outline: "none", boxSizing: "border-box" as const,
};

export default function InitiativesPage() {
  const t = useTranslations(INITIATIVES_SLUGS);

  function kindMeta(page: PageItem) {
    if (page.type === "health")                  return { label: t("app-initiatives-kind-health",     "Health"),          color: "#7B5EA7", bg: "#F0EDF8" };
    if (page.pageType === "helping")             return { label: t("app-initiatives-kind-helping",    "Helping"),         color: "#0F6E56", bg: "#E1F5EE" };
    if (page.pageType === "learning")            return { label: t("app-initiatives-kind-learning",   "Learning"),        color: "#185FA5", bg: "#EBF2FA" };
    if (page.pageType === "service")             return { label: t("app-initiatives-kind-service",    "Service"),         color: "#7B5EA7", bg: "#F0EDF8" };
    if (page.pageType === "community_group")     return { label: t("app-initiatives-kind-community",  "Community Group"), color: "#0369A1", bg: "#E0F2FE" };
    if (page.pageType === "fleet")               return { label: "Fleet",                                                  color: "#B45309", bg: "#FEF3C7" };
    return                                              { label: t("app-initiatives-kind-store",      "Store"),           color: "#D85A30", bg: "#FDF0EB" };
  }

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  // per-card delete tracking — null means no deletion in flight
  const [deletingId, setDeletingId] = useState<string | null>(null);

  type RevokableTransfer = {
    id: string; pageId: string; toEmail: string;
    completedAt: string; revokeDeadline: string;
    page: { title: string; pageType: string } | null;
  };
  const [revokable,   setRevokable]   = useState<RevokableTransfer[]>([]);
  const [revokingId,  setRevokingId]  = useState<string | null>(null);

  // post composer initiative selector
  const [selectedPageId, setSelectedPageId] = useState<string>("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [selectedType, setSelectedType] = useState<InitiativeType>("store");
  const [courseType, setCourseType] = useState<CourseType>("skill");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Health sub-form
  const [hbSpecialty, setHbSpecialty] = useState("");
  const [hbCredentials, setHbCredentials] = useState("");
  const [hbTagsInput, setHbTagsInput] = useState("");
  const [hbTiers, setHbTiers] = useState([{ name: "", price: "", description: "" }]);

  useEffect(() => {
    console.log("selectedPageId:", selectedPageId, "| pages passed to block:", pages.length);
    if (pages.length > 0 && !selectedPageId) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages, selectedPageId]);

  useEffect(() => {
    fetch("/api/user/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { user: null })
      .then((d) => setIsLoggedIn(!!d.user))
      .catch(() => setIsLoggedIn(false));

    fetch("/api/user/pages", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { pages: [] }))
      .then((d) => {
        const loaded = d.pages ?? [];
        console.log("pages loaded:", loaded.length, loaded.map((p: any) => p.title));
        setPages(loaded);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch("/api/initiative/transfer", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { transfers: [] })
      .then((d) => setRevokable(d.transfers ?? []))
      .catch(() => {});
  }, []);

  async function handleRevoke(pageId: string, transferId: string) {
    if (revokingId) return;
    setRevokingId(transferId);
    try {
      const res = await fetch(`/api/initiative/${pageId}/transfer/revoke`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) setRevokable((prev) => prev.filter((t) => t.id !== transferId));
    } finally { setRevokingId(null); }
  }

  function resetCreateForm() {
    setNewTitle(""); setNewDesc(""); setSelectedType("store"); setCourseType("skill");
    setHbSpecialty(""); setHbCredentials(""); setHbTagsInput("");
    setHbTiers([{ name: "", price: "", description: "" }]);
    setCreateError(null);
  }

  async function createInitiative() {
    const title = newTitle.trim();
    if (!title) { setCreateError("Please enter a name"); return; }
    if (selectedType === "health" && !hbSpecialty) { setCreateError("Please select a specialty"); return; }

    setAdding(true); setCreateError(null);
    try {
      const pageType = selectedType === "health" ? "store"
        : selectedType === "helping" ? "helping"
        : selectedType;
      const type = selectedType === "health" ? "health" : "standard";

      const pageRes = await fetch("/api/user/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, description: newDesc.trim() || undefined, type, pageType }),
      });
      const pageData = await pageRes.json().catch(() => ({}));
      if (!pageRes.ok || !pageData.ok) throw new Error(pageData.error || "Failed to create page");
      const created: PageItem = pageData.page;

      if (selectedType === "learning") {
        await fetch("/api/course", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ pageId: created.id, courseType }),
        });
      }

      if (selectedType === "health") {
        const tagSet = new Set(hbTagsInput.split(",").map((t) => t.trim()).filter(Boolean));
        tagSet.add(hbSpecialty);
        await fetch("/api/health-business/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            pageId: created.id,
            specialty: hbSpecialty,
            credentials: hbCredentials.trim() || null,
            consultationMode: "manual",
            searchTags: Array.from(tagSet),
            tiers: hbTiers.filter((t) => t.name.trim()),
          }),
        });
      }

      if (selectedType === "helping") {
        await fetch("/api/helping-initiative", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ pageId: created.id }),
        });
      }

      if (selectedType === "community_group") {
        await fetch("/api/community-group", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ pageId: created.id }),
        });
      }

      setPages((prev) => [created, ...prev]);
      resetCreateForm();
      setShowCreate(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create initiative");
    } finally {
      setAdding(false);
    }
  }

  async function confirmDelete() {
    if (!pending) return;
    const targetId = pending.id;
    setDeletingId(targetId);
    try {
      const res = await fetch("/api/user/pages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: targetId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setPages((prev) => prev.filter((p) => p.id !== targetId));
        setPending(null);
      } else {
        alert(data?.error || "Failed to delete");
      }
    } catch {
      alert("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  /* ── Create form ── */
  const createForm = (
    <div style={{
      background: A.surface, borderRadius: 14,
      border: `1px solid ${A.accent}`,
      boxShadow: "0 2px 12px rgba(99,102,241,0.08)",
      padding: "18px 16px 16px",
    }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: A.text, margin: "0 0 14px" }}>
        {t("app-initiatives-form-title", "Add an Initiative")}
      </p>

      {/* Type grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <button type="button" onClick={() => ACTIVE_INITIATIVE_TYPES.includes("health") ? setSelectedType("health") : setShowComingSoon(true)} disabled={adding} style={{
          position: "relative", padding: "10px 12px", borderRadius: 10, textAlign: "left", border: "none",
          background: selectedType === "health" ? "rgba(5,150,105,0.08)" : A.bg,
          outline: selectedType === "health" ? "2px solid #059669" : `1px solid ${A.border}`,
          cursor: "pointer",
        }}>
          {!ACTIVE_INITIATIVE_TYPES.includes("health") && (
            <span style={{
              position: "absolute", top: 5, right: 6,
              fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20,
              background: "#FEF3C7", color: "#92400E", letterSpacing: "0.04em",
            }}>Soon</span>
          )}
          <p style={{ fontSize: 12, fontWeight: 700, color: selectedType === "health" ? "#059669" : A.text, margin: 0 }}>
            {t("app-initiatives-type-health", "Health & Wellness")}
          </p>
          <p style={{ fontSize: 11, color: A.textMuted, margin: "2px 0 0" }}>
            {t("app-initiatives-type-health-sub", "Coaching, nutrition, fitness")}
          </p>
        </button>
        {([
          { value: "store",           slugL: "app-initiatives-type-store",     fallbackL: "Store",              slugS: "app-initiatives-type-store-sub",    fallbackS: "Sell products" },
          { value: "learning",        slugL: "app-initiatives-type-learning",  fallbackL: "Learning",           slugS: "app-initiatives-type-learning-sub", fallbackS: "Teach a skill or subject" },
          { value: "service",         slugL: "app-initiatives-type-service",   fallbackL: "Service",            slugS: "app-initiatives-type-service-sub",  fallbackS: "Consulting or sessions" },
          { value: "helping",         slugL: "app-initiatives-type-helping",   fallbackL: "Helping Initiative", slugS: "app-initiatives-type-helping-sub",  fallbackS: "Community cause, volunteering" },
          { value: "community_group", slugL: "app-initiatives-type-community", fallbackL: "Community Group",    slugS: "app-initiatives-type-community-sub", fallbackS: "Organize a community, manage branches and members" },
          { value: "fleet",           slugL: "app-initiatives-type-fleet",     fallbackL: "🚛 Fleet",           slugS: "app-initiatives-type-fleet-sub",    fallbackS: "Delivery, cab, bike rental, fleet services" },
        ] as { value: InitiativeType; slugL: string; fallbackL: string; slugS: string; fallbackS: string }[]).map(({ value, slugL, fallbackL, slugS, fallbackS }) => (
          <button key={value} type="button" onClick={() => ACTIVE_INITIATIVE_TYPES.includes(value) ? setSelectedType(value) : setShowComingSoon(true)} disabled={adding} style={{
            position: "relative", padding: "10px 12px", borderRadius: 10, textAlign: "left", border: "none",
            background: selectedType === value ? "rgba(99,102,241,0.08)" : A.bg,
            outline: selectedType === value ? `2px solid ${A.accent}` : `1px solid ${A.border}`,
            cursor: "pointer",
          }}>
            {!ACTIVE_INITIATIVE_TYPES.includes(value) && (
              <span style={{
                position: "absolute", top: 5, right: 6,
                fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 20,
                background: "#FEF3C7", color: "#92400E", letterSpacing: "0.04em",
              }}>Soon</span>
            )}
            <p style={{ fontSize: 12, fontWeight: 700, color: selectedType === value ? A.accent : A.text, margin: 0 }}>{t(slugL, fallbackL)}</p>
            <p style={{ fontSize: 11, color: A.textMuted, margin: "2px 0 0" }}>{t(slugS, fallbackS)}</p>
          </button>
        ))}
      </div>

      {/* Course type */}
      {selectedType === "learning" && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: A.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
            {t("app-initiatives-course-type", "Course Type")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {([
              { value: "skill",    slug: "app-initiatives-course-skill",    fallback: "Skill / Sport" },
              { value: "academic", slug: "app-initiatives-course-academic", fallback: "Academic" },
              { value: "art",      slug: "app-initiatives-course-art",      fallback: "Art" },
              { value: "growth",   slug: "app-initiatives-course-growth",   fallback: "Personal Growth" },
            ] as { value: CourseType; slug: string; fallback: string }[]).map(({ value, slug, fallback }) => (
              <button key={value} type="button" onClick={() => setCourseType(value)} disabled={adding} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, border: "none",
                background: courseType === value ? "rgba(99,102,241,0.1)" : A.bg,
                color: courseType === value ? A.accent : A.textMuted,
                outline: courseType === value ? `1.5px solid ${A.accent}` : `1px solid ${A.border}`,
                cursor: "pointer",
              }}>{t(slug, fallback)}</button>
            ))}
          </div>
        </div>
      )}

      {/* Title + description */}
      <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
        placeholder={t("app-initiatives-name-placeholder", "Initiative name")} disabled={adding}
        style={{ ...INPUT, marginBottom: 8 }} />
      <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
        placeholder={t("app-initiatives-desc-placeholder", "Description (optional)")} disabled={adding} rows={3}
        style={{ ...INPUT, resize: "none", marginBottom: 12 }} />

      {/* Health sub-form */}
      {selectedType === "health" && (
        <div style={{
          padding: "14px", borderRadius: 10, marginBottom: 12,
          border: "1px solid rgba(5,150,105,0.25)", background: "rgba(5,150,105,0.03)",
        }}>
          {/* Specialty */}
          <p style={{ fontSize: 11, fontWeight: 700, color: A.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Specialty *</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {(["nutrition","fitness","sleep","mental","holistic"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setHbSpecialty(s)} disabled={adding} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, border: "none", textTransform: "capitalize",
                background: hbSpecialty === s ? "rgba(5,150,105,0.12)" : A.bg,
                color: hbSpecialty === s ? "#059669" : A.textMuted,
                outline: hbSpecialty === s ? "1.5px solid #059669" : `1px solid ${A.border}`,
                cursor: "pointer",
              }}>{s}</button>
            ))}
          </div>

          {/* Credentials */}
          <p style={{ fontSize: 11, fontWeight: 700, color: A.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>Credentials</p>
          <textarea value={hbCredentials} onChange={(e) => setHbCredentials(e.target.value)}
            placeholder="e.g. MSc Nutrition, 8 years experience..." disabled={adding} rows={2}
            style={{ ...INPUT, resize: "none", marginBottom: 12 }} />

          {/* Consultation mode */}
          <p style={{ fontSize: 11, fontWeight: 700, color: A.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>Consultation Mode</p>
          <div style={{ marginBottom: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 8, border: "1.5px solid #059669", background: "rgba(5,150,105,0.05)", marginBottom: 6,
            }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669" }} />
              </span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: A.text, margin: 0 }}>Manual</p>
                <p style={{ fontSize: 11, color: A.textMuted, margin: 0 }}>I&apos;ll respond personally</p>
              </div>
            </div>
            {[{ key: "rules", label: "Rules", sub: "Set automated protocols" }, { key: "agent", label: "Agent", sub: "AI trained on my advice" }].map(({ key, label, sub }) => (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 8, border: `1px solid ${A.border}`, background: A.bg,
                opacity: 0.5, marginBottom: 6,
              }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${A.border}`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: A.textMuted, margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 11, color: A.textMuted, margin: 0 }}>{sub}</p>
                </div>
                <span style={{ fontSize: 10, color: A.textMuted, background: A.border, padding: "2px 8px", borderRadius: 20 }}>{t("app-initiatives-coming-soon", "Coming soon")}</span>
              </div>
            ))}
          </div>

          {/* Search tags */}
          <p style={{ fontSize: 11, fontWeight: 700, color: A.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>Search Tags</p>
          <input value={hbTagsInput} onChange={(e) => setHbTagsInput(e.target.value)}
            placeholder="e.g. weight-loss, cortisol (comma separated)" disabled={adding}
            style={{ ...INPUT, marginBottom: 4 }} />
          <p style={{ fontSize: 11, color: A.textMuted, margin: "0 0 12px" }}>Specialty is auto-included.</p>

          {/* Tiers */}
          <p style={{ fontSize: 11, fontWeight: 700, color: A.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Subscription Tiers</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {hbTiers.map((tier, i) => (
              <div key={i} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${A.border}`, background: A.bg }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <input value={tier.name}
                    onChange={(e) => { const n = [...hbTiers]; n[i] = { ...n[i], name: e.target.value }; setHbTiers(n); }}
                    placeholder="Tier name (e.g. Basic)" disabled={adding}
                    style={{ ...INPUT, flex: 1 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 12, color: A.textMuted }}>₹</span>
                    <input value={tier.price}
                      onChange={(e) => { const n = [...hbTiers]; n[i] = { ...n[i], price: e.target.value }; setHbTiers(n); }}
                      placeholder="0/mo" disabled={adding}
                      style={{ ...INPUT, width: 72 }} />
                  </div>
                  {hbTiers.length > 1 && (
                    <button type="button" onClick={() => setHbTiers((p) => p.filter((_, idx) => idx !== i))} disabled={adding}
                      style={{ background: "none", border: "none", color: A.textMuted, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>✕</button>
                  )}
                </div>
                <input value={tier.description}
                  onChange={(e) => { const n = [...hbTiers]; n[i] = { ...n[i], description: e.target.value }; setHbTiers(n); }}
                  placeholder="What&apos;s included..." disabled={adding}
                  style={INPUT} />
              </div>
            ))}
          </div>
          {hbTiers.length < 3 && (
            <button type="button" onClick={() => setHbTiers((p) => [...p, { name: "", price: "", description: "" }])} disabled={adding}
              style={{ marginTop: 8, fontSize: 12, color: "#059669", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              + Add tier
            </button>
          )}
        </div>
      )}

      {createError && <p style={{ fontSize: 12, color: "#EF4444", margin: "0 0 10px" }}>{createError}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={() => { setShowCreate(false); resetCreateForm(); }}
          disabled={adding}
          style={{
            padding: "9px 18px", borderRadius: 8, border: `1px solid ${A.border}`,
            background: A.surface, color: A.text, fontSize: 13, fontWeight: 600,
            cursor: adding ? "not-allowed" : "pointer",
            opacity: adding ? 0.5 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {t("app-initiatives-cancel", "Cancel")}
        </button>
        <button
          onClick={createInitiative}
          disabled={adding}
          style={{
            padding: "9px 18px", borderRadius: 8, border: "none",
            background: adding ? "#a5b4fc" : A.accent, color: "#fff",
            fontSize: 13, fontWeight: 600,
            cursor: adding ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 6,
            transition: "background 0.15s",
          }}
        >
          {adding && (
            <span style={{
              width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)",
              borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
              animation: "spin 0.7s linear infinite", flexShrink: 0,
            }} />
          )}
          {adding ? t("app-initiatives-creating", "Creating...") : t("app-initiatives-create-btn", "Create Initiative")}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 80 }}>
      {pending && (
        <DeleteConfirmModal
          item={pending}
          onCancel={() => !deletingId && setPending(null)}
          onConfirm={confirmDelete}
          loading={deletingId !== null}
          t={t}
        />
      )}
      {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(false)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%", padding: "0 0 8px" }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: "#111827", margin: 0, padding: "16px 16px 4px" }}>
          {t("app-initiatives-heading", "Your Initiatives")}
        </h1>
        <p style={{ fontSize: 13, color: "#64748B", margin: 0, padding: "0 16px 16px" }}>
          {t("app-initiatives-subtitle", "Manage your initiatives and public pages")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px" }}>
          {loading ? (
            <>
              <InitiativeCardSkeleton />
              <InitiativeCardSkeleton />
              <InitiativeCardSkeleton />
            </>
          ) : (
            <>
              {pages.length === 0 && !showCreate && (
                <div style={{ textAlign: "center", padding: "32px 0 20px" }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🌱</div>
                  <p style={{ fontSize: 14, color: A.textMuted }}>{t("app-initiatives-empty", "No initiatives yet.")}</p>
                </div>
              )}

              {pages.map((page) => {
                const meta = kindMeta(page);
                const isBeingDeleted = deletingId === page.id;
                return (
                  <div key={page.id} style={{
                    background: "#fff", borderRadius: 12,
                    border: "0.5px solid #e2e8f0",
                    padding: "14px 14px 12px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: A.text, flex: 1 }}>
                        {page.title}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                        color: meta.color, background: meta.bg,
                        textTransform: "uppercase", letterSpacing: "0.08em",
                      }}>{meta.label}</span>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a href={`/earn/initiative/${page.id}`} style={{
                        flex: 1, minWidth: 80, textAlign: "center",
                        padding: "8px 16px", borderRadius: 8,
                        background: "#D85A30", color: "#fff",
                        fontSize: 13, fontWeight: 500, textDecoration: "none",
                        border: "none",
                      }}>{t("app-initiatives-open", "Open →")}</a>

                      <button
                        onClick={() => setPending({ id: page.id, name: page.title })}
                        disabled={deletingId !== null}
                        style={{
                          flex: 1, minWidth: 80, textAlign: "center",
                          padding: "8px 12px", borderRadius: 8,
                          background: "none", color: "#DC2626",
                          border: "none",
                          fontSize: 13, fontWeight: 500,
                          cursor: deletingId !== null ? "not-allowed" : "pointer",
                          opacity: isBeingDeleted ? 0.5 : deletingId !== null ? 0.4 : 1,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          transition: "opacity 0.15s",
                        }}
                      >
                        {isBeingDeleted && (
                          <span style={{
                            width: 11, height: 11,
                            border: "2px solid rgba(239,68,68,0.3)",
                            borderTopColor: "#EF4444",
                            borderRadius: "50%", display: "inline-block",
                            animation: "spin 0.7s linear infinite", flexShrink: 0,
                          }} />
                        )}
                        {isBeingDeleted ? t("app-initiatives-deleting", "Deleting") : t("app-initiatives-delete", "Delete")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Recently Transferred — show for 7 days after transfer, with revoke button */}
          {revokable.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8, paddingLeft: 2 }}>
                Recently Transferred
              </p>
              {revokable.map((t) => (
                <div key={t.id} style={{
                  background: "#fff", borderRadius: 12,
                  border: "0.5px solid #e2e8f0", padding: "12px 14px",
                  marginBottom: 8, opacity: 0.75,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#374151", flex: 1 }}>
                      {t.page?.title ?? "Initiative"}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                      color: "#6B7280", background: "#F3F4F6",
                      textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>Transferred</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 10px" }}>
                    To {t.toEmail} · Revoke before {new Date(t.revokeDeadline).toLocaleDateString()}
                  </p>
                  <button
                    onClick={() => handleRevoke(t.pageId, t.id)}
                    disabled={revokingId !== null}
                    style={{
                      width: "100%", padding: "8px", borderRadius: 8,
                      border: "1px solid #FCA5A5", background: "none", color: "#DC2626",
                      fontSize: 13, fontWeight: 500,
                      cursor: revokingId !== null ? "not-allowed" : "pointer",
                      opacity: revokingId === t.id ? 0.5 : revokingId !== null ? 0.4 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      transition: "opacity 0.15s",
                    }}
                  >
                    {revokingId === t.id && (
                      <span style={{
                        width: 11, height: 11,
                        border: "2px solid rgba(239,68,68,0.3)",
                        borderTopColor: "#EF4444",
                        borderRadius: "50%", display: "inline-block",
                        animation: "spin 0.7s linear infinite", flexShrink: 0,
                      }} />
                    )}
                    {revokingId === t.id ? "Revoking…" : "Revoke Transfer"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && (
            showCreate ? (
              isLoggedIn === false ? (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <p style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 8 }}>
                    {t("app-initiatives-sign-in-title", "Sign in to create your initiative")}
                  </p>
                  <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>
                    {t("app-initiatives-sign-in-sub", "It only takes a minute. Free forever.")}
                  </p>
                  <a href="/login?redirect=/app/initiatives"
                    style={{
                      display: "inline-block", padding: "12px 32px", borderRadius: 12,
                      background: "#6366f1", color: "#fff",
                      textDecoration: "none", fontWeight: 600, fontSize: 15,
                    }}>
                    {t("app-initiatives-sign-in-btn", "Sign In →")}
                  </a>
                </div>
              ) : createForm
            ) : (
              <>
                <button onClick={() => setShowCreate(true)} style={{
                  display: "block", width: "100%", textAlign: "center",
                  padding: "12px", borderRadius: 12,
                  border: "2px dashed #e2e8f0", color: "#D85A30",
                  fontSize: 13, fontWeight: 600, background: "none", cursor: "pointer", marginTop: 4,
                }}>
                  {t("app-initiatives-add-btn", "+ Add Initiative")}
                </button>

                {pages.length > 0 && (
                  <>
                    <div style={{ borderTop: "0.5px solid #e2e8f0", margin: "4px 0 0" }} />
                    <InitiativePostsBlock
                      key={selectedPageId}
                      pageId={selectedPageId}
                      isCreator={true}
                      theme="light"
                      accentColor="#534AB7"
                      showFeedBelow={false}
                      pages={pages.map((p) => ({ id: p.id, title: p.title }))}
                      onPageChange={(id) => setSelectedPageId(id)}
                    />
                  </>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
