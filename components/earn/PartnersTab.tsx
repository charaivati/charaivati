"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CollabPage = { id: string; title: string; pageType: string; avatarUrl: string | null };
type StoreResult = { id: string; name: string; slug: string | null; pageId: string | null };
type Collab = {
  id: string;
  requesterId: string;
  receiverId: string;
  role: string;
  status: string;
  message: string | null;
  requester: CollabPage;
  receiver: CollabPage;
  costPerOrder?: number | null;
  costPerKg?: number | null;
  costPerKgPerKm?: number | null;
  costPerItemPerKm?: number | null;
};
type ActiveCollab = Collab & { direction: "in" | "out" };

type PricingDraft = {
  costPerOrder: string;
  costPerKg: string;
  costPerKgPerKm: string;
  costPerItemPerKm: string;
};

const ROLES = [
  { value: "delivery_partner", label: "Delivery Partner", emoji: "🛵" },
  { value: "supplier",         label: "Supplier",         emoji: "📦" },
  { value: "employee",         label: "Employee",         emoji: "👤" },
  { value: "marketing",        label: "Marketing",        emoji: "📣" },
  { value: "other",            label: "Other",            emoji: "🤝" },
] as const;

function roleEmoji(role: string) {
  return ROLES.find((r) => r.value === role)?.emoji ?? "🤝";
}
function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

function toStr(v: number | null | undefined): string {
  return v == null ? "" : String(v);
}

function Flash({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className={`text-sm px-3 py-2 rounded-lg border ${
        ok
          ? "bg-emerald-900/40 border-emerald-800/50 text-emerald-300"
          : "bg-red-900/40 border-red-800/50 text-red-300"
      }`}
    >
      {msg}
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
  );
}

interface PartnersTabProps {
  pageId: string;
  ownerPages: { id: string; title: string; pageType: string }[];
}

export default function PartnersTab({ pageId, ownerPages }: PartnersTabProps) {
  const [loading, setLoading] = useState(true);
  const [activePartners, setActivePartners] = useState<ActiveCollab[]>([]);
  const [pendingIn, setPendingIn] = useState<Collab[]>([]);
  const [actioning, setActioning] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);

  // Pricing state
  const [pricingOpen, setPricingOpen] = useState<Set<string>>(new Set());
  const [pricingDraft, setPricingDraft] = useState<Record<string, PricingDraft>>({});
  const [pricingSaved, setPricingSaved] = useState<Set<string>>(new Set());
  const [pricingSaving, setPricingSaving] = useState<Set<string>>(new Set());

  // Invite form
  const defaultFrom = ownerPages.find((p) => p.id === pageId)?.id ?? ownerPages[0]?.id ?? pageId;
  const [fromPageId, setFromPageId] = useState(defaultFrom);
  const [role, setRole] = useState<string>("delivery_partner");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Store search autocomplete
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StoreResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreResult | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchInput(val: string) {
    setSearchQuery(val);
    setSelectedStore(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/store/search?q=${encodeURIComponent(val.trim())}`, { credentials: "include" });
        const data: StoreResult[] = res.ok ? await res.json() : [];
        setSearchResults(data);
        setShowDropdown(data.length > 0);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function selectStore(store: StoreResult) {
    setSelectedStore(store);
    setSearchQuery(store.name);
    setShowDropdown(false);
  }

  function showFlash(msg: string, ok: boolean) {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  }

  function setActioned(id: string, on: boolean) {
    setActioning((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function initPricingDraft(collabs: ActiveCollab[]) {
    setPricingDraft((prev) => {
      const next = { ...prev };
      for (const c of collabs) {
        if (!next[c.id]) {
          next[c.id] = {
            costPerOrder:    toStr(c.costPerOrder),
            costPerKg:       toStr(c.costPerKg),
            costPerKgPerKm:  toStr(c.costPerKgPerKm),
            costPerItemPerKm: toStr(c.costPerItemPerKm),
          };
        }
      }
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = `/api/collaboration?pageId=${pageId}`;
      const [inAcc, outAcc, inPend] = await Promise.all([
        fetch(`${base}&direction=in&status=accepted`,  { credentials: "include" }).then((r) => r.json()),
        fetch(`${base}&direction=out&status=accepted`, { credentials: "include" }).then((r) => r.json()),
        fetch(`${base}&direction=in&status=pending`,   { credentials: "include" }).then((r) => r.json()),
      ]);

      const raw: ActiveCollab[] = [
        ...(Array.isArray(inAcc)  ? (inAcc  as Collab[]).map((c) => ({ ...c, direction: "in"  as const })) : []),
        ...(Array.isArray(outAcc) ? (outAcc as Collab[]).map((c) => ({ ...c, direction: "out" as const })) : []),
      ];
      const seen = new Set<string>();
      const deduped = raw.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
      setActivePartners(deduped);
      initPricingDraft(deduped);
      setPendingIn(Array.isArray(inPend) ? (inPend as Collab[]) : []);
    } catch {
      showFlash("Failed to load partners", false);
    } finally {
      setLoading(false);
    }
  }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function handleRevoke(id: string) {
    setActioned(id, true);
    try {
      const res = await fetch(`/api/collaboration/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setActivePartners((prev) => prev.filter((c) => c.id !== id));
        showFlash("Partner removed", true);
      } else {
        const d = await res.json().catch(() => ({}));
        showFlash((d as { error?: string }).error ?? "Failed to revoke", false);
      }
    } catch {
      showFlash("Failed to revoke", false);
    } finally {
      setActioned(id, false);
    }
  }

  async function handleRespond(id: string, status: "accepted" | "rejected") {
    setActioned(id, true);
    try {
      const res = await fetch(`/api/collaboration/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Collab;
        setPendingIn((prev) => prev.filter((c) => c.id !== id));
        if (status === "accepted") {
          const ac: ActiveCollab = { ...updated, direction: "in" };
          setActivePartners((prev) => [...prev, ac]);
          initPricingDraft([ac]);
          showFlash("Partner accepted", true);
        } else {
          showFlash("Request rejected", true);
        }
      } else {
        const d = await res.json().catch(() => ({}));
        showFlash((d as { error?: string }).error ?? "Failed", false);
      }
    } catch {
      showFlash("Failed", false);
    } finally {
      setActioned(id, false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const target = selectedStore?.id ?? searchQuery.trim();
    if (!target) { showFlash("Search for and select a store first", false); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/collaboration", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: fromPageId,
          receiverId: target,
          role,
          message: message.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setSearchQuery("");
        setSelectedStore(null);
        setMessage("");
        showFlash("Invite sent!", true);
      } else {
        showFlash((d as { error?: string }).error ?? "Failed to send invite", false);
      }
    } catch {
      showFlash("Failed to send invite", false);
    } finally {
      setSubmitting(false);
    }
  }

  function togglePricing(id: string) {
    setPricingOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function updateDraft(id: string, field: keyof PricingDraft, val: string) {
    setPricingDraft((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { costPerOrder: "", costPerKg: "", costPerKgPerKm: "", costPerItemPerKm: "" }), [field]: val },
    }));
  }

  async function savePricing(collabId: string) {
    const draft = pricingDraft[collabId];
    if (!draft) return;
    setPricingSaving((prev) => new Set(prev).add(collabId));
    try {
      const parse = (v: string) => v.trim() === "" ? null : Number(v);
      await fetch(`/api/collaboration/${collabId}/pricing`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costPerOrder:    parse(draft.costPerOrder),
          costPerKg:       parse(draft.costPerKg),
          costPerKgPerKm:  parse(draft.costPerKgPerKm),
          costPerItemPerKm: parse(draft.costPerItemPerKm),
        }),
      });
      setPricingSaved((prev) => {
        const next = new Set(prev);
        next.add(collabId);
        setTimeout(() => setPricingSaved((p) => { const n = new Set(p); n.delete(collabId); return n; }), 2000);
        return next;
      });
    } catch {
      // silent — user can retry on next blur
    } finally {
      setPricingSaving((prev) => { const next = new Set(prev); next.delete(collabId); return next; });
    }
  }

  function partnerPage(c: ActiveCollab): CollabPage {
    return c.direction === "in" ? c.requester : c.receiver;
  }

  return (
    <div className="space-y-6">
      {flash && <Flash msg={flash.msg} ok={flash.ok} />}

      {/* ── Section 1: Active Partners ── */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Active Partners
        </h3>
        {loading ? (
          <div className="flex justify-center py-8 text-gray-600">
            <Spinner />
          </div>
        ) : activePartners.length === 0 ? (
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 text-sm text-gray-500 text-center">
            No active partners yet.
          </div>
        ) : (
          <div className="space-y-2">
            {activePartners.map((c) => {
              const partner = partnerPage(c);
              const draft = pricingDraft[c.id] ?? { costPerOrder: "", costPerKg: "", costPerKgPerKm: "", costPerItemPerKm: "" };
              const isPricingOpen = pricingOpen.has(c.id);
              const isSaving = pricingSaving.has(c.id);
              const justSaved = pricingSaved.has(c.id);

              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden"
                >
                  {/* Partner row */}
                  <div className="flex items-center gap-3 p-3">
                    <span className="text-xl shrink-0">{roleEmoji(c.role)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{partner.title}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/50 text-indigo-300 border border-indigo-800/40">
                          {roleLabel(c.role)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700/50">
                          {partner.pageType}
                        </span>
                        <button
                          onClick={() => togglePricing(c.id)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          Set pricing {isPricingOpen ? "▴" : "▾"}
                        </button>
                        {justSaved && (
                          <span className="text-xs text-emerald-400">Saved ✓</span>
                        )}
                        {isSaving && <Spinner />}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(c.id)}
                      disabled={actioning.has(c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-900/40 hover:bg-red-900/20 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {actioning.has(c.id) && <Spinner />}
                      Revoke
                    </button>
                  </div>

                  {/* Expandable pricing section */}
                  {isPricingOpen && (
                    <div className="border-t border-gray-800 p-3 space-y-2">
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Delivery Pricing</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            { field: "costPerOrder",    label: "Cost per order (₹)" },
                            { field: "costPerKg",       label: "Cost per kg (₹)" },
                            { field: "costPerKgPerKm",  label: "Cost per kg/km (₹)" },
                            { field: "costPerItemPerKm", label: "Cost per item/km (₹)" },
                          ] as { field: keyof PricingDraft; label: string }[]
                        ).map(({ field, label }) => (
                          <div key={field}>
                            <label className="block text-xs text-gray-500 mb-1">{label}</label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="—"
                              value={draft[field]}
                              onChange={(e) => updateDraft(c.id, field, e.target.value)}
                              onBlur={() => savePricing(c.id)}
                              className="w-full px-2 py-1.5 rounded-lg bg-gray-950 border border-gray-700 text-xs text-white outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 2: Incoming Pending ── */}
      {!loading && pendingIn.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Incoming Requests
          </h3>
          <div className="space-y-2">
            {pendingIn.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl border border-amber-900/40 bg-amber-900/10"
              >
                <p className="text-sm text-white mb-1">
                  <span className="font-medium">{c.requester.title}</span>
                  <span className="text-gray-400"> wants to be your </span>
                  <span className="font-medium text-amber-300">{roleLabel(c.role)}</span>
                </p>
                {c.message && (
                  <p className="text-xs text-gray-400 italic mb-2">&ldquo;{c.message}&rdquo;</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleRespond(c.id, "accepted")}
                    disabled={actioning.has(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-700 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
                  >
                    {actioning.has(c.id) && <Spinner />}
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespond(c.id, "rejected")}
                    disabled={actioning.has(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 3: Invite a Partner ── */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Invite a Partner
        </h3>
        <form
          onSubmit={handleInvite}
          className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 space-y-3"
        >
          {ownerPages.length > 1 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sending as</label>
              <select
                value={fromPageId}
                onChange={(e) => setFromPageId(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white outline-none"
              >
                {ownerPages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <label className="block text-xs text-gray-500 mb-1">Partner store</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder="Search by store name…"
                className={`w-full p-2.5 rounded-lg bg-gray-950 border text-sm text-white placeholder-gray-600 outline-none pr-8 ${
                  selectedStore ? "border-indigo-600" : "border-gray-700"
                }`}
              />
              {searching && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                  <Spinner />
                </span>
              )}
              {selectedStore && !searching && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400 text-xs">✓</span>
              )}
            </div>
            {showDropdown && (
              <ul className="absolute z-20 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-xl">
                {searchResults.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onMouseDown={() => selectStore(s)}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-800 transition-colors"
                    >
                      <span className="text-sm text-white font-medium">{s.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{s.slug ?? s.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedStore && (
              <p className="text-xs text-gray-500 mt-1">
                ID: <span className="font-mono text-gray-400">{selectedStore.id}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white outline-none"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.emoji} {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Message (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note to your invitation…"
              rows={2}
              className="w-full p-2.5 rounded-lg bg-gray-950 border border-gray-700 text-sm text-white placeholder-gray-600 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting && <Spinner />}
              Send Invite
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
