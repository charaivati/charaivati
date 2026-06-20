"use client";

// REQBCAST-1c — service-request noticeboard. Requester posts a request; nearby
// providers respond; requester accepts ONE → both settle DIRECTLY via UPI VPA.
// The platform never assigns, prices, or collects.
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useTranslations } from "@/hooks/useTranslations";
import { FilterPill } from "@/components/store/FilterPill";
import PayToVpa from "@/components/payments/PayToVpa";
import { suggestErrandPriceHint } from "@/lib/requests/suggestErrandPriceHint";

const SLUGS =
  "requests-title,requests-tab-mine,requests-tab-incoming,requests-post-cta," +
  "requests-category-label,requests-title-label,requests-title-placeholder," +
  "requests-desc-label,requests-desc-placeholder,requests-radius-label,requests-address-label," +
  "requests-submit,requests-posting,requests-empty-mine,requests-empty-incoming," +
  "requests-responses-label,requests-no-responses,requests-quote-placeholder," +
  "requests-message-placeholder,requests-respond,requests-accept,requests-cancel," +
  "requests-handoff-note,requests-status-open,requests-status-accepted," +
  "requests-status-expired,requests-status-cancelled,requests-resp-sent," +
  "requests-resp-accepted,requests-resp-rejected,requests-need-address,requests-contact," +
  "requests-kind-service,requests-kind-errand,requests-pickup-label,requests-drop-label," +
  "requests-suggested-price-label,requests-suggested-price-help,requests-post-cta-errand," +
  "requests-errand-title-placeholder";

const A = { border: "#E5E7EB", text: "#111827", muted: "#6B7280", accent: "#6366f1", surface: "#fff", bg: "#F9FAFB" };

type Resp = { id: string; providerId: string; providerName: string | null; providerStoreId: string | null; storeName: string | null; quotedPrice: number | null; message: string | null; status: string };
type Mine = { id: string; kind: string; categoryTitle: string; title: string; description: string | null; status: string; radiusKm: number; createdAt: string; pickupLabel: string | null; dropLabel: string | null; suggestedPrice: number | null; responses: Resp[]; acceptedResponseId: string | null; handoff: { providerName: string | null; providerPhone: string | null; vpa: string | null } | null };
type Incoming = { id: string; kind: string; requesterName: string | null; categoryTitle: string; title: string; description: string | null; radiusKm: number; storeId: string; storeName: string; distanceKm: number; myResponseStatus: string | null; pickupLabel: string | null; dropLabel: string | null; suggestedPrice: number | null };
type Addr = { id: string; name: string; line1: string; city: string; lat: number | null; lng: number | null; isDefault: boolean };
type Cat = { id: string; title: string };

export default function RequestsPage() {
  const { locale } = useLanguage();
  const t = useTranslations(SLUGS);
  const loc = locale || "en";

  const [tab, setTab] = useState<"mine" | "incoming">("mine");
  const [mine, setMine] = useState<Mine[]>([]);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [addrs, setAddrs] = useState<Addr[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // form state
  const [showForm, setShowForm] = useState(false);
  const [fKind, setFKind] = useState<"service" | "errand">("service");
  const [fCat, setFCat] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fRadius, setFRadius] = useState(5);
  const [fAddr, setFAddr] = useState("");
  const [fPickup, setFPickup] = useState("");
  const [fDrop, setFDrop] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    if (p === "incoming" || p === "mine") setTab(p);
  }, []);

  const loadMine = useCallback(() => {
    fetch(`/api/requests?locale=${loc}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { broadcasts: [] })).then((j) => setMine(j.broadcasts || [])).catch(() => {});
  }, [loc]);
  const loadIncoming = useCallback(() => {
    fetch(`/api/requests/incoming?locale=${loc}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { broadcasts: [] })).then((j) => setIncoming(j.broadcasts || [])).catch(() => {});
  }, [loc]);

  useEffect(() => { loadMine(); loadIncoming(); }, [loadMine, loadIncoming]);
  useEffect(() => {
    fetch(`/api/store/taxonomy?locale=${loc}`).then((r) => r.json()).then((j) => setCats(j.categories || [])).catch(() => {});
    fetch("/api/store/address", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])).then((a) => {
      const list: Addr[] = Array.isArray(a) ? a : [];
      setAddrs(list);
      const def = list.find((x) => x.isDefault && x.lat != null) ?? list.find((x) => x.lat != null);
      if (def) { setFAddr(def.id); setFPickup(def.id); }
    }).catch(() => {});
  }, [loc]);

  async function post() {
    if (!fCat || !fTitle.trim()) return;
    let body: any;
    if (fKind === "errand") {
      const pickup = addrs.find((a) => a.id === fPickup);
      const drop = addrs.find((a) => a.id === fDrop);
      if (!pickup || pickup.lat == null || !drop || drop.lat == null) return;
      body = {
        kind: "errand", categoryId: fCat, title: fTitle.trim(), description: fDesc.trim() || null, radiusKm: fRadius,
        pickupLat: pickup.lat, pickupLng: pickup.lng, pickupLabel: `${pickup.name} — ${pickup.city}`,
        dropLat: drop.lat, dropLng: drop.lng, dropLabel: `${drop.name} — ${drop.city}`,
      };
    } else {
      const addr = addrs.find((a) => a.id === fAddr);
      if (!addr || addr.lat == null || addr.lng == null) return;
      body = { kind: "service", categoryId: fCat, title: fTitle.trim(), description: fDesc.trim() || null, addressLat: addr.lat, addressLng: addr.lng, radiusKm: fRadius };
    }
    setPosting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) { setShowForm(false); setFTitle(""); setFDesc(""); setFCat(""); loadMine(); }
    } finally { setPosting(false); }
  }

  // Display-only suggested price for the errand form (same helper the server uses).
  const errandHint = (() => {
    const p = addrs.find((a) => a.id === fPickup), d = addrs.find((a) => a.id === fDrop);
    if (fKind !== "errand" || !p || p.lat == null || !d || d.lat == null) return null;
    return suggestErrandPriceHint(p.lat, p.lng!, d.lat, d.lng!);
  })();

  async function accept(broadcastId: string, responseId: string) {
    setBusy(responseId);
    try {
      const res = await fetch(`/api/requests/${broadcastId}/accept`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responseId }),
      });
      if (res.ok) loadMine();
    } finally { setBusy(null); }
  }
  async function cancel(broadcastId: string) {
    setBusy(broadcastId);
    try {
      const res = await fetch(`/api/requests/${broadcastId}`, {
        method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }),
      });
      if (res.ok) loadMine();
    } finally { setBusy(null); }
  }

  const statusLabel = (s: string) =>
    s === "accepted" ? t("requests-status-accepted", "Accepted")
    : s === "expired" ? t("requests-status-expired", "Expired")
    : s === "cancelled" ? t("requests-status-cancelled", "Cancelled")
    : t("requests-status-open", "Open");

  const hasUsableAddr = addrs.some((a) => a.lat != null && a.lng != null);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 16, color: A.text }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{t("requests-title", "Service requests")}</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <FilterPill active={tab === "mine"} onClick={() => setTab("mine")}>{t("requests-tab-mine", "My requests")}</FilterPill>
        <FilterPill active={tab === "incoming"} onClick={() => setTab("incoming")}>{t("requests-tab-incoming", "Incoming")}</FilterPill>
      </div>

      {tab === "mine" && (
        <>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} style={btn(A.accent, "#fff")}>+ {t("requests-post-cta", "Post a service request")}</button>
          ) : (
            <div style={card()}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <FilterPill active={fKind === "service"} onClick={() => setFKind("service")}>{t("requests-kind-service", "Service")}</FilterPill>
                <FilterPill active={fKind === "errand"} onClick={() => setFKind("errand")}>{t("requests-kind-errand", "Errand")}</FilterPill>
              </div>
              <Label>{t("requests-category-label", "Service category")}</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {cats.map((c) => <FilterPill key={c.id} active={fCat === c.id} onClick={() => setFCat(c.id)}>{c.title}</FilterPill>)}
              </div>
              <Label>{t("requests-title-label", "Title")}</Label>
              <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder={fKind === "errand" ? t("requests-errand-title-placeholder", "e.g. Pick up a parcel and drop it across town") : t("requests-title-placeholder", "e.g. Need a plumber for a leak")} style={inp()} />
              <Label>{t("requests-desc-label", "Details")}</Label>
              <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder={t("requests-desc-placeholder", "Describe what you need")} rows={3} style={inp()} />
              <Label>{t("requests-radius-label", "Search radius (km)")}</Label>
              <input type="number" min={1} max={50} value={fRadius} onChange={(e) => setFRadius(Number(e.target.value))} style={inp()} />
              {!hasUsableAddr ? (
                <p style={{ fontSize: 12, color: "#DC2626", marginBottom: 8 }}>{t("requests-need-address", "Add an address with a location to post a request.")}</p>
              ) : fKind === "errand" ? (
                <>
                  <Label>{t("requests-pickup-label", "Pickup location")}</Label>
                  <select value={fPickup} onChange={(e) => setFPickup(e.target.value)} style={inp()}>
                    {addrs.filter((a) => a.lat != null).map((a) => <option key={a.id} value={a.id}>{a.name} — {a.line1}, {a.city}</option>)}
                  </select>
                  <Label>{t("requests-drop-label", "Drop location")}</Label>
                  <select value={fDrop} onChange={(e) => setFDrop(e.target.value)} style={inp()}>
                    <option value="">—</option>
                    {addrs.filter((a) => a.lat != null).map((a) => <option key={a.id} value={a.id}>{a.name} — {a.line1}, {a.city}</option>)}
                  </select>
                  {errandHint != null && (
                    <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: "#F0F9FF", border: "1px solid #BAE6FD" }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t("requests-suggested-price-label", "Suggested price")}: ₹{errandHint}</div>
                      <div style={{ fontSize: 11, color: A.muted, marginTop: 2 }}>{t("requests-suggested-price-help", "Only a suggestion — you and the runner agree on the final price.")}</div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Label>{t("requests-address-label", "Your location")}</Label>
                  <select value={fAddr} onChange={(e) => setFAddr(e.target.value)} style={inp()}>
                    {addrs.filter((a) => a.lat != null).map((a) => <option key={a.id} value={a.id}>{a.name} — {a.line1}, {a.city}</option>)}
                  </select>
                </>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => setShowForm(false)} style={btn(A.surface, A.muted, true)}>✕</button>
                <button disabled={posting || !fCat || !fTitle.trim() || !hasUsableAddr || (fKind === "errand" && !fDrop)} onClick={post} style={{ ...btn(A.accent, "#fff"), flex: 1, opacity: posting || !fCat || !fTitle.trim() || !hasUsableAddr || (fKind === "errand" && !fDrop) ? 0.5 : 1 }}>
                  {posting ? t("requests-posting", "Posting…") : t("requests-submit", "Post request")}
                </button>
              </div>
            </div>
          )}

          {mine.length === 0 && <Empty>{t("requests-empty-mine", "You haven't posted any requests yet.")}</Empty>}
          {mine.map((b) => (
            <div key={b.id} style={card()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: A.muted }}>{b.categoryTitle} · {b.radiusKm} km</div>
                </div>
                <Badge status={b.status}>{statusLabel(b.status)}</Badge>
              </div>
              {b.kind === "errand" && <ErrandLine b={b} t={t} />}
              {b.description && <p style={{ fontSize: 13, color: A.text, marginTop: 6 }}>{b.description}</p>}

              {b.status === "accepted" && b.handoff && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#ECFDF5", border: "1px solid #A7F3D0" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("requests-contact", "Contact")}: {b.handoff.providerName || "—"}
                    {b.handoff.providerPhone && <> · <a href={`tel:${b.handoff.providerPhone}`} style={{ color: A.accent }}>{b.handoff.providerPhone}</a></>}
                  </div>
                  {b.handoff.vpa && <PayToVpa vpa={b.handoff.vpa} payeeName={b.handoff.providerName} />}
                  <div style={{ fontSize: 11, color: A.muted, marginTop: 4 }}>{t("requests-handoff-note", "Pay the provider directly. Charaivati never handles the money.")}</div>
                </div>
              )}

              <div style={{ marginTop: 10 }}>
                <Label>{t("requests-responses-label", "Responses")}</Label>
                {b.responses.length === 0 && <div style={{ fontSize: 12, color: A.muted }}>{t("requests-no-responses", "No responses yet.")}</div>}
                {b.responses.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: `1px solid ${A.border}` }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{r.storeName || r.providerName || "—"}</span>
                      {r.quotedPrice != null && <span style={{ marginLeft: 6, color: "#059669" }}>₹{r.quotedPrice}</span>}
                      {r.message && <div style={{ fontSize: 12, color: A.muted }}>{r.message}</div>}
                    </div>
                    {b.status === "open" && r.status === "pending" && (
                      <button disabled={busy === r.id} onClick={() => accept(b.id, r.id)} style={btn("#059669", "#fff")}>{t("requests-accept", "Accept")}</button>
                    )}
                    {r.status === "accepted" && <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>✓</span>}
                    {r.status === "rejected" && <span style={{ fontSize: 12, color: A.muted }}>{t("requests-resp-rejected", "Not selected")}</span>}
                  </div>
                ))}
              </div>

              {b.status === "open" && (
                <button disabled={busy === b.id} onClick={() => cancel(b.id)} style={{ ...btn(A.surface, "#DC2626", true), marginTop: 8 }}>{t("requests-cancel", "Cancel request")}</button>
              )}
            </div>
          ))}
        </>
      )}

      {tab === "incoming" && (
        <>
          {incoming.length === 0 && <Empty>{t("requests-empty-incoming", "No nearby requests right now.")}</Empty>}
          {incoming.map((b) => <IncomingCard key={b.id} b={b} t={t} onResponded={loadIncoming} />)}
        </>
      )}
    </div>
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

const A2 = A;
// Errand pickup → drop + display-only suggested price. Shown for kind="errand" only.
function ErrandLine({ b, t }: { b: { pickupLabel: string | null; dropLabel: string | null; suggestedPrice: number | null }; t: (s: string, f: string) => string }) {
  return (
    <div style={{ fontSize: 12, color: A2.text, marginTop: 6 }}>
      <div>📦 {b.pickupLabel || "—"} → {b.dropLabel || "—"}</div>
      {b.suggestedPrice != null && (
        <div style={{ color: A2.muted, marginTop: 2 }}>
          {t("requests-suggested-price-label", "Suggested price")}: ₹{b.suggestedPrice} · {t("requests-suggested-price-help", "Only a suggestion — you and the runner agree on the final price.")}
        </div>
      )}
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 12, fontWeight: 600, color: A2.muted, marginBottom: 4 }}>{children}</div>; }
function Empty({ children }: { children: React.ReactNode }) { return <div style={{ textAlign: "center", color: A2.muted, fontSize: 13, padding: 32 }}>{children}</div>; }
function Badge({ status, children }: { status: string; children: React.ReactNode }) {
  const c = status === "accepted" ? "#059669" : status === "open" ? "#6366f1" : "#9CA3AF";
  return <span style={{ fontSize: 11, fontWeight: 700, color: c, border: `1px solid ${c}`, borderRadius: 999, padding: "2px 8px" }}>{children}</span>;
}
function card(): React.CSSProperties { return { border: `1px solid ${A2.border}`, borderRadius: 12, padding: 14, marginBottom: 12, background: A2.surface }; }
function inp(): React.CSSProperties { return { width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${A2.border}`, fontSize: 13, marginBottom: 10, background: "#fff", color: A2.text }; }
function btn(bg: string, color: string, outline = false): React.CSSProperties {
  return { padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color, background: bg, border: outline ? `1px solid ${A2.border}` : "none" };
}
