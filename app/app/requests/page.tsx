"use client";

// REQBCAST-1c — service-request noticeboard. Requester posts a request; nearby
// providers respond; requester accepts ONE → both settle DIRECTLY via UPI VPA.
// The platform never assigns, prices, or collects.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useTranslations } from "@/hooks/useTranslations";
import { FilterPill } from "@/components/store/FilterPill";
import PayToVpa from "@/components/payments/PayToVpa";
import { suggestErrandPriceHint } from "@/lib/requests/suggestErrandPriceHint";
import { geocodeSearch, reverseGeocode } from "@/lib/geo/geocode";
import { useGeolocation } from "@/hooks/useGeolocation";
import dynamic from "next/dynamic";

// On-demand pin picker — Leaflet, loaded client-side only (REQBCAST-1g2).
const MapPicker = dynamic(() => import("@/components/shared/MapPicker"), { ssr: false });
const MAP_FALLBACK = { lat: 12.9716, lng: 77.5946 }; // Bangalore — last-resort map centre

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
  "requests-errand-title-placeholder,requests-loc-different,requests-loc-search-placeholder," +
  "requests-loc-search,requests-loc-search-none,requests-loc-current,requests-loc-map," +
  "requests-loc-map-hint,requests-loc-map-confirm,requests-loc-map-fallback," +
  "requests-loc-reverse,requests-loc-locating";

const A = { border: "#E5E7EB", text: "#111827", muted: "#6B7280", accent: "#6366f1", surface: "#fff", bg: "#F9FAFB" };

type Resp = { id: string; providerId: string; providerName: string | null; providerStoreId: string | null; storeName: string | null; quotedPrice: number | null; message: string | null; status: string };
type Mine = { id: string; kind: string; categoryTitle: string; title: string; description: string | null; status: string; radiusKm: number; createdAt: string; pickupLabel: string | null; dropLabel: string | null; suggestedPrice: number | null; responses: Resp[]; acceptedResponseId: string | null; handoff: { providerName: string | null; providerPhone: string | null; vpa: string | null } | null };
type Addr = { id: string; name: string; line1: string; city: string; lat: number | null; lng: number | null; isDefault: boolean };
type Cat = { id: string; title: string };
type TempLoc = { lat: number; lng: number; label: string };
const TEMP = "__temp__"; // sentinel select value → one-off location, not a saved address

export default function RequestsPage() {
  const { locale } = useLanguage();
  const t = useTranslations(SLUGS);
  const loc = locale || "en";

  const [mine, setMine] = useState<Mine[]>([]);
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
  const [fPickupTemp, setFPickupTemp] = useState<TempLoc | null>(null);
  const [fDropTemp, setFDropTemp] = useState<TempLoc | null>(null);
  const [posting, setPosting] = useState(false);

  // Incoming (provider side) moved to Orders → Requests (REQBCAST-1f). Redirect old deep-links.
  useEffect(() => {
    if (window.location.pathname === "/app/requests" && new URLSearchParams(window.location.search).get("tab") === "incoming") {
      window.location.replace("/app/orders?tab=requests");
    }
  }, []);

  const loadMine = useCallback(() => {
    fetch(`/api/requests?locale=${loc}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { broadcasts: [] })).then((j) => setMine(j.broadcasts || [])).catch(() => {});
  }, [loc]);

  useEffect(() => { loadMine(); }, [loadMine]);
  useEffect(() => {
    fetch(`/api/store/taxonomy?locale=${loc}`).then((r) => r.json()).then((j) => setCats(j.categories || [])).catch(() => {});
    fetch("/api/store/address", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])).then((a) => {
      const list: Addr[] = Array.isArray(a) ? a : [];
      setAddrs(list);
      const def = list.find((x) => x.isDefault && x.lat != null) ?? list.find((x) => x.lat != null);
      if (def) { setFAddr(def.id); setFPickup(def.id); }
    }).catch(() => {});
  }, [loc]);

  // Resolve a pickup/drop selection to coords + label, from a saved address OR a one-off temp location.
  function resolveLoc(id: string, temp: TempLoc | null): TempLoc | null {
    if (id === TEMP) return temp;
    const a = addrs.find((x) => x.id === id);
    if (!a || a.lat == null || a.lng == null) return null;
    return { lat: a.lat, lng: a.lng, label: `${a.name} — ${a.city}` };
  }
  const pickupLoc = resolveLoc(fPickup, fPickupTemp);
  const dropLoc = resolveLoc(fDrop, fDropTemp);
  // Map centre when no point is chosen yet: a saved address, else Bangalore.
  const savedCenter = addrs.find((a) => a.lat != null && a.lng != null);
  const defaultCenter = savedCenter ? { lat: savedCenter.lat as number, lng: savedCenter.lng as number } : MAP_FALLBACK;

  async function post() {
    if (!fCat || !fTitle.trim()) return;
    let body: any;
    if (fKind === "errand") {
      if (!pickupLoc || !dropLoc) return;
      body = {
        kind: "errand", categoryId: fCat, title: fTitle.trim(), description: fDesc.trim() || null, radiusKm: fRadius,
        pickupLat: pickupLoc.lat, pickupLng: pickupLoc.lng, pickupLabel: pickupLoc.label,
        dropLat: dropLoc.lat, dropLng: dropLoc.lng, dropLabel: dropLoc.label,
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
  const errandHint = fKind === "errand" && pickupLoc && dropLoc
    ? suggestErrandPriceHint(pickupLoc.lat, pickupLoc.lng, dropLoc.lat, dropLoc.lng) : null;

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
  const canSubmit = !!fCat && !!fTitle.trim() && (fKind === "errand" ? !!pickupLoc && !!dropLoc : hasUsableAddr);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 16, color: A.text }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{t("requests-title", "Service requests")}</h1>

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
              {fKind === "errand" ? (
                <>
                  <Label>{t("requests-pickup-label", "Pickup location")}</Label>
                  <LocSelect value={fPickup} onChange={setFPickup} addrs={addrs} temp={fPickupTemp} onTemp={setFPickupTemp} t={t} defaultCenter={defaultCenter} allowGps />
                  <Label>{t("requests-drop-label", "Drop location")}</Label>
                  <LocSelect value={fDrop} onChange={setFDrop} addrs={addrs} temp={fDropTemp} onTemp={setFDropTemp} t={t} defaultCenter={defaultCenter} allowEmpty />
                  {errandHint != null && (
                    <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: "#F0F9FF", border: "1px solid #BAE6FD" }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t("requests-suggested-price-label", "Suggested price")}: ₹{errandHint}</div>
                      <div style={{ fontSize: 11, color: A.muted, marginTop: 2 }}>{t("requests-suggested-price-help", "Only a suggestion — you and the runner agree on the final price.")}</div>
                    </div>
                  )}
                </>
              ) : !hasUsableAddr ? (
                <p style={{ fontSize: 12, color: "#DC2626", marginBottom: 8 }}>{t("requests-need-address", "Add an address with a location to post a request.")}</p>
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
                <button disabled={posting || !canSubmit} onClick={post} style={{ ...btn(A.accent, "#fff"), flex: 1, opacity: posting || !canSubmit ? 0.5 : 1 }}>
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
// Saved-address dropdown + a "different location" option resolved by search, live
// GPS (pickup), or an on-demand draggable map pin (REQBCAST-1g / 1g2).
function LocSelect({ value, onChange, addrs, temp, onTemp, t, allowEmpty, defaultCenter, allowGps }: {
  value: string; onChange: (v: string) => void; addrs: Addr[]; temp: TempLoc | null;
  onTemp: (l: TempLoc | null) => void; t: (s: string, f: string) => string; allowEmpty?: boolean;
  defaultCenter: { lat: number; lng: number }; allowGps?: boolean;
}) {
  return (
    <>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inp()}>
        {allowEmpty && <option value="">—</option>}
        {addrs.filter((a) => a.lat != null).map((a) => <option key={a.id} value={a.id}>{a.name} — {a.line1}, {a.city}</option>)}
        <option value={TEMP}>{t("requests-loc-different", "Use a different location…")}</option>
      </select>
      {value === TEMP && <TempPicker temp={temp} onResolve={onTemp} t={t} defaultCenter={defaultCenter} allowGps={allowGps} />}
    </>
  );
}

function TempPicker({ temp, onResolve, t, defaultCenter, allowGps }: {
  temp: TempLoc | null; onResolve: (l: TempLoc | null) => void; t: (s: string, f: string) => string;
  defaultCenter: { lat: number; lng: number }; allowGps?: boolean;
}) {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [none, setNone] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [reverse, setReverse] = useState(false);
  const geo = useGeolocation();
  const gotFix = useRef(false);

  async function go() {
    if (!q.trim()) return;
    setSearching(true); setNone(false); onResolve(null);
    const r = await geocodeSearch(q.trim());
    setSearching(false);
    if (r) onResolve(r); else setNone(true);
  }

  // One-shot GPS: first fix wins, then stop. Reverse-geocode it to a label.
  function useCurrent() {
    setLocating(true); setNone(false); gotFix.current = false;
    geo.startWatch(async (lat, lng) => {
      if (gotFix.current) return;
      gotFix.current = true;
      geo.stopWatch();
      const label = await reverseGeocode(lat, lng);
      onResolve({ lat, lng, label });
      setLocating(false);
    }, () => { geo.stopWatch(); setLocating(false); });
  }

  // On pin drag-end (or initial open): reverse-geocode the new coords → fresh label.
  async function onPin(lat: number, lng: number) {
    setReverse(true);
    const label = await reverseGeocode(lat, lng);
    onResolve({ lat, lng, label });
    setReverse(false);
  }
  function openMap() {
    setNone(false); setMapOpen(true);
    if (!temp) onPin(defaultCenter.lat, defaultCenter.lng); // seed so Confirm works without a drag
  }

  const center = temp ?? defaultCenter;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }}
          placeholder={t("requests-loc-search-placeholder", "Search an address or place")} style={{ ...inp(), marginBottom: 0, flex: 1 }} />
        <button type="button" disabled={searching || !q.trim()} onClick={go} style={{ ...btn(A2.accent, "#fff"), opacity: searching || !q.trim() ? 0.5 : 1 }}>
          {searching ? "…" : t("requests-loc-search", "Search")}
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {allowGps && (
          <button type="button" disabled={locating} onClick={useCurrent} style={{ ...btn(A2.surface, A2.accent, true), opacity: locating ? 0.5 : 1 }}>
            {locating ? t("requests-loc-locating", "Locating…") : `📍 ${t("requests-loc-current", "Use my current location")}`}
          </button>
        )}
        <button type="button" onClick={() => (mapOpen ? setMapOpen(false) : openMap())} style={btn(A2.surface, A2.accent, true)}>
          🗺️ {t("requests-loc-map", "Set on map")}
        </button>
      </div>
      {mapOpen && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: A2.muted, marginBottom: 4 }}>{t("requests-loc-map-hint", "Drag the pin to adjust")}</div>
          <MapPicker lat={center.lat} lng={center.lng} onMove={onPin} />
          <button type="button" onClick={() => setMapOpen(false)} style={{ ...btn(A2.accent, "#fff"), marginTop: 6, width: "100%" }}>
            {t("requests-loc-map-confirm", "Use this location")}
          </button>
        </div>
      )}
      {(reverse || (locating && !mapOpen)) && <div style={{ fontSize: 12, color: A2.muted, marginTop: 4 }}>{t("requests-loc-reverse", "Finding address…")}</div>}
      {temp && <div style={{ fontSize: 12, color: "#059669", marginTop: 4 }}>📍 {temp.label}</div>}
      {none && (
        <div style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>
          {t("requests-loc-search-none", "No match found — try a more specific search.")}{" "}
          <button type="button" onClick={openMap} style={{ background: "none", border: "none", color: A2.accent, cursor: "pointer", padding: 0, fontSize: 12, textDecoration: "underline" }}>
            {t("requests-loc-map-fallback", "Set it on the map instead")}
          </button>
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
