"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const A = {
  bg: "#E3E6E6", border: "#DDDDDD",
  text: "#0F1111", textMuted: "#565959", accent: "#6366f1",
};

type OrderItem = { blockId: string; title: string; price: number; quantity: number };
type Address = { name: string; phone: string; line1: string; city: string; state: string; pincode: string };
type Order = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
  address: Address | null;
  user: { name: string | null; email: string | null };
  store: { id: string; name: string; slug: string | null };
  deliveryStatus?: string | null;
  partnerStatus?: string | null;
  invoiceUrl?: string | null;
  invoiceSignedUrl?: string | null;
  isOwner?: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#6366f1", shipped: "#3B82F6",
  delivered: "#10B981", cancelled: "#EF4444",
};

const DELIVERY_COLORS: Record<string, string> = {
  pending: "#6B7280", confirmed: "#2563EB", processing: "#D97706",
  out_for_delivery: "#7C3AED", delivered: "#16A34A", cancelled: "#DC2626",
};

const DELIVERY_LABELS: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", processing: "Processing",
  out_for_delivery: "Out for Delivery", delivered: "Delivered", cancelled: "Cancelled",
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!orderId) { setNotFound(true); setLoading(false); return; }
    fetch(`/api/store/orders/${orderId}`, { credentials: "include" })
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (r.status === 403) { setForbidden(true); return null; }
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => { if (data) setOrder(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
      <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );

  if (forbidden) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: A.bg }}>
      <p className="text-4xl">🔒</p>
      <p className="text-sm font-semibold" style={{ color: A.text }}>Access denied</p>
      <p className="text-xs" style={{ color: A.textMuted }}>You don't have permission to view this order.</p>
      <a href="/store/orders/all"
        className="text-xs px-4 py-2 rounded-md font-medium"
        style={{ background: A.accent, color: "#fff", textDecoration: "none" }}>
        ← All Orders
      </a>
    </div>
  );

  if (notFound || !order) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: A.bg }}>
      <p className="text-4xl">📦</p>
      <p className="text-sm font-semibold" style={{ color: A.text }}>Order not found</p>
      <p className="text-xs" style={{ color: A.textMuted }}>
        The order ID <code className="font-mono">{orderId ?? "—"}</code> doesn't exist or has been removed.
      </p>
      <a href="/store/orders/all"
        className="text-xs px-4 py-2 rounded-md font-medium"
        style={{ background: A.accent, color: "#fff", textDecoration: "none" }}>
        ← All Orders
      </a>
    </div>
  );

  const statusColor = STATUS_COLORS[order.status] ?? A.textMuted;
  const deliveryColor = order.deliveryStatus ? (DELIVERY_COLORS[order.deliveryStatus] ?? A.textMuted) : null;
  const storeHref = order.store.slug ? `/store/${order.store.slug}` : `/store/${order.store.id}`;

  return (
    <div className="min-h-screen" style={{ background: A.bg }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-6 py-4 border-b bg-white" style={{ borderColor: A.border }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold" style={{ color: A.text }}>
              Order #{order.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-xs" style={{ color: A.textMuted }}>
              {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {order.isOwner && (
              <a href={storeHref + "/orders"}
                className="text-xs px-3 py-1.5 rounded-md font-medium"
                style={{ background: "#EEF2FF", color: A.accent, border: `1px solid #C7D2FE`, textDecoration: "none" }}>
                Manage Orders
              </a>
            )}
            <a href="/store/orders/all"
              className="text-xs px-3 py-1.5 rounded-md"
              style={{ border: `1px solid ${A.border}`, color: A.textMuted, textDecoration: "none" }}>
              ← All Orders
            </a>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {/* Status card */}
        <div className="bg-white rounded-xl p-5 shadow-sm" style={{ border: `1px solid ${A.border}` }}>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background: `${statusColor}20`, color: statusColor }}>
                {order.status}
              </span>
              {deliveryColor && order.deliveryStatus && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: `${deliveryColor}15`, color: deliveryColor }}>
                  {DELIVERY_LABELS[order.deliveryStatus] ?? order.deliveryStatus}
                </span>
              )}
              <a href={storeHref}
                className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: "#EEF2FF", color: A.accent, textDecoration: "none" }}>
                {order.store.name ?? "Store"}
              </a>
            </div>
            <div className="text-right">
              <div className="font-bold text-lg" style={{ color: A.text }}>
                ₹{order.total?.toLocaleString("en-IN") ?? "—"}
              </div>
              <div className="text-xs" style={{ color: A.textMuted }}>Cash on Delivery</div>
            </div>
          </div>

          {/* Invoice links */}
          {(order.invoiceSignedUrl || order.invoiceUrl) && (
            <div className="mt-3 pt-3 border-t flex gap-3" style={{ borderColor: "#f0f0f0" }}>
              {order.invoiceSignedUrl && (
                <a href={`/api/orders/${order.id}/invoice/download`}
                  download={`invoice-${order.id}.pdf`}
                  className="text-xs px-3 py-1 rounded-md font-medium"
                  style={{ background: "#F0FDF4", color: "#10B981", border: "1px solid #A7F3D0", textDecoration: "none" }}>
                  ⬇ Signed Invoice
                </a>
              )}
              {!order.invoiceSignedUrl && order.invoiceUrl && (
                <span className="text-xs" style={{ color: A.textMuted }}>Invoice pending signature</span>
              )}
            </div>
          )}
        </div>

        {/* Items */}
        {Array.isArray(order.items) && order.items.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm" style={{ border: `1px solid ${A.border}` }}>
            <p className="text-xs font-semibold mb-3" style={{ color: A.textMuted }}>ITEMS</p>
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span style={{ color: A.text }}>
                    {item.title ?? "Item"} ×{item.quantity ?? 1}
                  </span>
                  <span style={{ color: A.textMuted }}>
                    ₹{((item.price ?? 0) * (item.quantity ?? 1)).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between text-sm font-semibold" style={{ borderColor: "#f0f0f0" }}>
              <span style={{ color: A.text }}>Total</span>
              <span style={{ color: A.text }}>₹{order.total?.toLocaleString("en-IN") ?? "—"}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Customer */}
          {order.isOwner && (
            <div className="bg-white rounded-xl p-5 shadow-sm" style={{ border: `1px solid ${A.border}` }}>
              <p className="text-xs font-semibold mb-2" style={{ color: A.textMuted }}>CUSTOMER</p>
              <p className="text-sm" style={{ color: A.text }}>{order.user?.name ?? "—"}</p>
              <p className="text-xs mt-0.5" style={{ color: A.textMuted }}>{order.user?.email ?? "—"}</p>
            </div>
          )}

          {/* Delivery address */}
          <div className="bg-white rounded-xl p-5 shadow-sm" style={{ border: `1px solid ${A.border}` }}>
            <p className="text-xs font-semibold mb-2" style={{ color: A.textMuted }}>DELIVERY ADDRESS</p>
            {order.address ? (
              <>
                <p className="text-sm" style={{ color: A.text }}>{order.address.name}</p>
                <p className="text-xs mt-0.5" style={{ color: A.textMuted }}>{order.address.line1}</p>
                <p className="text-xs" style={{ color: A.textMuted }}>
                  {[order.address.city, order.address.state, order.address.pincode].filter(Boolean).join(", ")}
                </p>
                {order.address.phone && (
                  <p className="text-xs mt-1" style={{ color: A.textMuted }}>📞 {order.address.phone}</p>
                )}
              </>
            ) : (
              <p className="text-xs" style={{ color: A.textMuted }}>Address unavailable</p>
            )}
          </div>
        </div>

        {/* Delivery note */}
        {order.deliveryNote && (
          <div className="bg-white rounded-xl p-5 shadow-sm" style={{ border: `1px solid ${A.border}` }}>
            <p className="text-xs font-semibold mb-1" style={{ color: A.textMuted }}>DELIVERY NOTE</p>
            <p className="text-sm" style={{ color: A.text }}>{order.deliveryNote}</p>
          </div>
        )}

        {/* Track link */}
        {order.deliveryStatus === "out_for_delivery" && (
          <div className="flex">
            <a href={`/order/${order.id}/track`}
              className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold"
              style={{ background: "#0F766E", color: "#fff", textDecoration: "none" }}>
              📍 Track delivery →
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
