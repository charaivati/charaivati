"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

const A = {
  bg: "#E3E6E6", nav: "#131921", border: "#DDDDDD",
  text: "#0F1111", textMuted: "#565959", accent: "#6366f1",
};

// ── Delivery stepper ──────────────────────────────────────────────────────────
const DELIVERY_STEPS = ["pending", "confirmed", "processing", "out_for_delivery", "delivered"] as const;
type DeliveryStep = typeof DELIVERY_STEPS[number];

const STEP_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type OrderItem = { blockId: string; title: string; price: number; quantity: number };
type Address = { name: string; phone: string; line1: string; city: string; state: string; pincode: string };
type Order = {
  id: string; status: string; total: number; createdAt: string;
  invoiceUrl?: string | null;
  invoiceSignedUrl?: string | null;
  items: OrderItem[];
  address: Address;
  user: { name: string | null; email: string | null };
  deliveryStatus?: string | null;
  assignedToId?: string | null;
  deliveryNote?: string | null;
};

type CollabPage = { id: string; title: string; pageType: string };
type Collab = { id: string; role: string; requester: CollabPage; receiver: CollabPage };

type InvoiceState = {
  genStatus: "idle" | "loading" | "done" | "error";
  url?: string;
  signedUrl?: string;
  signStatus: "idle" | "uploading" | "done" | "error";
  signError?: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#6366f1", shipped: "#3B82F6",
  delivered: "#10B981", cancelled: "#EF4444",
};

// ── InvoiceSection (unchanged) ────────────────────────────────────────────────
function InvoiceSection({ orderId, inv, onSignUpload }: {
  orderId: string;
  inv: InvoiceState;
  onSignUpload: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSignUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/orders/${orderId}/invoice/sign`, {
      method: "POST", credentials: "include", body: fd,
    });
    if (res.ok) {
      const data = await res.json();
      onSignUpload(data.invoiceSignedUrl);
    } else {
      throw new Error("Upload failed");
    }
  }

  if (inv.genStatus === "loading") return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: A.textMuted }}>
      <span className="w-3 h-3 rounded-full border border-indigo-500 border-t-transparent animate-spin inline-block" />
      Generating invoice…
    </div>
  );

  if (inv.genStatus === "error") return (
    <span className="text-xs" style={{ color: "#EF4444" }}>Invoice generation failed. Retry by changing status.</span>
  );

  if (inv.signedUrl || inv.signStatus === "done") return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: "#10B981" }}>✓ Signed invoice ready for buyer</span>
      <a href={`/api/orders/${orderId}/invoice/download`} download={`invoice-${orderId}.pdf`}
        className="text-xs px-3 py-1 rounded-md font-medium w-fit"
        style={{ background: "#F0FDF4", color: "#10B981", border: "1px solid #A7F3D0", textDecoration: "none" }}>
        ⬇ Download Signed Copy
      </a>
    </div>
  );

  if (inv.genStatus === "done" && inv.url) return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <a href={`/api/orders/${orderId}/invoice/download`} download={`invoice-${orderId}.pdf`}
          className="text-xs px-3 py-1 rounded-md font-medium"
          style={{ background: "#EEF2FF", color: A.accent, border: `1px solid ${A.accent}`, textDecoration: "none" }}>
          ⬇ Download Invoice (unsigned)
        </a>
      </div>
      <div className="text-xs" style={{ color: A.textMuted, borderTop: `1px dashed ${A.border}`, paddingTop: 6, marginTop: 4 }}>
        <span className="font-medium">Sign & Re-upload</span> — Download, sign, then upload the signed copy for the buyer.
      </div>
      {inv.signStatus === "uploading" ? (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: A.textMuted }}>
          <span className="w-3 h-3 rounded-full border border-indigo-500 border-t-transparent animate-spin inline-block" />
          Uploading signed invoice…
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try { await handleSignUpload(file); } catch { /* shown via signError */ }
              if (fileRef.current) fileRef.current.value = "";
            }} />
          <button onClick={() => fileRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-md font-medium"
            style={{ background: A.accent, color: "#fff", cursor: "pointer" }}>
            Upload Signed Invoice
          </button>
          {inv.signError && <span className="text-xs" style={{ color: "#EF4444" }}>{inv.signError}</span>}
        </div>
      )}
    </div>
  );

  return null;
}

// ── DeliverySection ───────────────────────────────────────────────────────────
function DeliverySection({
  orderId,
  deliveryStatus,
  assignedToId,
  deliveryNote,
  partners,
  busy,
  onPatch,
}: {
  orderId: string;
  deliveryStatus: string;
  assignedToId: string | null;
  deliveryNote: string;
  partners: Collab[];
  busy: boolean;
  onPatch: (payload: Record<string, unknown>) => void;
}) {
  const [localNote, setLocalNote] = useState(deliveryNote);

  // Keep localNote in sync if parent resets
  useEffect(() => { setLocalNote(deliveryNote); }, [deliveryNote]);

  const isCancelled = deliveryStatus === "cancelled";
  const currentIdx = DELIVERY_STEPS.indexOf(deliveryStatus as DeliveryStep);
  const showAssignment = !isCancelled && currentIdx >= 1; // confirmed or later

  return (
    <div className="mt-4 pt-4 border-t space-y-4" style={{ borderColor: "#f0f0f0" }}>
      <p className="text-xs font-semibold" style={{ color: A.textMuted }}>DELIVERY TRACKING</p>

      {/* ── Stepper ── */}
      {isCancelled ? (
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA" }}>
            Delivery cancelled
          </span>
          <button
            disabled={busy}
            onClick={() => onPatch({ deliveryStatus: "pending" })}
            className="text-xs px-2.5 py-1 rounded-md"
            style={{ border: `1px solid ${A.border}`, color: A.textMuted, cursor: "pointer" }}>
            Reset to pending
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {DELIVERY_STEPS.map((step, idx) => {
            const isCompleted = currentIdx > idx;
            const isActive = currentIdx === idx;
            const isNext = idx === currentIdx + 1;
            const isClickable = !busy && (isNext || (!isActive && idx <= currentIdx + 1));

            const circleColor = isCompleted
              ? "#10B981"
              : isActive
              ? A.accent
              : "#D1D5DB";

            const labelColor = isActive ? A.accent : isCompleted ? "#10B981" : A.textMuted;

            return (
              <div key={step} className="flex items-center">
                {/* Step pill */}
                <button
                  disabled={!isClickable}
                  onClick={() => isClickable && onPatch({ deliveryStatus: step })}
                  title={isClickable ? `Move to ${STEP_LABEL[step]}` : undefined}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    cursor: isClickable ? "pointer" : "default",
                    opacity: busy ? 0.6 : 1,
                    minWidth: 72,
                  }}>
                  {/* Circle */}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: isCompleted || isActive ? circleColor : "#F3F4F6",
                    border: `2px solid ${circleColor}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {isCompleted ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? "#fff" : "#9CA3AF" }}>
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  {/* Label */}
                  <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: labelColor, textAlign: "center", lineHeight: 1.2 }}>
                    {STEP_LABEL[step]}
                  </span>
                </button>

                {/* Connector line (not after last step) */}
                {idx < DELIVERY_STEPS.length - 1 && (
                  <div style={{
                    width: 20, height: 2, flexShrink: 0, marginBottom: 18,
                    background: currentIdx > idx ? "#10B981" : "#E5E7EB",
                    transition: "background 0.15s",
                  }} />
                )}
              </div>
            );
          })}

          {/* Cancel side-exit */}
          <button
            disabled={busy}
            onClick={() => onPatch({ deliveryStatus: "cancelled" })}
            className="text-xs px-2 py-1 rounded ml-3 mb-4 flex-shrink-0"
            style={{ border: "1px solid #FECACA", color: "#EF4444", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      )}

      {/* ── Assignment + note (confirmed or later, not cancelled) ── */}
      {showAssignment && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-start gap-4 flex-wrap">
            {/* Assignment dropdown */}
            <div className="flex flex-col gap-1" style={{ minWidth: 200 }}>
              <label className="text-xs font-medium" style={{ color: A.textMuted }}>Assigned to</label>
              <select
                disabled={busy}
                value={assignedToId ?? ""}
                onChange={(e) => onPatch({ assignedToId: e.target.value || null })}
                className="text-xs rounded-md px-2 py-1.5"
                style={{
                  border: `1px solid ${A.border}`, color: A.text,
                  background: "#fff", cursor: "pointer",
                }}>
                <option value="">Deliver myself</option>
                {partners.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.receiver.title} · {c.role.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              {assignedToId && (() => {
                const p = partners.find((c) => c.id === assignedToId);
                return p ? (
                  <span className="text-xs" style={{ color: A.accent }}>
                    → {p.receiver.title}
                  </span>
                ) : null;
              })()}
            </div>

            {/* Delivery note */}
            <div className="flex flex-col gap-1 flex-1" style={{ minWidth: 200 }}>
              <label className="text-xs font-medium" style={{ color: A.textMuted }}>Delivery note</label>
              <div className="flex gap-2 items-start">
                <textarea
                  rows={2}
                  disabled={busy}
                  value={localNote}
                  onChange={(e) => setLocalNote(e.target.value)}
                  placeholder="Instructions for the delivery person…"
                  className="flex-1 text-xs rounded-md px-2 py-1.5 resize-none"
                  style={{ border: `1px solid ${A.border}`, color: A.text, background: "#fff" }}
                />
                {localNote !== deliveryNote && (
                  <button
                    disabled={busy}
                    onClick={() => onPatch({ deliveryNote: localNote })}
                    className="text-xs px-2.5 py-1.5 rounded-md font-medium flex-shrink-0"
                    style={{ background: A.accent, color: "#fff", cursor: "pointer" }}>
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StoreOrdersPage() {
  const { id } = useParams<{ id: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [invoiceStates, setInvoiceStates] = useState<Record<string, InvoiceState>>({});

  // Delivery state — keyed by orderId
  const [deliveryStatuses, setDeliveryStatuses] = useState<Record<string, string>>({});
  const [assignedTos, setAssignedTos] = useState<Record<string, string | null>>({});
  const [deliveryNotes, setDeliveryNotes] = useState<Record<string, string>>({});
  const [updatingDelivery, setUpdatingDelivery] = useState<string | null>(null);

  // Collaboration partners for this store
  const [partners, setPartners] = useState<Collab[]>([]);

  // Load orders
  useEffect(() => {
    fetch(`/api/store/orders?storeId=${id}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data: Order[]) => {
        setOrders(data);

        // Invoice init (unchanged)
        const init: Record<string, InvoiceState> = {};
        for (const o of data) {
          if (o.invoiceSignedUrl) {
            init[o.id] = { genStatus: "done", url: o.invoiceUrl ?? undefined, signedUrl: o.invoiceSignedUrl, signStatus: "done" };
          } else if (o.invoiceUrl) {
            init[o.id] = { genStatus: "done", url: o.invoiceUrl, signStatus: "idle" };
          }
        }
        setInvoiceStates(init);

        // Delivery field init
        const dsMap: Record<string, string> = {};
        const atMap: Record<string, string | null> = {};
        const dnMap: Record<string, string> = {};
        for (const o of data) {
          dsMap[o.id] = o.deliveryStatus ?? "pending";
          atMap[o.id] = o.assignedToId ?? null;
          dnMap[o.id] = o.deliveryNote ?? "";
        }
        setDeliveryStatuses(dsMap);
        setAssignedTos(atMap);
        setDeliveryNotes(dnMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Load store pageId → accepted outbound partners
  useEffect(() => {
    fetch(`/api/store/${id}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((store) => {
        if (!store?.pageId) return;
        return fetch(
          `/api/collaboration?pageId=${store.pageId}&direction=out&status=accepted`,
          { credentials: "include" }
        )
          .then((r) => r.ok ? r.json() : [])
          .then((collabs: Collab[]) => setPartners(collabs));
      })
      .catch(() => {});
  }, [id]);

  function setInv(orderId: string, patch: Partial<InvoiceState>) {
    setInvoiceStates((prev) => ({ ...prev, [orderId]: { ...prev[orderId], ...patch } }));
  }

  async function updateStatus(orderId: string, status: string) {
    setUpdating(orderId);
    const res = await fetch(`/api/store/orders/${orderId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
      if (status === "delivered") {
        setInv(orderId, { genStatus: "loading", signStatus: "idle" });
        try {
          const r = await fetch(`/api/orders/${orderId}/invoice`, { method: "POST", credentials: "include" });
          if (r.ok) {
            const d = await r.json();
            setInv(orderId, { genStatus: "done", url: d.invoiceUrl, signStatus: "idle" });
          } else {
            setInv(orderId, { genStatus: "error", signStatus: "idle" });
          }
        } catch {
          setInv(orderId, { genStatus: "error", signStatus: "idle" });
        }
      }
    }
    setUpdating(null);
  }

  async function patchDelivery(orderId: string, payload: Record<string, unknown>) {
    setUpdatingDelivery(orderId);
    const res = await fetch(`/api/order/${orderId}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      if ("deliveryStatus" in payload)
        setDeliveryStatuses((prev) => ({ ...prev, [orderId]: payload.deliveryStatus as string }));
      if ("assignedToId" in payload)
        setAssignedTos((prev) => ({ ...prev, [orderId]: (payload.assignedToId as string | null) ?? null }));
      if ("deliveryNote" in payload)
        setDeliveryNotes((prev) => ({ ...prev, [orderId]: (payload.deliveryNote as string) ?? "" }));
    }
    setUpdatingDelivery(null);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
      <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: A.bg }}>
      <div className="sticky top-0 z-10 px-6 py-4 border-b bg-white" style={{ borderColor: A.border }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: A.text }}>Orders</h1>
            <p className="text-xs" style={{ color: A.textMuted }}>{orders.length} total orders</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/store/${id}/orders/delivered`} className="text-xs px-3 py-1.5 rounded-md font-medium"
              style={{ background: "#F0FDF4", color: "#10B981", border: "1px solid #A7F3D0" }}>
              Delivered Orders →
            </a>
            <a href={`/store/${id}`} className="text-xs px-3 py-1.5 rounded-md"
              style={{ border: `1px solid ${A.border}`, color: A.textMuted }}>
              ← Back to store
            </a>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl mb-2">📦</p>
            <p className="text-sm" style={{ color: A.textMuted }}>No orders yet.</p>
          </div>
        ) : orders.map((order) => {
          const inv = invoiceStates[order.id];
          return (
            <div key={order.id} className="bg-white rounded-xl p-5 shadow-sm" style={{ border: `1px solid ${A.border}` }}>
              {/* ── Header ── */}
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold" style={{ color: A.text }}>#{order.id.slice(-8).toUpperCase()}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${STATUS_COLORS[order.status]}20`, color: STATUS_COLORS[order.status] ?? A.textMuted }}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: A.textMuted }}>
                    {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color: A.text }}>₹{order.total.toLocaleString("en-IN")}</div>
                  <div className="text-xs" style={{ color: A.textMuted }}>Cash on Delivery</div>
                </div>
              </div>

              {/* ── Items / Customer / Address grid ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <p className="text-xs font-semibold mb-2" style={{ color: A.textMuted }}>ITEMS</p>
                  <div className="space-y-1">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span style={{ color: A.text }}>{item.title} ×{item.quantity}</span>
                        <span style={{ color: A.textMuted }}>₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: A.textMuted }}>CUSTOMER</p>
                  <p className="text-xs" style={{ color: A.text }}>{order.user.name ?? "—"}</p>
                  <p className="text-xs" style={{ color: A.textMuted }}>{order.user.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: A.textMuted }}>DELIVERY</p>
                  <p className="text-xs" style={{ color: A.text }}>{order.address.name}</p>
                  <p className="text-xs" style={{ color: A.textMuted }}>{order.address.line1}</p>
                  <p className="text-xs" style={{ color: A.textMuted }}>{order.address.city}, {order.address.state} {order.address.pincode}</p>
                  <p className="text-xs" style={{ color: A.textMuted }}>📞 {order.address.phone}</p>
                </div>
              </div>

              {/* ── Delivery tracking section ── */}
              <DeliverySection
                orderId={order.id}
                deliveryStatus={deliveryStatuses[order.id] ?? "pending"}
                assignedToId={assignedTos[order.id] ?? null}
                deliveryNote={deliveryNotes[order.id] ?? ""}
                partners={partners}
                busy={updatingDelivery === order.id}
                onPatch={(payload) => patchDelivery(order.id, payload)}
              />

              {/* ── Invoice section — only for delivered orders ── */}
              {order.status === "delivered" && inv && (
                <div className="mt-4 pt-3 border-t" style={{ borderColor: "#f0f0f0" }}>
                  <InvoiceSection
                    orderId={order.id}
                    inv={inv}
                    onSignUpload={(url) => setInv(order.id, { signedUrl: url, signStatus: "done" })}
                  />
                </div>
              )}

              {/* ── Order status buttons (existing, unchanged) ── */}
              <div className="mt-4 pt-4 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: "#f0f0f0" }}>
                <span className="text-xs" style={{ color: A.textMuted }}>Update status:</span>
                {["pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => (
                  <button key={s} disabled={order.status === s || updating === order.id}
                    onClick={() => updateStatus(order.id, s)}
                    className="text-xs px-2 py-1 rounded capitalize"
                    style={{
                      background: order.status === s ? `${STATUS_COLORS[s]}20` : "#f9fafb",
                      color: order.status === s ? STATUS_COLORS[s] : A.textMuted,
                      border: `1px solid ${order.status === s ? STATUS_COLORS[s] : A.border}`,
                      cursor: order.status === s ? "default" : "pointer",
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
