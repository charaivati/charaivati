"use client";

import { Component, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const A = {
  bg: "#E3E6E6", nav: "#131921", border: "#DDDDDD",
  text: "#0F1111", textMuted: "#565959", accent: "#6366f1",
};

type OrderItem = { blockId: string; title: string; price: number; quantity: number };
type Address = { name: string; phone: string; line1: string; city: string; state: string; pincode: string };

// Pool types — one entry per assignable person/business for a store
type TeamMemberEntry = { kind: "user"; collabId: string; userId: string; label: string };
type PartnerEntry    = { kind: "page"; collabId: string; label: string; role: string };
type Pool = { teamMembers: TeamMemberEntry[]; partners: PartnerEntry[] };

type Order = {
  id: string; status: string; total: number; createdAt: string;
  deliveryStatus?: string | null;
  vehicleId?: string | null;
  assignedToId?: string | null;
  assignedToUserId?: string | null;  // set when assigned via { userId } path
  deliveryNote?: string | null;
  partnerStatus?: string | null;
  invoiceUrl?: string | null;
  invoiceSignedUrl?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentRef?: string | null;
  paymentProofUrl?: string | null;
  items: OrderItem[];
  address: Address;
  user: { name: string | null; email: string | null };
  store: { id: string; slug?: string | null; name: string; deleted?: boolean };
  requiresAttention?: boolean;
  activeStep?: { stepName: string; assigneeName?: string | null } | null;
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

class OrderCardBoundary extends Component<{ children: React.ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  componentDidCatch() { this.setState({ crashed: true }); }
  render() {
    if (this.state.crashed) return (
      <div className="bg-white rounded-xl p-4 shadow-sm text-xs"
        style={{ border: "1px solid #FECACA", color: "#EF4444" }}>
        Couldn't load this order — data may be incomplete.
      </div>
    );
    return this.props.children;
  }
}

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
            className="text-xs px-2.5 py-1.5 rounded-md font-medium flex-shrink-0 flex items-center gap-1.5"
            style={{ background: A.accent, color: "#fff", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy && <span className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin inline-block" />}
            {busy ? "Saving…" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AllOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams?.get("storeId") ?? null;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [invoiceStates, setInvoiceStates] = useState<Record<string, InvoiceState>>({});
  const [filter, setFilter] = useState("all");
  const [updatingDelivery, setUpdatingDelivery] = useState<string | null>(null);
  const [poolByStoreId, setPoolByStoreId] = useState<Record<string, Pool>>({});
  const [verifyingPay, setVerifyingPay] = useState<string | null>(null);

  async function markPaymentReceived(orderId: string) {
    if (verifyingPay === orderId) return;
    setVerifyingPay(orderId);
    try {
      const r = await fetch(`/api/order/${orderId}/payment`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ paymentStatus: "verified" }),
      });
      if (r.ok) refreshOrders();
    } finally { setVerifyingPay(null); }
  }

  // Lightweight orders-only refresh — used by SSE handler (skips expensive pool reload)
  const refreshOrders = useCallback(async () => {
    const url = storeId
      ? `/api/store/orders?storeId=${encodeURIComponent(storeId)}`
      : "/api/store/orders?all=true";
    try {
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) setOrders(await res.json());
    } catch {}
  }, [storeId]);

  const refreshOrdersRef = useRef(refreshOrders);
  useEffect(() => { refreshOrdersRef.current = refreshOrders; }, [refreshOrders]);

  // SSE auto-refresh: reload orders whenever the server pushes a notification event.
  // Stream payload is { notifications[], unreadCount } — refresh on any message.
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      try {
        es = new EventSource("/api/notifications/stream", { withCredentials: true });
        es.onmessage = () => { refreshOrdersRef.current(); };
        es.onerror = () => {
          es?.close();
          es = null;
          retryTimer = setTimeout(connect, 10000);
        };
      } catch { /* SSE unavailable — page works without it */ }
    }
    connect();

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        es?.close();
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        connect();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

        // Load the full assignee pool (team members + partners) for each unique store
        const uniqueStoreIds = [...new Set(data.map((o) => o.store.id))];
        for (const sid of uniqueStoreIds) {
          fetch(`/api/store/${sid}`, { credentials: "include" })
            .then((r) => r.ok ? r.json() : null)
            .then(async (store: any) => {
              if (!store?.pageId) return;
              const pageId: string = store.pageId;
              const [teamRes, collabRes] = await Promise.all([
                fetch(`/api/initiative/${pageId}/team`, { credentials: "include" }),
                fetch(`/api/collaboration?pageId=${pageId}&direction=out&status=accepted`, { credentials: "include" }),
              ]);
              const teamData = teamRes.ok ? await teamRes.json() : { members: [] };
              const collabs  = collabRes.ok ? await collabRes.json() : [];

              // User-type collabs (receiverUserId set) → Team Members group
              const teamMembers: TeamMemberEntry[] = (teamData.members ?? [])
                .filter((m: any) => !!m.receiverUserId && !!m.receiverUser)
                .map((m: any): TeamMemberEntry => ({
                  kind: "user",
                  collabId: m.id,
                  userId:   m.receiverUserId as string,
                  label:    (m.receiverUser?.name ?? "Team Member") as string,
                }));

              // Page-type collabs (receiverPage set) → Partners group
              const partners: PartnerEntry[] = (collabs as any[])
                .filter((c: any) => !!c.receiverPage)
                .map((c: any): PartnerEntry => ({
                  kind:     "page",
                  collabId: c.id as string,
                  label:    (c.receiverPage?.title ?? "Partner") as string,
                  role:     (c.role as string).replace(/_/g, " "),
                }));

              setPoolByStoreId((prev) => ({ ...prev, [sid]: { teamMembers, partners } }));
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
          // Page-type collab assignment: { assignedToId } — clears user-type
          ...("assignedToId" in payload && {
            assignedToId:     payload.assignedToId as string | null,
            assignedToUserId: null,
          }),
          // User-type (team member) assignment: { userId } — clears collab-type
          ...("userId" in payload && {
            assignedToUserId: payload.userId as string | null,
            assignedToId:     null,
          }),
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
            <button onClick={() => router.back()} className="text-xs px-3 py-1.5 rounded-md"
              style={{ border: `1px solid ${A.border}`, color: A.textMuted }}>
              ← Back
            </button>
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
            <OrderCardBoundary key={order.id}>
            <div className="bg-white rounded-xl p-5 shadow-sm" style={{ border: `1px solid ${A.border}` }}>
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
                      <a href={`/store/${order.store.slug ?? order.store.id}/orders`}
                        title="Manage this step on the store's order page"
                        className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0", textDecoration: "none" }}>
                        {order.activeStep.stepName} →
                      </a>
                    )}
                    <a href={`/store/${order.store.slug ?? order.store.id}`}
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={{ background: "#EEF2FF", color: A.accent, textDecoration: "none" }}>
                      {order.store.name}
                    </a>
                    {order.store.deleted && (
                      <span className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: "#F1F5F9", color: "#94A3B8", border: "1px solid #E2E8F0" }}
                        title="This store has been deleted by its owner — historic order, read-only">
                        Store closed
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: A.textMuted }}>
                    {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color: A.text }}>₹{order.total.toLocaleString("en-IN")}</div>
                  <div className="text-xs" style={{ color: A.textMuted }}>
                    {order.paymentMethod === "upi" ? "📲 Paid via UPI" : "💵 Cash on Delivery"}
                  </div>
                </div>
              </div>

              {order.paymentMethod === "upi" && (
                <div className="mb-4 px-3 py-2 rounded-lg flex flex-wrap items-center gap-3"
                  style={{ background: order.paymentStatus === "verified" ? "#F0FDF4" : "#FFFBEB", border: `1px solid ${order.paymentStatus === "verified" ? "#86EFAC" : "#FDE68A"}` }}>
                  <span className="text-xs font-semibold" style={{ color: order.paymentStatus === "verified" ? "#16A34A" : "#B45309" }}>
                    {order.paymentStatus === "verified" ? "✓ Payment confirmed" : "⏳ Payment claimed — confirm in your UPI app"}
                  </span>
                  {order.paymentRef && <span className="text-xs font-mono" style={{ color: A.text }}>Ref: {order.paymentRef}</span>}
                  {order.paymentProofUrl && (
                    <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: A.accent }}>View screenshot</a>
                  )}
                  {order.paymentStatus !== "verified" && (
                    <button onClick={() => markPaymentReceived(order.id)} disabled={verifyingPay === order.id}
                      className="text-xs px-3 py-1 rounded-md font-semibold ml-auto"
                      style={{ background: "#16A34A", color: "#fff", opacity: verifyingPay === order.id ? 0.6 : 1 }}>
                      {verifyingPay === order.id ? "Saving…" : "Mark payment received ✓"}
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <p className="text-xs font-semibold mb-2" style={{ color: A.textMuted }}>ITEMS</p>
                  <div className="space-y-1">
                    {(order.items ?? []).filter(Boolean).map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span style={{ color: A.text }}>{item?.title ?? "Item"} ×{item?.quantity ?? 0}</span>
                        <span style={{ color: A.textMuted }}>₹{((item?.price ?? 0) * (item?.quantity ?? 0)).toLocaleString("en-IN")}</span>
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

              {/* ── Status bar (read-only — A is a cross-store monitor, not a confirm surface) + actions ── */}
              <div className="mt-4 pt-4 border-t flex items-center justify-between flex-wrap gap-3" style={{ borderColor: "#f0f0f0" }}>
                {/* Status pipeline — display-only; advancing status happens via the workflow on the per-store order page */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    {DELIVERY_STEPS.map((s, idx) => {
                      const current = order.deliveryStatus ?? "pending";
                      const currentIdx = DELIVERY_STEPS.indexOf(current as typeof DELIVERY_STEPS[number]);
                      const isCompleted = currentIdx > idx;
                      const isActive    = current === s;
                      const color       = DELIVERY_COLORS[s];
                      return (
                        <span key={s} className="flex items-center gap-1">
                          {idx > 0 && (
                            <span style={{ color: isCompleted ? DELIVERY_COLORS.delivered : A.border, fontSize: 10 }}>›</span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded"
                            style={{
                              background: isActive ? `${color}20` : isCompleted ? `${DELIVERY_COLORS.delivered}10` : "#f9fafb",
                              color:      isActive ? color : isCompleted ? DELIVERY_COLORS.delivered : A.textMuted,
                              fontWeight: isActive ? 600 : 400,
                              border:     `1px solid ${isActive ? color : "transparent"}`,
                            }}>
                            {isCompleted ? "✓ " : ""}{DELIVERY_LABELS[s]}
                          </span>
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
                </div>

                {/* Actions: Cancel only */}
                <div className="flex items-center gap-2 shrink-0">
                  {order.deliveryStatus !== "cancelled" && order.deliveryStatus !== "delivered" && (
                    <button
                      disabled={updating === order.id}
                      onClick={() => updateDeliveryStatus(order.id, "cancelled")}
                      className="text-xs px-2.5 py-1 rounded flex items-center gap-1.5"
                      style={{ border: "1px solid #FECACA", color: "#EF4444", background: "#fff", cursor: updating === order.id ? "not-allowed" : "pointer", opacity: updating === order.id ? 0.7 : 1 }}>
                      {updating === order.id && <span className="w-3 h-3 rounded-full border border-red-500 border-t-transparent animate-spin inline-block" />}
                      {updating === order.id ? "Cancelling…" : "Cancel"}
                    </button>
                  )}
                </div>
              </div>

              {/* ── Delivery partner assignment — confirmed or later ── */}
              {(() => {
                const ds = order.deliveryStatus ?? "pending";
                const dsIdx = DELIVERY_STEPS.indexOf(ds as typeof DELIVERY_STEPS[number]);
                if (dsIdx < 1 || ds === "cancelled" || ds === "delivered") return null;

                const pool = poolByStoreId[order.store.id] ?? { teamMembers: [], partners: [] };
                const busy = updatingDelivery === order.id;
                const badge = order.partnerStatus ? PARTNER_STATUS_BADGE[order.partnerStatus] : null;
                const storeOrdersHref = `/store/${order.store.slug ?? order.store.id}/orders`;

                // Resolve who is currently assigned for the green card display.
                // assignedToId/assignedToUserId are written ONLY by the delivery dispatch
                // path (assignNextPartner / manual delivery assignment) — they are never
                // set for normal-step assignment, which lives on OSP.currentAssigneeId
                // (surfaced here as activeStep.assigneeName). Reading the legacy fields
                // for a normal-step order produces a misleading "Unassigned".
                const assignedPageEntry = order.assignedToId
                  ? pool.partners.find((p) => p.collabId === order.assignedToId) ?? null
                  : null;
                const assignedUserEntry = order.assignedToUserId
                  ? pool.teamMembers.find((m) => m.userId === order.assignedToUserId) ?? null
                  : null;
                const assignedLabel  = assignedPageEntry?.label ?? assignedUserEntry?.label ?? null;
                const assignedSublbl = assignedPageEntry?.role  ?? (assignedUserEntry ? "Team Member" : null);

                const hasLegacyAssignment = !!(order.assignedToId || order.assignedToUserId);

                // No legacy delivery assignment, but the workflow has an active step —
                // this order is being driven by the OSP layer (most likely a normal step,
                // auto-assigned via assignNormalStep). Show what the engine actually did,
                // read-only, and funnel the owner to the per-store page to act on it.
                if (!hasLegacyAssignment && order.activeStep) {
                  return (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: "#f0f0f0" }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: A.textMuted }}>ASSIGNED VIA WORKFLOW</p>
                      <div className="p-2.5 rounded-lg flex items-center justify-between gap-3 flex-wrap"
                        style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                        <p className="text-xs" style={{ color: A.text }}>
                          {order.activeStep.assigneeName
                            ? <>Currently with <span className="font-semibold">{order.activeStep.assigneeName}</span> on <span className="font-medium">{order.activeStep.stepName}</span></>
                            : <>Auto-assigned by the <span className="font-medium">{order.activeStep.stepName}</span> step</>}
                        </p>
                        <a href={storeOrdersHref}
                          className="text-xs px-2.5 py-1 rounded-md font-medium"
                          style={{ background: "#EEF2FF", color: A.accent, textDecoration: "none" }}>
                          Manage on store page →
                        </a>
                      </div>
                      {order.deliveryNote && (
                        <p className="text-xs mt-2" style={{ color: A.textMuted }}>
                          <span className="font-medium" style={{ color: A.text }}>Note:</span> {order.deliveryNote}
                        </p>
                      )}
                    </div>
                  );
                }

                // Encode current assignment as a prefixed string for the select value
                const selectValue = order.assignedToUserId
                  ? `user::${order.assignedToUserId}`
                  : order.assignedToId
                    ? `page::${order.assignedToId}`
                    : "";

                function handleAssign(raw: string) {
                  if (!raw) {
                    // Empty → unassign (clears both fields server-side)
                    patchDelivery(order.id, { assignedToId: null });
                  } else if (raw.startsWith("user::")) {
                    // Team member — backend path: { userId }
                    patchDelivery(order.id, { userId: raw.slice(6) });
                  } else if (raw.startsWith("page::")) {
                    // Partner — backend path: { assignedToId: collabId }
                    patchDelivery(order.id, { assignedToId: raw.slice(6) });
                  }
                }

                return (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: "#f0f0f0" }}>
                    <p className="text-xs font-semibold mb-3" style={{ color: A.textMuted }}>DELIVERY PARTNER</p>

                    {/* Currently-assigned green card */}
                    {assignedLabel && (
                      <div className="mb-3 p-2.5 rounded-lg flex items-center gap-3"
                        style={{ background: "#F0FDF4", border: "1px solid #86EFAC" }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "#14532D" }}>
                            {assignedLabel}
                          </p>
                          {assignedSublbl && (
                            <p className="text-xs" style={{ color: "#166534" }}>{assignedSublbl}</p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="flex flex-col gap-1" style={{ minWidth: 200 }}>
                        <label className="text-xs font-medium" style={{ color: A.textMuted }}>Assigned to</label>
                        <select
                          disabled={busy}
                          value={selectValue}
                          onChange={(e) => handleAssign(e.target.value)}
                          className="text-xs rounded-md px-2 py-1.5"
                          style={{ border: `1px solid ${A.border}`, color: A.text, background: "#fff", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1 }}
                        >
                          <option value="">— Unassigned —</option>
                          {pool.teamMembers.length > 0 && (
                            <optgroup label="Team Members">
                              {pool.teamMembers.map((m) => (
                                <option key={m.collabId} value={`user::${m.userId}`}>
                                  {m.label}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {pool.partners.length > 0 && (
                            <optgroup label="Partners">
                              {pool.partners.map((p) => (
                                <option key={p.collabId} value={`page::${p.collabId}`}>
                                  {p.label} · {p.role}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        {(order.assignedToId || order.assignedToUserId) && badge && (
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

              {/* ── Track partner (shown when partner GPS is live) ── */}
              {order.deliveryStatus === "out_for_delivery" && order.vehicleId &&
                (order.partnerStatus === "accepted" || order.partnerStatus === "assigned") && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: "#f0f0f0" }}>
                  <a
                    href={`/order/${order.id}/track`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold"
                    style={{ background: "#0F766E", color: "#fff", textDecoration: "none" }}
                  >
                    📍 Track partner →
                  </a>
                </div>
              )}

            </div>
            </OrderCardBoundary>
          );
        })}
      </main>
    </div>
  );
}
