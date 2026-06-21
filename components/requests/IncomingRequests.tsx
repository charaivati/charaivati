"use client";

// REQBCAST-1f — provider-side "Incoming" broadcast feed. Single source of truth:
// imported by Orders → Requests (provider surface). Requester side stays in
// app/app/requests/page.tsx ("My requests"). Moved verbatim from there.
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useTranslations } from "@/hooks/useTranslations";

const SLUGS =
  "requests-tab-incoming,requests-empty-incoming,requests-responses-label,requests-quote-placeholder," +
  "requests-message-placeholder,requests-respond,requests-resp-sent,requests-resp-accepted," +
  "requests-resp-rejected,requests-suggested-price-label,requests-suggested-price-help";

const A = { border: "#E5E7EB", text: "#111827", muted: "#6B7280", accent: "#6366f1", surface: "#fff" };

type Incoming = { id: string; kind: string; requesterName: string | null; categoryTitle: string; title: string; description: string | null; radiusKm: number; storeId: string; storeName: string; distanceKm: number; myResponseStatus: string | null; pickupLabel: string | null; dropLabel: string | null; suggestedPrice: number | null };

export default function IncomingRequests() {
  const { locale } = useLanguage();
  const t = useTranslations(SLUGS);
  const loc = locale || "en";
  const [incoming, setIncoming] = useState<Incoming[]>([]);

  const loadIncoming = useCallback(() => {
    fetch(`/api/requests/incoming?locale=${loc}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { broadcasts: [] })).then((j) => setIncoming(j.broadcasts || [])).catch(() => {});
  }, [loc]);
  useEffect(() => { loadIncoming(); }, [loadIncoming]);

  if (incoming.length === 0) {
    return <div style={{ textAlign: "center", color: A.muted, fontSize: 13, padding: 32 }}>{t("requests-empty-incoming", "No nearby requests right now.")}</div>;
  }
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, color: A.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
        {t("requests-tab-incoming", "Incoming")}
      </div>
      {incoming.map((b) => <IncomingCard key={b.id} b={b} t={t} onResponded={loadIncoming} />)}
    </>
  );
}

function IncomingCard({ b, t, onResponded }: { b: Incoming; t: (s: string, f: string) => string; onResponded: () => void }) {
  const [price, setPrice] = useState("");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  async function respond() {
    setSending(true);
    try {
      const res = await fetch(`/api/requests/${b.id}/respond`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotedPrice: price ? Number(price) : null, message: msg.trim() || null, providerStoreId: b.storeId }),
      });
      if (res.ok) onResponded();
    } finally { setSending(false); }
  }
  return (
    <div style={card()}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700 }}>{b.title}</div>
          <div style={{ fontSize: 12, color: A.muted }}>{b.categoryTitle} · {b.requesterName || "—"}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: A.accent }}>{b.distanceKm} km</span>
      </div>
      {b.kind === "errand" && <ErrandLine b={b} t={t} />}
      {b.description && <p style={{ fontSize: 13, marginTop: 6 }}>{b.description}</p>}
      {b.myResponseStatus ? (
        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: b.myResponseStatus === "accepted" ? "#059669" : b.myResponseStatus === "rejected" ? A.muted : A.accent }}>
          {b.myResponseStatus === "accepted" ? t("requests-resp-accepted", "Accepted ✓")
            : b.myResponseStatus === "rejected" ? t("requests-resp-rejected", "Not selected")
            : t("requests-resp-sent", "Response sent")}
        </div>
      ) : (
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder={t("requests-quote-placeholder", "Optional ₹")} style={{ ...inp(), marginBottom: 0, width: 90 }} />
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t("requests-message-placeholder", "Add a message (optional)")} style={{ ...inp(), marginBottom: 0, flex: 1 }} />
          <button disabled={sending} onClick={respond} style={btn(A.accent, "#fff")}>{t("requests-respond", "Respond")}</button>
        </div>
      )}
    </div>
  );
}

// ponytail: ErrandLine + style helpers duplicated from app/app/requests/page.tsx
// (display-only, ~trivial); keeps this component self-contained, no shared styles module.
export function ErrandLine({ b, t }: { b: { pickupLabel: string | null; dropLabel: string | null; suggestedPrice: number | null }; t: (s: string, f: string) => string }) {
  return (
    <div style={{ fontSize: 12, color: A.text, marginTop: 6 }}>
      <div>📦 {b.pickupLabel || "—"} → {b.dropLabel || "—"}</div>
      {b.suggestedPrice != null && (
        <div style={{ color: A.muted, marginTop: 2 }}>
          {t("requests-suggested-price-label", "Suggested price")}: ₹{b.suggestedPrice} · {t("requests-suggested-price-help", "Only a suggestion — you and the runner agree on the final price.")}
        </div>
      )}
    </div>
  );
}
function card(): React.CSSProperties { return { border: `1px solid ${A.border}`, borderRadius: 12, padding: 14, marginBottom: 12, background: A.surface }; }
function inp(): React.CSSProperties { return { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${A.border}`, fontSize: 13, marginBottom: 10, background: "#fff", color: A.text }; }
function btn(bg: string, color: string): React.CSSProperties {
  return { padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color, background: bg, border: "none" };
}
