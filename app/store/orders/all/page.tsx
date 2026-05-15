"use client";

import { useEffect, useState } from "react";

const A = {
  bg: "#E3E6E6", nav: "#131921", border: "#DDDDDD",
  text: "#0F1111", textMuted: "#565959", accent: "#6366f1",
};

type OrderItem = { blockId: string; title: string; price: number; quantity: number };
type Address = { name: string; phone: string; line1: string; city: string; state: string; pincode: string };
type Order = {
  id: string; status: string; total: number; createdAt: string;
  items: OrderItem[];
  address: Address;
  user: { name: string | null; email: string | null };
  store: { id: string; slug?: string | null; name: string };
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#6366f1", shipped: "#3B82F6",
  delivered: "#10B981", cancelled: "#EF4444",
};

export default function AllOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/store/orders?all=true", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(orderId: string, status: string) {
    setUpdating(orderId);
    const res = await fetch(`/api/store/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
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
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl p-5 shadow-sm" style={{ border: `1px solid ${A.border}` }}>
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold" style={{ color: A.text }}>
                      #{order.id.slice(-8).toUpperCase()}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${STATUS_COLORS[order.status]}20`, color: STATUS_COLORS[order.status] ?? A.textMuted }}>
                      {order.status}
                    </span>
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
                    {(order.items as OrderItem[]).map((item, i) => (
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
          ))
        )}
      </main>
    </div>
  );
}
