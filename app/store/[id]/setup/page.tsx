"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStoreShell } from "../StoreShellContext";

const A = {
  bg: "#F3F4F6", nav: "#131921", border: "#E5E7EB",
  text: "#111827", textMuted: "#6B7280",
  accent: "#6366f1", surface: "#FFFFFF",
};

type Product = { title: string; description: string; price: number };
type Tile = { label: string };
type Section = {
  title: string; filter: string; layout: string;
  unsplashQuery: string; imageUrl?: string;
  tiles: Tile[]; products: Product[];
};
type SetupData = { filters: string[]; sections: Section[] };

export default function StoreSetupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setShowNav } = useStoreShell();

  useEffect(() => {
    setShowNav(false);
    return () => setShowNav(true);
  }, []);

  const [step, setStep] = useState<"input" | "preview" | "applying" | "done">("input");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<SetupData | null>(null);

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
      setTimeout(() => router.push(`/store/${id}`), 1500);
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

  return (
    <div style={{ minHeight: "100vh", background: A.bg, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: A.nav, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontFamily: "monospace", fontSize: 14 }}>charaivati</span>
        <button onClick={() => router.push(`/store/${id}`)}
          style={{ color: "#9CA3AF", background: "none", border: "1px solid #374151", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>
          Skip →
        </button>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>

        {step === "input" && (
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

            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
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
            </div>

            <button
              onClick={() => router.push(`/store/${id}`)}
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
              onClick={() => router.push(`/store/${id}`)}
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
