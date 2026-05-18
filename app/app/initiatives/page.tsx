"use client";

import { useEffect, useState } from "react";

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
type InitiativeType = "store" | "learning" | "service" | "health" | "helping";
type CourseType = "skill" | "academic" | "art" | "growth";

function kindMeta(page: PageItem) {
  if (page.type === "health")          return { label: "Health",   color: "#059669", bg: "rgba(5,150,105,0.08)" };
  if (page.pageType === "helping")     return { label: "Helping",  color: "#0d9488", bg: "rgba(13,148,136,0.08)" };
  if (page.pageType === "learning")    return { label: "Learning", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" };
  if (page.pageType === "service")     return { label: "Service",  color: "#b45309", bg: "rgba(180,83,9,0.08)" };
  return                                      { label: "Store",    color: A.accent,  bg: "rgba(99,102,241,0.08)" };
}

function DeleteConfirmModal({
  item,
  onCancel,
  onConfirm,
  loading,
}: {
  item: PendingDelete;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 20,
          padding: "28px 24px 24px", maxWidth: 360, width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
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
          Delete initiative?
        </h2>
        <p style={{ fontSize: 14, color: A.textMuted, textAlign: "center", margin: "0 0 6px", lineHeight: 1.5 }}>
          <strong style={{ color: A.text }}>{item.name}</strong> will be permanently deleted.
        </p>
        <p style={{ fontSize: 13, color: "#EF4444", textAlign: "center", margin: "0 0 24px", lineHeight: 1.5 }}>
          All data will be lost forever. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} disabled={loading} style={{
            flex: 1, padding: "11px 0", borderRadius: 10,
            border: `1px solid ${A.border}`, background: A.surface, color: A.text,
            fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
          }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
            background: loading ? "#fca5a5" : "#EF4444", color: "#fff",
            fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {loading && <span style={{
              width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)",
              borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
              animation: "spin 0.7s linear infinite",
            }} />}
            {loading ? "Deleting..." : "Yes, delete"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const INPUT = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: `1px solid #E5E7EB`, fontSize: 13, color: "#111827",
  background: "#F9FAFB", outline: "none", boxSizing: "border-box" as const,
};

export default function InitiativesPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
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
    fetch("/api/user/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { user: null })
      .then((d) => setIsLoggedIn(!!d.user))
      .catch(() => setIsLoggedIn(false));

    fetch("/api/user/pages", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { pages: [] }))
      .then((d) => setPages(d.pages ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    setDeleting(true);
    try {
      const res = await fetch("/api/user/pages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: pending.id }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setPages((prev) => prev.filter((p) => p.id !== pending.id));
        setPending(null);
      } else {
        alert(data?.error || "Failed to delete");
      }
    } catch {
      alert("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ background: A.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
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
        Add an Initiative
      </p>

      {/* Type grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <button type="button" onClick={() => setSelectedType("health")} disabled={adding} style={{
          padding: "10px 12px", borderRadius: 10, textAlign: "left", border: "none",
          background: selectedType === "health" ? "rgba(5,150,105,0.08)" : A.bg,
          outline: selectedType === "health" ? "2px solid #059669" : `1px solid ${A.border}`,
          cursor: "pointer",
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: selectedType === "health" ? "#059669" : A.text, margin: 0 }}>Health &amp; Wellness</p>
          <p style={{ fontSize: 11, color: A.textMuted, margin: "2px 0 0" }}>Coaching, nutrition, fitness</p>
        </button>
        {([
          { value: "store",   label: "Store",              sub: "Sell products" },
          { value: "learning",label: "Learning",           sub: "Teach a skill or subject" },
          { value: "service", label: "Service",            sub: "Consulting or sessions" },
          { value: "helping", label: "Helping Initiative", sub: "Community cause, volunteering" },
        ] as { value: InitiativeType; label: string; sub: string }[]).map(({ value, label, sub }) => (
          <button key={value} type="button" onClick={() => setSelectedType(value)} disabled={adding} style={{
            padding: "10px 12px", borderRadius: 10, textAlign: "left", border: "none",
            background: selectedType === value ? "rgba(99,102,241,0.08)" : A.bg,
            outline: selectedType === value ? `2px solid ${A.accent}` : `1px solid ${A.border}`,
            cursor: "pointer",
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: selectedType === value ? A.accent : A.text, margin: 0 }}>{label}</p>
            <p style={{ fontSize: 11, color: A.textMuted, margin: "2px 0 0" }}>{sub}</p>
          </button>
        ))}
      </div>

      {/* Course type */}
      {selectedType === "learning" && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: A.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Course Type</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {([
              { value: "skill",    label: "Skill / Sport" },
              { value: "academic", label: "Academic" },
              { value: "art",      label: "Art" },
              { value: "growth",   label: "Personal Growth" },
            ] as { value: CourseType; label: string }[]).map(({ value, label }) => (
              <button key={value} type="button" onClick={() => setCourseType(value)} disabled={adding} style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 12, border: "none",
                background: courseType === value ? "rgba(99,102,241,0.1)" : A.bg,
                color: courseType === value ? A.accent : A.textMuted,
                outline: courseType === value ? `1.5px solid ${A.accent}` : `1px solid ${A.border}`,
                cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Title + description */}
      <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
        placeholder="Initiative name" disabled={adding}
        style={{ ...INPUT, marginBottom: 8 }} />
      <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
        placeholder="Description (optional)" disabled={adding} rows={3}
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
                <span style={{ fontSize: 10, color: A.textMuted, background: A.border, padding: "2px 8px", borderRadius: 20 }}>Coming soon</span>
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
        <button onClick={() => { setShowCreate(false); resetCreateForm(); }} disabled={adding} style={{
          padding: "9px 18px", borderRadius: 8, border: `1px solid ${A.border}`,
          background: A.surface, color: A.text, fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>Cancel</button>
        <button onClick={createInitiative} disabled={adding} style={{
          padding: "9px 18px", borderRadius: 8, border: "none",
          background: adding ? "#a5b4fc" : A.accent, color: "#fff",
          fontSize: 13, fontWeight: 600, cursor: adding ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {adding && <span style={{
            width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)",
            borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
            animation: "spin 0.7s linear infinite",
          }} />}
          {adding ? "Creating..." : "Create Initiative"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ background: A.bg, minHeight: "100vh" }}>
      {pending && (
        <DeleteConfirmModal
          item={pending}
          onCancel={() => !deleting && setPending(null)}
          onConfirm={confirmDelete}
          loading={deleting}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 16px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: A.text, margin: "0 0 4px" }}>
          Your Initiatives
        </h1>
        <p style={{ fontSize: 13, color: A.textMuted, margin: "0 0 20px" }}>
          Manage your initiatives and public pages
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pages.length === 0 && !showCreate && (
            <div style={{ textAlign: "center", padding: "32px 0 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🌱</div>
              <p style={{ fontSize: 14, color: A.textMuted }}>No initiatives yet.</p>
            </div>
          )}

          {pages.map((page) => {
            const meta = kindMeta(page);
            return (
              <div key={page.id} style={{
                background: A.surface, borderRadius: 14,
                border: `1px solid ${A.border}`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)", padding: "16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: A.text, flex: 1 }}>
                    {page.title}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                    color: meta.color, background: meta.bg,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>{meta.label}</span>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a href={`/earn/initiative/${page.id}`} style={{
                    flex: 1, minWidth: 80, textAlign: "center",
                    padding: "8px 12px", borderRadius: 8,
                    background: A.accent, color: "#fff",
                    fontSize: 12, fontWeight: 600, textDecoration: "none",
                  }}>Open →</a>

                  <button onClick={() => setPending({ id: page.id, name: page.title })} disabled={deleting} style={{
                    flex: 1, minWidth: 80, textAlign: "center",
                    padding: "8px 12px", borderRadius: 8,
                    background: A.surface, color: "#EF4444",
                    border: "1px solid rgba(239,68,68,0.25)",
                    fontSize: 12, fontWeight: 600,
                    cursor: deleting ? "not-allowed" : "pointer",
                    opacity: deleting ? 0.5 : 1,
                  }}>Delete</button>
                </div>
              </div>
            );
          })}

          {showCreate ? (
            isLoggedIn === false ? (
              <div style={{ textAlign: "center", padding: 32 }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#111827", marginBottom: 8 }}>
                  Sign in to create your initiative
                </p>
                <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>
                  It only takes a minute. Free forever.
                </p>
                <a href="/login?redirect=/app/initiatives"
                  style={{
                    display: "inline-block", padding: "12px 32px", borderRadius: 12,
                    background: "#6366f1", color: "#fff",
                    textDecoration: "none", fontWeight: 600, fontSize: 15,
                  }}>
                  Sign In →
                </a>
              </div>
            ) : createForm
          ) : (
            <button onClick={() => setShowCreate(true)} style={{
              display: "block", width: "100%", textAlign: "center",
              padding: "12px", borderRadius: 14,
              border: `2px dashed ${A.border}`, color: A.accent,
              fontSize: 13, fontWeight: 600, background: "none", cursor: "pointer", marginTop: 4,
            }}>
              + Add Initiative
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
