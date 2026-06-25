"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStoreShell } from "../StoreShellContext";
import StatusMessages from "@/components/shared/StatusMessages";

const A = {
  bg: "#F3F4F6", nav: "#131921", border: "#E5E7EB",
  text: "#111827", textMuted: "#6B7280",
  accent: "#6366f1", surface: "#FFFFFF",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = { title: string; description: string; price: number };
type Tile = { label: string };
type Section = {
  title: string; filter: string; layout: string;
  unsplashQuery: string; imageUrl?: string;
  tiles: Tile[]; products: Product[];
};
type SetupData = { filters: string[]; sections: Section[] };

type ParseItem = {
  title: string;
  description: string;
  price: number;
  searchQuery: string;
};
type ParseSection = { title: string; items: ParseItem[] };
type ParseResult = {
  storeName: string | null;
  sections: ParseSection[];
  phone: string | null;
  address: string | null;
  hours: string | null;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StoreSetupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setShowNav } = useStoreShell();

  useEffect(() => {
    setShowNav(false);
    return () => setShowNav(true);
  }, []);

  function skipToStore() {
    sessionStorage.setItem(`setup_skipped_${id}`, "1");
    router.push(`/store/${id}`);
  }

  // ── Text-path state (unchanged) ──────────────────────────────────────────────
  const [step, setStep]         = useState<"input" | "preview" | "applying" | "done">("input");
  const [description, setDescription] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [data, setData]         = useState<SetupData | null>(null);

  // ── Menu image path state ────────────────────────────────────────────────────
  const menuFileRef                   = useRef<HTMLInputElement>(null);
  const warmupFiredRef                = useRef(false);
  const [menuImages, setMenuImages]     = useState<File[]>([]);
  const [menuPreviews, setMenuPreviews] = useState<string[]>([]);
  const [parsing, setParsing]         = useState(false);
  const [parseError, setParseError]   = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseFlags, setParseFlags]   = useState<string[]>([]);
  const [flagsDismissed, setFlagsDismissed] = useState(false);
  // Set of "sectionIndex-itemIndex" keys for items flagged as low-confidence at parse time
  const [lowConfKeys, setLowConfKeys] = useState<Set<string>>(new Set());
  const [expandedDescs, setExpandedDescs] = useState<Record<string, boolean>>({});
  const [applyingMenu, setApplyingMenu] = useState(false);
  const [applyError, setApplyError]   = useState("");

  // ── Text-path handlers (unchanged) ──────────────────────────────────────────

  async function handleGenerate() {
    if (!description.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/store/ai-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description, storeId: id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setData(json);
      setStep("preview");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!data) return;
    setStep("applying");
    try {
      const res = await fetch("/api/store/ai-setup/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ storeId: id, filters: data.filters, sections: data.sections }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setStep("done");
      setTimeout(() => skipToStore(), 1500);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Failed to apply");
      setStep("preview");
    }
  }

  function updateSectionTitle(si: number, title: string) {
    if (!data) return;
    const sections = [...data.sections];
    sections[si] = { ...sections[si], title };
    setData({ ...data, sections });
  }

  function updateProductTitle(si: number, pi: number, title: string) {
    if (!data) return;
    const sections = [...data.sections];
    const products = [...sections[si].products];
    products[pi] = { ...products[pi], title };
    sections[si] = { ...sections[si], products };
    setData({ ...data, sections });
  }

  function updateProductPrice(si: number, pi: number, price: string) {
    if (!data) return;
    const sections = [...data.sections];
    const products = [...sections[si].products];
    products[pi] = { ...products[pi], price: parseFloat(price) || 0 };
    sections[si] = { ...sections[si], products };
    setData({ ...data, sections });
  }

  function removeSection(si: number) {
    if (!data) return;
    setData({ ...data, sections: data.sections.filter((_, i) => i !== si) });
  }

  // ── Menu image path handlers ─────────────────────────────────────────────────

  // Downscale + re-encode client-side so 6 phone photos can't blow the
  // serverless request-body cap (Vercel ~4.5 MB) and vision inference stays fast.
  async function downscaleImage(
    file: File,
    maxEdge = 1600,
    quality = 0.8
  ): Promise<{ file: File; preview: string }> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = document.createElement("img");
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = dataUrl;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    // Already small (both dimensions and bytes) — keep as-is.
    if (scale === 1 && file.size <= 1_500_000) return { file, preview: dataUrl };

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { file, preview: dataUrl };
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) return { file, preview: dataUrl };
    const out = new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    return { file: out, preview: canvas.toDataURL("image/jpeg", quality) };
  }

  async function handleMenuImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting the same file
    if (!files.length) return;
    setParseError("");
    const room = Math.max(0, 6 - menuImages.length);
    const picked = files.slice(0, room);
    const processed = await Promise.all(picked.map((f) => downscaleImage(f).catch(() => null)));
    const ok = processed.filter((p): p is { file: File; preview: string } => p !== null);
    if (ok.length < picked.length) {
      setParseError("Some photos couldn't be read — try JPG or PNG.");
    }
    setMenuImages((prev) => [...prev, ...ok.map((o) => o.file)].slice(0, 6));
    setMenuPreviews((prev) => [...prev, ...ok.map((o) => o.preview)].slice(0, 6));
  }

  function removeMenuImage(idx: number) {
    setMenuImages((prev) => prev.filter((_, i) => i !== idx));
    setMenuPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleParseMenu() {
    if (!menuImages.length) return;
    setParsing(true);
    setParseError("");
    const fd = new FormData();
    menuImages.forEach((f) => fd.append("image", f));
    fd.append("storeId", id);
    try {
      const res = await fetch("/api/store/parse-menu", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      let json: any;
      try {
        json = await res.json();
      } catch {
        throw new Error("Image too large or server error — try a smaller photo (under 4 MB)");
      }
      if (!res.ok) throw new Error(json.error ?? "Server error — please try again");

      const parsed: ParseResult = json.parsed;
      const lci: string[] = json.lowConfidenceItems ?? [];

      // Build position-keyed set for low-confidence items (stable across title edits)
      const keys = new Set<string>();
      parsed.sections.forEach((sec, si) => {
        sec.items.forEach((item, ii) => {
          if (lci.includes(item.title)) keys.add(`${si}-${ii}`);
        });
      });

      setParseResult(parsed);
      setParseFlags(json.flags ?? []);
      setLowConfKeys(keys);
      setFlagsDismissed(false);
      setExpandedDescs({});
    } catch (e: any) {
      setParseError(
        e.message === "Failed"
          ? "Couldn't read this menu. Try a clearer photo or describe your store instead."
          : (e.message ?? "Couldn't read this menu. Try a clearer photo or describe your store instead.")
      );
    } finally {
      setParsing(false);
    }
  }

  async function handleApplyMenu() {
    if (!parseResult) return;
    setApplyingMenu(true);
    setApplyError("");
    try {
      const res = await fetch("/api/store/parse-menu/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ storeId: id, parsed: parseResult }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      skipToStore();
    } catch (e: any) {
      setApplyError(e.message ?? "Failed to create store");
      setApplyingMenu(false);
    }
  }

  function resetParse() {
    setParseResult(null);
    setParseFlags([]);
    setLowConfKeys(new Set());
    setParseError("");
    setApplyError("");
    setFlagsDismissed(false);
    setExpandedDescs({});
    setApplyingMenu(false);
  }

  // ── Parse review inline-edit helpers ────────────────────────────────────────

  function updateParseSectionTitle(si: number, title: string) {
    if (!parseResult) return;
    const sections = [...parseResult.sections];
    sections[si] = { ...sections[si], title };
    setParseResult({ ...parseResult, sections });
  }

  function updateParseItemTitle(si: number, ii: number, title: string) {
    if (!parseResult) return;
    const sections = [...parseResult.sections];
    const items = [...sections[si].items];
    items[ii] = { ...items[ii], title };
    sections[si] = { ...sections[si], items };
    setParseResult({ ...parseResult, sections });
  }

  function updateParseItemPrice(si: number, ii: number, price: string) {
    if (!parseResult) return;
    const sections = [...parseResult.sections];
    const items = [...sections[si].items];
    items[ii] = { ...items[ii], price: parseFloat(price) || 0 };
    sections[si] = { ...sections[si], items };
    setParseResult({ ...parseResult, sections });
  }

  function updateParseItemDescription(si: number, ii: number, description: string) {
    if (!parseResult) return;
    const sections = [...parseResult.sections];
    const items = [...sections[si].items];
    items[ii] = { ...items[ii], description };
    sections[si] = { ...sections[si], items };
    setParseResult({ ...parseResult, sections });
  }

  function toggleDesc(key: string) {
    setExpandedDescs(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const totalParseItems = parseResult
    ? parseResult.sections.reduce((n, s) => n + s.items.length, 0)
    : 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: A.bg, fontFamily: "system-ui, sans-serif" }}>

      {/* Top bar */}
      <div style={{ background: A.nav, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontFamily: "monospace", fontSize: 14 }}>charaivati</span>
        <button onClick={() => skipToStore()}
          style={{ color: "#9CA3AF", background: "none", border: "1px solid #374151", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
          Skip →
        </button>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>

        {/* ── INPUT STEP ─────────────────────────────────────────────────────── */}
        {step === "input" && (
          <>

            {/* Parse loading */}
            {parsing && (
              <div style={{ textAlign: "center", paddingTop: 80 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  border: "3px solid #E5E7EB", borderTopColor: A.accent,
                  margin: "0 auto 20px", animation: "spin 0.8s linear infinite",
                }} />
                <p style={{ fontSize: 16, fontWeight: 600, color: A.text, marginBottom: 8 }}>
                  Reading your menu…
                </p>
                <StatusMessages messages={[
                  "Reading your menu...",
                  "Identifying items...",
                  "Checking prices...",
                  "Almost ready...",
                ]} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            )}

            {/* Menu apply loading */}
            {!parsing && applyingMenu && (
              <div style={{ textAlign: "center", paddingTop: 80 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  border: "3px solid #E5E7EB", borderTopColor: A.accent,
                  margin: "0 auto 20px", animation: "spin 0.8s linear infinite",
                }} />
                <p style={{ fontSize: 16, fontWeight: 600, color: A.text, marginBottom: 8 }}>
                  Creating your store…
                </p>
                <StatusMessages messages={[
                  "Creating your store...",
                  "Adding products...",
                  "Finding images...",
                  "Almost done...",
                ]} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            )}

            {/* Review screen */}
            {!parsing && !applyingMenu && parseResult && (
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: A.text, margin: "0 0 4px" }}>
                  Review your menu
                </h2>
                <p style={{ fontSize: 13, color: A.textMuted, margin: "0 0 16px" }}>
                  ✓ Found {totalParseItems} item{totalParseItems !== 1 ? "s" : ""} across{" "}
                  {parseResult.sections.length} section{parseResult.sections.length !== 1 ? "s" : ""}
                </p>

                {/* Flags info box */}
                {parseFlags.length > 0 && !flagsDismissed && (
                  <div style={{
                    padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                    background: "#FFFBEB", border: "1px solid #FDE68A",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#92400E", margin: "0 0 6px" }}>
                        Some items may need review
                      </p>
                      <button
                        onClick={() => setFlagsDismissed(true)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#92400E", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>
                        ×
                      </button>
                    </div>
                    {parseFlags.map((flag, i) => (
                      <p key={i} style={{ fontSize: 12, color: "#B45309", margin: "2px 0 0" }}>• {flag}</p>
                    ))}
                  </div>
                )}

                {/* Section cards */}
                {parseResult.sections.map((section, si) => (
                  <div key={si} style={{
                    background: A.surface, borderRadius: 14,
                    border: `1px solid ${A.border}`, marginBottom: 14, overflow: "hidden",
                  }}>
                    {/* Section title */}
                    <div style={{ padding: "12px 14px 8px", borderBottom: `1px solid ${A.border}` }}>
                      <input
                        value={section.title}
                        onChange={(e) => updateParseSectionTitle(si, e.target.value)}
                        style={{
                          fontSize: 14, fontWeight: 700, color: A.text,
                          border: "none", background: "transparent",
                          width: "100%", outline: "none",
                        }}
                      />
                    </div>

                    {/* Items */}
                    <div style={{ padding: "8px 14px 12px" }}>
                      {section.items.map((item, ii) => {
                        const key = `${si}-${ii}`;
                        const isLowConf = lowConfKeys.has(key);
                        return (
                          <div key={ii} style={{
                            padding: "10px 0",
                            borderBottom: ii < section.items.length - 1 ? `1px solid ${A.border}` : "none",
                          }}>
                            {/* Title row */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                              <input
                                value={item.title}
                                onChange={(e) => updateParseItemTitle(si, ii, e.target.value)}
                                style={{
                                  flex: 1, fontSize: 13, fontWeight: 600, color: A.text,
                                  border: `1px solid ${A.border}`, borderRadius: 6,
                                  padding: "4px 8px", background: "#fff", outline: "none",
                                }}
                              />
                              {isLowConf && (
                                <span style={{
                                  fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
                                  background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A",
                                  whiteSpace: "nowrap", flexShrink: 0,
                                }}>
                                  ⚠ Verify
                                </span>
                              )}
                            </div>

                            {/* Price */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                              <span style={{ fontSize: 12, color: A.textMuted }}>₹</span>
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => updateParseItemPrice(si, ii, e.target.value)}
                                style={{
                                  fontSize: 13, fontWeight: 600, color: A.accent,
                                  border: `1px solid ${A.border}`, borderRadius: 6,
                                  padding: "3px 8px", width: 90, background: "#fff", outline: "none",
                                }}
                              />
                            </div>

                            {/* Description toggle */}
                            <button
                              onClick={() => toggleDesc(key)}
                              style={{
                                fontSize: 11, color: A.textMuted, background: "none",
                                border: "none", cursor: "pointer", padding: 0,
                                textDecoration: "underline", textDecorationStyle: "dotted",
                              }}
                            >
                              {expandedDescs[key] ? "▲ Hide description" : "▼ Description"}
                            </button>

                            {expandedDescs[key] && (
                              <textarea
                                value={item.description}
                                onChange={(e) => updateParseItemDescription(si, ii, e.target.value)}
                                rows={2}
                                style={{
                                  display: "block", width: "100%", marginTop: 6,
                                  fontSize: 12, color: A.text, lineHeight: 1.5,
                                  border: `1px solid ${A.border}`, borderRadius: 6,
                                  padding: "6px 8px", background: "#fff", outline: "none",
                                  resize: "vertical", boxSizing: "border-box",
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {applyError && (
                  <p style={{ color: "#EF4444", fontSize: 13, marginBottom: 12 }}>{applyError}</p>
                )}

                {/* Review actions */}
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  <button
                    onClick={handleApplyMenu}
                    disabled={parseResult.sections.length === 0}
                    style={{
                      flex: 1, padding: "14px", borderRadius: 12,
                      background: A.accent, color: "#fff",
                      border: "none", fontSize: 15, fontWeight: 600,
                      cursor: parseResult.sections.length === 0 ? "not-allowed" : "pointer",
                      opacity: parseResult.sections.length === 0 ? 0.5 : 1,
                    }}>
                    ✦ Create my store
                  </button>
                  <button
                    onClick={resetParse}
                    style={{
                      padding: "14px 20px", borderRadius: 12,
                      background: "#fff", color: A.textMuted,
                      border: `1px solid ${A.border}`,
                      fontSize: 14, cursor: "pointer",
                    }}>
                    ← Try again
                  </button>
                </div>
              </div>
            )}

            {/* Input form (text path + image upload) */}
            {!parsing && !applyingMenu && !parseResult && (
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: A.text, margin: "0 0 8px" }}>
                  Set up your store with AI
                </h1>
                <p style={{ fontSize: 14, color: A.textMuted, margin: "0 0 24px", lineHeight: 1.6 }}>
                  Describe what you sell in one or two sentences.
                  AI will create sections, filters, and sample
                  products for you. You can edit everything.
                </p>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. I sell handmade silver jewellery in Kolkata — rings, necklaces and earrings for daily wear and weddings"
                  rows={4}
                  style={{
                    width: "100%", padding: "12px 16px",
                    borderRadius: 12, border: `1.5px solid ${A.border}`,
                    fontSize: 15, lineHeight: 1.6, resize: "vertical",
                    outline: "none", background: "#fff",
                    color: A.text, boxSizing: "border-box",
                  }}
                />

                {error && (
                  <p style={{ color: "#EF4444", fontSize: 13, marginTop: 8 }}>{error}</p>
                )}

                {/* Primary CTA — mutually exclusive based on image selection */}
                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  {menuImages.length ? (
                    <button
                      onClick={handleParseMenu}
                      style={{
                        flex: 1, padding: "14px", borderRadius: 12,
                        background: A.accent, color: "#fff",
                        border: "none", fontSize: 15, fontWeight: 600,
                        cursor: "pointer",
                      }}>
                      ✦ Set up from {menuImages.length === 1 ? "this menu" : `${menuImages.length} photos`}
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      disabled={loading || !description.trim()}
                      style={{
                        flex: 1, padding: "14px", borderRadius: 12,
                        background: A.accent, color: "#fff",
                        border: "none", fontSize: 15, fontWeight: 600,
                        cursor: loading || !description.trim() ? "not-allowed" : "pointer",
                        opacity: loading || !description.trim() ? 0.6 : 1,
                      }}>
                      {loading ? "Setting up your store…" : "✨ Set up my store"}
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 16px" }}>
                  <div style={{ flex: 1, height: 1, background: A.border }} />
                  <span style={{ fontSize: 13, color: A.textMuted, whiteSpace: "nowrap" }}>
                    or upload your menu / price list
                  </span>
                  <div style={{ flex: 1, height: 1, background: A.border }} />
                </div>

                {/* Thumbnail previews */}
                {menuPreviews.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                      {menuPreviews.map((src, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          <img
                            src={src}
                            alt={`Menu ${i + 1}`}
                            style={{
                              height: 80, width: 80, borderRadius: 8,
                              objectFit: "cover", border: `1px solid ${A.border}`,
                            }}
                          />
                          <button
                            onClick={() => removeMenuImage(i)}
                            aria-label="Remove photo"
                            style={{
                              position: "absolute", top: -6, right: -6,
                              width: 20, height: 20, borderRadius: "50%",
                              background: "#111", color: "#fff", border: "none",
                              fontSize: 12, lineHeight: "20px", cursor: "pointer",
                            }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 12, color: A.textMuted, margin: "6px 0 0", textAlign: "center" }}>
                      {menuPreviews.length} photo{menuPreviews.length === 1 ? "" : "s"} selected{menuPreviews.length >= 6 ? " (max 6)" : ""}
                    </p>
                  </div>
                )}

                {/* Image upload inline error */}
                {parseError && (
                  <div style={{
                    padding: "10px 14px", borderRadius: 10, marginBottom: 12,
                    background: "#FEF2F2", border: "1px solid #FECACA",
                  }}>
                    <p style={{ fontSize: 13, color: "#DC2626", margin: 0, lineHeight: 1.5 }}>
                      {parseError}
                    </p>
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={menuFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleMenuImageSelect}
                />

                {/* Upload button */}
                {menuImages.length < 6 && (
                  <button
                    onClick={() => {
                      if (!warmupFiredRef.current) {
                        warmupFiredRef.current = true;
                        fetch("/api/store/warm-vision", { method: "POST", credentials: "include" }).catch(() => {});
                      }
                      menuFileRef.current?.click();
                    }}
                    style={{
                      width: "100%", padding: "12px", borderRadius: 12,
                      background: "#fff", color: A.text,
                      border: `1.5px dashed ${A.border}`,
                      fontSize: 14, cursor: "pointer", fontWeight: 500,
                    }}>
                    📷 {menuImages.length ? "Add another photo" : "Upload menu photos"}
                  </button>
                )}

                {/* Skip */}
                <button
                  onClick={() => skipToStore()}
                  style={{
                    width: "100%", padding: "12px", marginTop: 12,
                    borderRadius: 12, background: "transparent",
                    color: A.textMuted, border: `1px solid ${A.border}`,
                    fontSize: 14, cursor: "pointer",
                  }}>
                  Skip — I'll set up myself
                </button>
              </div>
            )}
          </>
        )}

        {/* ── PREVIEW STEP (text path — unchanged) ──────────────────────────── */}
        {step === "preview" && data && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: A.text, margin: "0 0 4px" }}>
              Here's your store structure
            </h2>
            <p style={{ fontSize: 13, color: A.textMuted, margin: "0 0 20px" }}>
              Edit anything inline. Remove sections you don't need.
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              {data.filters.map((f, i) => (
                <span key={i} style={{
                  padding: "4px 12px", borderRadius: 20,
                  background: i === 0 ? A.accent : "#fff",
                  color: i === 0 ? "#fff" : A.textMuted,
                  border: `1px solid ${i === 0 ? A.accent : A.border}`,
                  fontSize: 13,
                }}>
                  {f}
                </span>
              ))}
            </div>

            {data.sections.map((section, si) => (
              <div key={si} style={{
                background: A.surface, borderRadius: 16,
                border: `1px solid ${A.border}`,
                marginBottom: 16, overflow: "hidden",
              }}>
                {section.imageUrl && (
                  <div style={{ position: "relative", height: 100 }}>
                    <img src={section.imageUrl} alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "rgba(0,0,0,0.35)",
                      display: "flex", alignItems: "center",
                      padding: "0 16px",
                    }}>
                      <input
                        value={section.title}
                        onChange={(e) => updateSectionTitle(si, e.target.value)}
                        style={{
                          background: "transparent", border: "none",
                          color: "#fff", fontSize: 16, fontWeight: 700,
                          outline: "none", width: "100%",
                        }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ padding: 16 }}>
                  {!section.imageUrl && (
                    <input
                      value={section.title}
                      onChange={(e) => updateSectionTitle(si, e.target.value)}
                      style={{
                        fontSize: 15, fontWeight: 600, color: A.text,
                        border: `1px solid ${A.border}`, borderRadius: 8,
                        padding: "6px 10px", width: "100%",
                        outline: "none", marginBottom: 12,
                        boxSizing: "border-box",
                      }}
                    />
                  )}

                  {section.tiles.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      {section.tiles.map((tile, ti) => (
                        <span key={ti} style={{
                          padding: "4px 10px", borderRadius: 8,
                          background: "#F3F4F6", color: A.textMuted,
                          fontSize: 12, border: `1px solid ${A.border}`,
                        }}>
                          {tile.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {section.products.map((product, pi) => (
                      <div key={pi} style={{
                        border: `1px solid ${A.border}`,
                        borderRadius: 10, padding: 10,
                        background: "#FAFAFA",
                      }}>
                        <input
                          value={product.title}
                          onChange={(e) => updateProductTitle(si, pi, e.target.value)}
                          style={{
                            fontSize: 13, fontWeight: 600,
                            color: A.text, border: "none",
                            background: "transparent", width: "100%",
                            outline: "none", marginBottom: 4,
                          }}
                        />
                        <p style={{ fontSize: 11, color: A.textMuted, margin: "0 0 6px", lineHeight: 1.4 }}>
                          {product.description}
                        </p>
                        <input
                          value={product.price}
                          onChange={(e) => updateProductPrice(si, pi, e.target.value)}
                          type="number"
                          style={{
                            fontSize: 13, fontWeight: 600,
                            color: A.accent, border: `1px solid ${A.border}`,
                            borderRadius: 6, padding: "2px 6px",
                            background: "#fff", width: 80,
                            outline: "none",
                          }}
                        />
                        <span style={{ fontSize: 11, color: A.textMuted }}> ₹</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => removeSection(si)}
                    style={{
                      marginTop: 12, fontSize: 12,
                      color: "#EF4444", background: "none",
                      border: "none", cursor: "pointer", padding: 0,
                    }}>
                    Remove this section
                  </button>
                </div>
              </div>
            ))}

            {error && (
              <p style={{ color: "#EF4444", fontSize: 13, marginBottom: 12 }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={handleApply}
                disabled={data.sections.length === 0}
                style={{
                  flex: 1, padding: "14px", borderRadius: 12,
                  background: A.accent, color: "#fff",
                  border: "none", fontSize: 15, fontWeight: 600,
                  cursor: data.sections.length === 0 ? "not-allowed" : "pointer",
                  opacity: data.sections.length === 0 ? 0.5 : 1,
                }}>
                Create my store →
              </button>
              <button onClick={() => setStep("input")}
                style={{
                  padding: "14px 20px", borderRadius: 12,
                  background: "#fff", color: A.textMuted,
                  border: `1px solid ${A.border}`,
                  fontSize: 14, cursor: "pointer",
                }}>
                ← Redo
              </button>
            </div>

            <button
              onClick={() => skipToStore()}
              style={{
                width: "100%", padding: "12px", marginTop: 12,
                borderRadius: 12, background: "transparent",
                color: A.textMuted, border: `1px solid ${A.border}`,
                fontSize: 14, cursor: "pointer",
              }}>
              Skip — go to my store
            </button>
          </div>
        )}

        {/* ── APPLYING STEP (text path — unchanged) ─────────────────────────── */}
        {step === "applying" && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              border: "3px solid #E5E7EB",
              borderTopColor: A.accent,
              margin: "0 auto 20px",
              animation: "spin 0.8s linear infinite",
            }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: A.text }}>
              Building your store…
            </p>
            <p style={{ fontSize: 13, color: A.textMuted, marginTop: 8 }}>
              Creating sections, filters and products
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ── DONE STEP (unchanged) ─────────────────────────────────────────── */}
        {step === "done" && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✓</div>
            <p style={{ fontSize: 18, fontWeight: 700, color: A.text }}>
              Your store is ready!
            </p>
            <p style={{ fontSize: 13, color: A.textMuted, marginTop: 8 }}>
              Redirecting to your store…
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
