"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const A = {
  bg: "#E3E6E6", nav: "#131921", border: "#DDDDDD",
  text: "#0F1111", textMuted: "#565959", accent: "#6366f1",
};

type OrderItem = { blockId: string; title: string; price: number; quantity: number };
type Address = { name: string; phone: string; line1: string; city: string; state: string; pincode: string };
type CollabPage = { id: string; title: string; pageType: string };
type Collab = { id: string; role: string; requester: CollabPage; receiver: CollabPage };
type Order = {
  id: string; status: string; total: number; createdAt: string;
  deliveryStatus?: string | null;
  assignedToId?: string | null;
  deliveryNote?: string | null;
  partnerStatus?: string | null;
  invoiceUrl?: string | null;
  invoiceSignedUrl?: string | null;
  items: OrderItem[];
  address: Address;
  user: { name: string | null; email: string | null };
  store: { id: string; slug?: string | null; name: string };
  requiresAttention?: boolean;
  activeStep?: { stepName: string } | null;
};

type InvoiceState = {
  genStatus: "idle" | "loading" | "done" | "error";
  url?: string;
  signedUrl?: string;
  signStatus: "idle" | "uploading" | "done" | "error";
  signError?: string;
};

const DELIVERY_STEPS = ["pending", "confirmed", "processing", "out_for_delivery", "delivered"] as const;

const DELIVERY_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const DELIVERY_COLORS: Record<string, string> = {
  pending: "#6B7280",
  confirmed: "#2563EB",
  processing: "#D97706",
  out_for_delivery: "#7C3AED",
  delivered: "#16A34A",
  cancelled: "#DC2626",
};

const PARTNER_STATUS_LABELS: Record<string, string> = {
  assigned: "Pending acceptance",
  accepted: "Partner accepted ✓",
  rejected: "Partner rejected — reassign",
  completed: "Delivered by partner",
};

const PARTNER_STATUS_COLORS: Record<string, string> = {
  assigned: "#D97706",
  accepted: "#16A34A",
  rejected: "#DC2626",
  completed: "#2563EB",
};

const PARTNER_STATUS_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  assigned:  { label: "Pending acceptance",  bg: "#FFFBEB", color: "#D97706", border: "#FCD34D" },
  accepted:  { label: "Partner accepted ✓",  bg: "#F0FDF4", color: "#16A34A", border: "#86EFAC" },
  rejected:  { label: "Partner rejected — reassign", bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  completed: { label: "Delivered by partner", bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

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
      <a href={`/api/orders/${orderId}/invoice/download`} download={`invoice-${orderId}.pdf`}
        className="text-xs px-3 py-1 rounded-md font-medium"
        style={{ background: "#EEF2FF", color: A.accent, border: `1px solid ${A.accent}`, textDecoration: "none" }}>
        ⬇ Download Invoice (unsigned)
      </a>
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
              try { await handleSignUpload(file); } catch {}
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

function DeliveryNoteInline({ note, busy, onSave }: {
  note: string;
  busy: boolean;
  onSave: (note: string) => void;
}) {
  const [local, setLocal] = useState(note);
  useEffect(() => setLocal(note), [note]);
  return (
    <div className="flex flex-col gap-1 flex-1" style={{ minWidth: 200 }}>
      <label className="text-xs font-medium" style={{ color: A.textMuted }}>Delivery note</label>
      <div className="flex gap-2 items-start">
        <textarea
          rows={2}
          disabled={busy}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Instructions for the delivery person…"
          className="flex-1 text-xs rounded-md px-2 py-1.5 resize-none"
          style={{ border: `1px solid ${A.border}`, color: A.text, background: "#fff" }}
        />
        {local !== note && (
          <button
            disabled={busy}
            onClick={() => onSave(local)}
            className="text-xs px-2.5 py-1.5 rounded-md font-medium flex-shrink-0"
            style={{ background: A.accent, color: "#fff", cursor: "pointer" }}>
            Save
          </button>
        )}
      </div>
    </div>
  );
}

export default function AllOrdersPage() {
  const searchParams = useSearchParams();
  const storeId = searchParams?.get("storeId") ?? null;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [invoiceStates, setInvoiceStates] = useState<Record<string, InvoiceState>>({});
  const [filter, setFilter] = useState("all");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [updatingDelivery, setUpdatingDelivery] = useState<string | null>(null);
  const [partnersByStoreId, setPartnersByStoreId] = useState<Record<string, Collab[]>>({});

  useEffect(() => {
    const url = storeId
      ? `/api/store/orders?storeId=${encodeURIComponent(storeId)}`
      : "/api/store/orders?all=true";
    fetch(url, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data: Order[]) => {
        setOrders(data);
        const init: Record<string, InvoiceState> = {};
        for (const o of data) {
          if (o.invoiceSignedUrl) {
            init[o.id] = { genStatus: "done", url: o.invoiceUrl ?? undefined, signedUrl: o.invoiceSignedUrl, signStatus: "done" };
          } else if (o.invoiceUrl) {
            init[o.id] = { genStatus: "done", url: o.invoiceUrl, signStatus: "idle" };
          }
        }
        setInvoiceStates(init);

        // Load collaboration partners for each unique store
        const uniqueStoreIds = [...new Set(data.map((o) => o.store.id))];
        for (const sid of uniqueStoreIds) {
          fetch(`/api/store/${sid}`, { credentials: "include" })
            .then((r) => r.ok ? r.json() : null)
            .then((store: any) => {
              if (!store?.pageId) return;
              return fetch(`/api/collaboration?pageId=${store.pageId}&direction=out&status=accepted`, { credentials: "include" })
                .then((r) => r.ok ? r.json() : [])
                .then((collabs: Collab[]) => setPartnersByStoreId((prev) => ({ ...prev, [sid]: collabs })));
            })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [storeId]);

  function setInv(orderId: string, patch: Partial<InvoiceState>) {
    setInvoiceStates((prev) => ({ ...prev, [orderId]: { ...prev[orderId], ...patch } }));
  }

  async function updateDeliveryStatus(orderId: string, deliveryStatus: string) {
    setUpdating(orderId);
    const res = await fetch(`/api/order/${orderId}/delivery`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ deliveryStatus }),
    });
    if (res.ok) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, deliveryStatus } : o));
      if (deliveryStatus === "delivered") {
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

  async function advanceStatus(orderId: string, newStatus: string) {
    const prev = orders.find((o) => o.id === orderId)?.deliveryStatus ?? "pending";
    setOrders((p) => p.map((o) => o.id === orderId ? { ...o, deliveryStatus: newStatus } : o));
    const res = await fetch(`/api/order/${orderId}/delivery`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ deliveryStatus: newStatus }),
    });
    if (!res.ok) {
      setOrders((p) => p.map((o) => o.id === orderId ? { ...o, deliveryStatus: prev } : o));
      setErrors((p) => ({ ...p, [orderId]: "Status update failed — try again." }));
      setTimeout(() => setErrors((p) => { const e = { ...p }; delete e[orderId]; return e; }), 3000);
    }
  }

  async function patchDelivery(orderId: string, payload: Record<string, unknown>) {
    setUpdatingDelivery(orderId);
    const res = await fetch(`/api/order/${orderId}/delivery`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify(payload),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrders((prev) => prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          ...("assignedToId" in payload && { assignedToId: payload.assignedToId as string | null }),
          ...("deliveryNote" in payload && { deliveryNote: payload.deliveryNote as string | null }),
          partnerStatus: updated.partnerStatus ?? o.partnerStatus,
        };
      }));
    }
    setUpdatingDelivery(null);
  }

  const filteredOrders = filter === "all"
    ? orders
    : orders.filter((o) => (o.deliveryStatus ?? "pending") === filter);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
      <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: A.bg }}>
      <div className="sticky top-0 z-10 px-6 py-4 border-b bg-white" style={{ borderColor: A.border }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold" style={{ color: A.text }}>All Orders</h1>
              <p className="text-xs" style={{ color: A.textMuted }}>
                {filteredOrders.length}{filter !== "all" ? ` ${filter.replace(/_/g, " ")}` : ""} order{filteredOrders.length !== 1 ? "s" : ""}
                {storeId ? " for this store" : " across all stores"}
              </p>
            </div>
            <a href="/store/account" className="text-xs px-3 py-1.5 rounded-md"
              style={{ border: `1px solid ${A.border}`, color: A.textMuted }}>
              ← My Account
            </a>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTER_TABS.map((tab) => (
              <button key={tab.key} onClick={() => setFilter(tab.key)}
                className="text-xs px-3 py-1 rounded-full whitespace-nowrap"
                style={{
                  background: filter === tab.key ? A.accent : "#f3f4f6",
                  color: filter === tab.key ? "#fff" : A.textMuted,
                  border: `1px solid ${filter === tab.key ? A.accent : A.border}`,
                }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl mb-2">📦</p>
            <p className="text-sm" style={{ color: A.textMuted }}>No orders yet across any store.</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: A.textMuted }}>No {filter.replace(/_/g, " ")} orders.</p>
          </div>
        ) : filteredOrders.map((order) => {
          const inv = invoiceStates[order.id];
          return (
            <div key={order.id} className="bg-white rounded-xl p-5 shadow-sm" style={{ border: `1px solid ${A.border}` }}>
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold" style={{ color: A.text }}>#{order.id.slice(-8).toUpperCase()}</span>
                    {/* requiresAttention red dot */}
                    {order.requiresAttention && (
                      <span title="Action required" style={{
                        display: "inline-block", width: 8, height: 8,
                        borderRadius: "50%", background: "#EF4444", flexShrink: 0,
                      }} />
                    )}
                    {(() => {
                      const ds = order.deliveryStatus ?? "pending";
                      const color = DELIVERY_COLORS[ds] ?? A.textMuted;
                      return (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${color}20`, color }}>
                          {DELIVERY_LABELS[ds] ?? ds}
                        </span>
                      );
                    })()}
                    {order.assignedToId && order.partnerStatus && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: `${PARTNER_STATUS_COLORS[order.partnerStatus] ?? "#6B7280"}15`,
                          color: PARTNER_STATUS_COLORS[order.partnerStatus] ?? A.textMuted,
                        }}>
                        {PARTNER_STATUS_LABELS[order.partnerStatus] ?? order.partnerStatus}
                      </span>
                    )}
                    {/* Active workflow step chip */}
                    {order.activeStep && (
                      <span className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}>
                        {order.activeStep.stepName}
                      </span>
                    )}
                    <a href={`/store/${order.store.slug ?? order.store.id}`}
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{ background: "#EEF2FF", color: A.accent, textDecoration: "none" }}>
                      {order.store.name}
                    </a>
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

              {order.deliveryStatus === "delivered" && inv && (
                <div className="mt-4 pt-3 border-t" style={{ borderColor: "#f0f0f0" }}>
                  <InvoiceSection
                    orderId={order.id}
                    inv={inv}
                    onSignUpload={(url) => setInv(order.id, { signedUrl: url, signStatus: "done" })}
                  />
                </div>
              )}

              {/* ── Status bar + actions ── */}
              <div className="mt-4 pt-4 border-t flex items-center justify-between flex-wrap gap-3" style={{ borderColor: "#f0f0f0" }}>
                {/* Status pipeline — next step pill is clickable to advance */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    {DELIVERY_STEPS.map((s, idx) => {
                      const current = order.deliveryStatus ?? "pending";
                      const currentIdx = DELIVERY_STEPS.indexOf(current as typeof DELIVERY_STEPS[number]);
                      const isCompleted = currentIdx > idx;
                      const isActive    = current === s;
                      const isNext      = currentIdx + 1 === idx && current !== "cancelled" && current !== "delivered";
                      const color       = DELIVERY_COLORS[s];
                      return (
                        <span key={s} className="flex items-center gap-1">
                          {idx > 0 && (
                            <span style={{ color: isCompleted ? DELIVERY_COLORS.delivered : A.border, fontSize: 10 }}>›</span>
                          )}
                          {isNext ? (
                            <button
                              onClick={() => advanceStatus(order.id, s)}
                              title={`Advance to ${DELIVERY_LABELS[s]}`}
                              className="text-xs px-2 py-0.5 rounded"
                              style={{
                                background: `${color}15`, color, fontWeight: 500,
                                border: `1px dashed ${color}`, cursor: "pointer",
                              }}>
                              {DELIVERY_LABELS[s]} +
                            </button>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded"
                              style={{
                                background: isActive ? `${color}20` : isCompleted ? `${DELIVERY_COLORS.delivered}10` : "#f9fafb",
                                color:      isActive ? color : isCompleted ? DELIVERY_COLORS.delivered : A.textMuted,
                                fontWeight: isActive ? 600 : 400,
                                border:     `1px solid ${isActive ? color : "transparent"}`,
                              }}>
                              {isCompleted ? "✓ " : ""}{DELIVERY_LABELS[s]}
                            </span>
                          )}
                        </span>
                      );
                    })}
                    {order.deliveryStatus === "cancelled" && (
                      <span className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: `${DELIVERY_COLORS.cancelled}20`, color: DELIVERY_COLORS.cancelled }}>
                        Cancelled
                      </span>
                    )}
                  </div>
                  {errors[order.id] && (
                    <p className="text-xs mt-0.5" style={{ color: "#EF4444" }}>{errors[order.id]}</p>
                  )}
                </div>

                {/* Actions: Cancel only */}
                <div className="flex items-center gap-2 shrink-0">
                  {order.deliveryStatus !== "cancelled" && order.deliveryStatus !== "delivered" && (
                    <button
                      disabled={updating === order.id}
                      onClick={() => updateDeliveryStatus(order.id, "cancelled")}
                      className="text-xs px-2.5 py-1 rounded"
                      style={{ border: "1px solid #FECACA", color: "#EF4444", background: "#fff", cursor: "pointer" }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* ── Delivery partner assignment — confirmed or later ── */}
              {(() => {
                const ds = order.deliveryStatus ?? "pending";
                const dsIdx = DELIVERY_STEPS.indexOf(ds as typeof DELIVERY_STEPS[number]);
                if (dsIdx < 1 || ds === "cancelled" || ds === "delivered") return null;
                const orderPartners = partnersByStoreId[order.store.id] ?? [];
                const busy = updatingDelivery === order.id;
                const badge = order.partnerStatus ? PARTNER_STATUS_BADGE[order.partnerStatus] : null;
                return (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: "#f0f0f0" }}>
                    <p className="text-xs font-semibold mb-3" style={{ color: A.textMuted }}>DELIVERY PARTNER</p>
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex flex-col gap-1" style={{ minWidth: 200 }}>
                        <label className="text-xs font-medium" style={{ color: A.textMuted }}>Assigned to</label>
                        <select
                          disabled={busy}
                          value={order.assignedToId ?? ""}
                          onChange={(e) => patchDelivery(order.id, { assignedToId: e.target.value || null })}
                          className="text-xs rounded-md px-2 py-1.5"
                          style={{ border: `1px solid ${A.border}`, color: A.text, background: "#fff", cursor: "pointer" }}
                        >
                          <option value="">Deliver myself</option>
                          {orderPartners.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.receiver.title} · {c.role.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                        {order.assignedToId && badge && (
                          <span className="text-xs px-2 py-0.5 rounded-full w-fit"
                            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <DeliveryNoteInline
                        note={order.deliveryNote ?? ""}
                        busy={busy}
                        onSave={(note) => patchDelivery(order.id, { deliveryNote: note })}
                      />
                    </div>
                  </div>
                );
              })()}

            </div>
          );
        })}
      </main>
    </div>
  );
}
