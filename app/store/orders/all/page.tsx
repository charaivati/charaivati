"use client";

import { useEffect, useRef, useState } from "react";

const A = {
  bg: "#E3E6E6", nav: "#131921", border: "#DDDDDD",
  text: "#0F1111", textMuted: "#565959", accent: "#6366f1",
};

type OrderItem = { blockId: string; title: string; price: number; quantity: number };
type Address = { name: string; phone: string; line1: string; city: string; state: string; pincode: string };
type Order = {
  id: string; status: string; total: number; createdAt: string;
  deliveryStatus?: string | null;
  assignedToId?: string | null;
  partnerStatus?: string | null;
  invoiceUrl?: string | null;
  invoiceSignedUrl?: string | null;
  items: OrderItem[];
  address: Address;
  user: { name: string | null; email: string | null };
  store: { id: string; slug?: string | null; name: string };
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

export default function AllOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [invoiceStates, setInvoiceStates] = useState<Record<string, InvoiceState>>({});

  useEffect(() => {
    fetch("/api/store/orders?all=true", { credentials: "include" })
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
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
            <h1 className="text-lg font-bold" style={{ color: A.text }}>All Orders</h1>
            <p className="text-xs" style={{ color: A.textMuted }}>
              {orders.length} total order{orders.length !== 1 ? "s" : ""} across all stores
            </p>
          </div>
          <a href="/store/account?tab=stores" className="text-xs px-3 py-1.5 rounded-md"
            style={{ border: `1px solid ${A.border}`, color: A.textMuted }}>
            ← My Stores
          </a>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl mb-2">📦</p>
            <p className="text-sm" style={{ color: A.textMuted }}>No orders yet across any store.</p>
          </div>
        ) : orders.map((order) => {
          const inv = invoiceStates[order.id];
          return (
            <div key={order.id} className="bg-white rounded-xl p-5 shadow-sm" style={{ border: `1px solid ${A.border}` }}>
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold" style={{ color: A.text }}>#{order.id.slice(-8).toUpperCase()}</span>
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

              <div className="mt-4 pt-4 border-t" style={{ borderColor: "#f0f0f0" }}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs" style={{ color: A.textMuted }}>Delivery pipeline:</span>
                  {DELIVERY_STEPS.map((s) => {
                    const current = order.deliveryStatus ?? "pending";
                    const isActive = current === s;
                    const color = DELIVERY_COLORS[s];
                    return (
                      <button key={s}
                        disabled={isActive || updating === order.id || order.deliveryStatus === "cancelled"}
                        onClick={() => updateDeliveryStatus(order.id, s)}
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          background: isActive ? `${color}20` : "#f9fafb",
                          color: isActive ? color : A.textMuted,
                          border: `1px solid ${isActive ? color : A.border}`,
                          cursor: (isActive || order.deliveryStatus === "cancelled") ? "default" : "pointer",
                          fontWeight: isActive ? 600 : 400,
                        }}>
                        {DELIVERY_LABELS[s]}
                      </button>
                    );
                  })}
                  <button
                    disabled={order.deliveryStatus === "cancelled" || updating === order.id}
                    onClick={() => updateDeliveryStatus(order.id, "cancelled")}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: order.deliveryStatus === "cancelled" ? `${DELIVERY_COLORS.cancelled}20` : "#f9fafb",
                      color: order.deliveryStatus === "cancelled" ? DELIVERY_COLORS.cancelled : "#DC2626",
                      border: `1px solid ${order.deliveryStatus === "cancelled" ? DELIVERY_COLORS.cancelled : "rgba(220,38,38,0.3)"}`,
                      cursor: order.deliveryStatus === "cancelled" ? "default" : "pointer",
                    }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
