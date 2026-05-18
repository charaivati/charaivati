"use client";

import { useState } from "react";
import Broadcaster from "@/components/transport/broadcaster";

export type DeliveryOrder = {
  id: string;
  deliveryStatus: string;
  assignedToId: string;
  deliveryNote: string | null;
  items: Array<{ title: string; quantity: number; price: number }>;
  total: number;
  createdAt: string;
  addrName: string;
  addrPhone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  storeName: string;
  collabRole: string;
  requesterTitle: string;
};

export default function DeliveriesClient({ orders: initial }: { orders: DeliveryOrder[] }) {
  const [orders, setOrders] = useState(initial);
  const [delivering, setDelivering] = useState<string | null>(null);
  const [gpsOrderId, setGpsOrderId] = useState<string | null>(null);

  async function markDelivered(orderId: string) {
    setDelivering(orderId);
    const res = await fetch(`/api/order/${orderId}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ deliveryStatus: "delivered" }),
    });
    if (res.ok) setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setDelivering(null);
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">🚚</p>
        <p className="text-gray-400 text-sm">No deliveries assigned to you right now.</p>
        <p className="text-gray-600 text-xs mt-1">Orders marked "out for delivery" by store owners will appear here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-gray-900 rounded-xl p-5 border border-gray-800"
          >
            {/* Store + role */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-white font-semibold text-sm">{order.storeName}</p>
                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 capitalize">
                  {order.collabRole.replace(/_/g, " ")}
                </span>
              </div>
              <span className="text-xs text-gray-500 font-mono flex-shrink-0">
                #{order.id.slice(-8).toUpperCase()}
              </span>
            </div>

            {/* Deliver to */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-1">DELIVER TO</p>
              <p className="text-sm text-white">{order.addrName} · {order.addrPhone}</p>
              <p className="text-sm text-gray-400">{order.line1}, {order.city}, {order.state} {order.pincode}</p>
            </div>

            {/* Items */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-1">ITEMS</p>
              <div className="space-y-0.5">
                {order.items.map((item, i) => (
                  <p key={i} className="text-xs text-gray-300">
                    {item.title} × {item.quantity}
                  </p>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                Total ₹{order.total.toLocaleString("en-IN")}
              </p>
            </div>

            {/* Delivery note */}
            {order.deliveryNote && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700">
                <p className="text-xs text-gray-400">
                  Note:{" "}
                  <span className="text-gray-200">{order.deliveryNote}</span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t border-gray-800">
              <button
                disabled={delivering === order.id}
                onClick={() => markDelivered(order.id)}
                className="text-sm px-4 py-2 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors"
              >
                {delivering === order.id ? "Marking…" : "✓ Mark Delivered"}
              </button>
              <button
                onClick={() => setGpsOrderId(order.id)}
                className="text-sm px-4 py-2 rounded-lg font-medium border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
              >
                📡 Start GPS
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* GPS modal */}
      {gpsOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60"
          onClick={(e) => e.target === e.currentTarget && setGpsOrderId(null)}
        >
          <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg p-6 border border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-semibold">GPS Broadcast</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Order #{gpsOrderId.slice(-8).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setGpsOrderId(null)}
                className="text-gray-400 hover:text-white text-xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>
            <Broadcaster
              onVehicleCreated={(vehicleId) => {
                if (!gpsOrderId) return;
                fetch(`/api/order/${gpsOrderId}/delivery`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ vehicleId }),
                });
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
