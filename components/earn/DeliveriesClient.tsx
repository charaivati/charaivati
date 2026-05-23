"use client";

import { useState } from "react";
import Broadcaster from "@/components/transport/broadcaster";

export type CompletedDelivery = {
  id: string;
  createdAt: string;
  agreedAmount: number | null;
  addrName: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  storeName: string;
};

export type DeliveryOrder = {
  id: string;
  deliveryStatus: string;
  partnerStatus: string | null;
  vehicleId: string | null;
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
  activeStepId: string | null;
  agreedAmount: number | null;
  cycleCount: number | null;
};

// ── Order card ────────────────────────────────────────────────────────────────
function OrderCard({
  order,
  isBusy,
  isConfirmed,
  isRejecting,
  onAction,
  onGps,
  onConfirmDelivery,
}: {
  order: DeliveryOrder;
  isBusy: boolean;
  isConfirmed: boolean;
  isRejecting: boolean;
  onAction: (body: Record<string, unknown>) => void;
  onGps: () => void;
  onConfirmDelivery: () => void;
}) {
  const [pendingReject, setPendingReject] = useState(false);
  const isAssigned = order.partnerStatus === "assigned";
  const isAccepted = order.partnerStatus === "accepted";

  return (
    <div
      className={`bg-gray-900 rounded-xl p-5 border ${
        isAssigned ? "border-amber-800/50" : "border-gray-800"
      }`}
    >
      {/* Header: store name, role badge, status badge, order ID */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-white font-semibold text-sm">{order.storeName}</p>
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 capitalize">
            {order.collabRole.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {isAssigned && (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-900/50 text-amber-300 border border-amber-700">
              New Assignment
            </span>
          )}
          {isAccepted && (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-700">
              Accepted
            </span>
          )}
          <span className="text-xs text-gray-500 font-mono">
            #{order.id.slice(-8).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Fee & adjustment — shown for assigned and accepted orders */}
      {(isAssigned || isAccepted) && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {order.agreedAmount ? (
            <span className="text-sm font-bold text-emerald-400">
              ₹{order.agreedAmount.toLocaleString("en-IN")} delivery fee
            </span>
          ) : (
            <span className="text-sm text-gray-500">Fee not set</span>
          )}
          {(order.cycleCount ?? 0) > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-800">
              +{(order.cycleCount ?? 0) * 5}% adjustment
            </span>
          )}
        </div>
      )}

      {/* Deliver to */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-500 mb-1">DELIVER TO</p>
        <p className="text-sm text-white">
          {order.addrName} · {order.addrPhone}
        </p>
        <p className="text-sm text-gray-400">
          {order.line1}, {order.city}, {order.state} {order.pincode}
        </p>
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
      <div className="pt-4 border-t border-gray-800">
        {isRejecting ? (
          // ── Rejection in progress — card stays briefly then disappears ──
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
            <span>Rejected — moving to next partner</span>
          </div>
        ) : isConfirmed ? (
          // ── Delivery confirmed ──
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <span>✅</span>
            <span>Delivery complete</span>
          </div>
        ) : isAssigned ? (
          // ── New assignment: Accept (with fee) or Reject (with confirmation) ──
          pendingReject ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                Are you sure? This will pass the order to the next partner.
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={isBusy}
                  onClick={() => { setPendingReject(false); onAction({ partnerAction: "reject" }); }}
                  className="text-sm px-4 py-2 rounded-lg font-medium bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white transition-colors"
                >
                  {isBusy ? "…" : "Confirm Reject"}
                </button>
                <button
                  disabled={isBusy}
                  onClick={() => setPendingReject(false)}
                  className="text-sm px-4 py-2 rounded-lg font-medium border border-gray-700 text-gray-300 hover:border-gray-500 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                disabled={isBusy}
                onClick={() => onAction({ partnerAction: "accept" })}
                className="text-sm px-4 py-2 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors"
              >
                {isBusy
                  ? "…"
                  : order.agreedAmount
                  ? `✓ Accept ₹${order.agreedAmount.toLocaleString("en-IN")}`
                  : "✓ Accept Delivery"}
              </button>
              <button
                disabled={isBusy}
                onClick={() => setPendingReject(true)}
                className="text-sm px-4 py-2 rounded-lg font-medium border border-red-800 text-red-400 hover:border-red-600 disabled:opacity-50 transition-colors"
              >
                ✗ Reject
              </button>
            </div>
          )
        ) : isAccepted ? (
          // ── Accepted: GPS + Confirm Delivery ──
          <div className="flex flex-col gap-3">
            {order.vehicleId ? (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                GPS Active
              </div>
            ) : (
              <button
                disabled={isBusy}
                onClick={onGps}
                className="text-sm px-4 py-2 rounded-lg font-medium border border-gray-700 text-gray-300 hover:border-gray-500 disabled:opacity-50 transition-colors w-fit"
              >
                📡 Start GPS
              </button>
            )}

            <button
              disabled={isBusy}
              onClick={onConfirmDelivery}
              className="text-sm px-4 py-2 rounded-lg font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors w-fit"
            >
              {isBusy ? "Confirming…" : "✓ Confirm Delivery"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────
export default function DeliveriesClient({
  orders: initial,
  completedOrders,
}: {
  orders: DeliveryOrder[];
  completedOrders: CompletedDelivery[];
}) {
  const [orders, setOrders] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [gpsOrderId, setGpsOrderId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<Set<string>>(new Set());

  async function partnerPatch(orderId: string, body: Record<string, unknown>) {
    setBusy(orderId);
    const res = await fetch(`/api/order/${orderId}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      if (body.partnerAction === "reject") {
        setRejecting((prev) => new Set([...prev, orderId]));
        setTimeout(() => {
          setOrders((prev) => prev.filter((o) => o.id !== orderId));
          setRejecting((prev) => { const s = new Set(prev); s.delete(orderId); return s; });
        }, 2000);
      } else {
        setOrders((prev) =>
          prev.map((o) =>
            o.id !== orderId
              ? o
              : {
                  ...o,
                  partnerStatus:
                    updated.partnerStatus !== undefined
                      ? updated.partnerStatus
                      : o.partnerStatus,
                  deliveryStatus:
                    updated.deliveryStatus !== undefined
                      ? updated.deliveryStatus
                      : o.deliveryStatus,
                  vehicleId:
                    "vehicleId" in updated ? updated.vehicleId : o.vehicleId,
                }
          )
        );
      }
    }
    setBusy(null);
  }

  async function confirmDelivery(order: DeliveryOrder) {
    setBusy(order.id);
    try {
      // 1. Confirm the workflow step (if one is active)
      if (order.activeStepId) {
        const res = await fetch(`/api/order/${order.id}/step/${order.activeStepId}/confirm`, {
          method: "PATCH",
          credentials: "include",
        });
        if (!res.ok) return;
      }

      // 2. Mark partner complete (no deliveryStatus change — customer confirms that)
      await fetch(`/api/order/${order.id}/delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ partnerAction: "complete" }),
      });

      // 3. Clean up GPS vehicle row if present
      if (order.vehicleId) {
        fetch(`/api/transport/broadcast?id=${order.vehicleId}`, { method: "DELETE" }).catch(() => {});
      }

      // 4. Show complete state briefly then remove
      setConfirmed((prev) => new Set([...prev, order.id]));
      setTimeout(() => {
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
      }, 2500);
    } finally {
      setBusy(null);
    }
  }

  if (orders.length === 0 && completedOrders.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">🚚</p>
        <p className="text-gray-400 text-sm">
          No deliveries assigned to you right now.
        </p>
        <p className="text-gray-600 text-xs mt-1">
          New assignments from store owners will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🚚</p>
          <p className="text-gray-400 text-sm">No active deliveries right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              isBusy={busy === order.id}
              isConfirmed={confirmed.has(order.id)}
              isRejecting={rejecting.has(order.id)}
              onAction={(body) => partnerPatch(order.id, body)}
              onGps={() => setGpsOrderId(order.id)}
              onConfirmDelivery={() => confirmDelivery(order)}
            />
          ))}
        </div>
      )}

      {/* Completed deliveries */}
      {completedOrders.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wide">
            Completed Deliveries
          </h2>
          <div className="space-y-3">
            {completedOrders.map((o) => (
              <div key={o.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-white text-sm font-medium">{o.storeName}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">#{o.id.slice(-8).toUpperCase()}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800">
                      Completed ✓
                    </span>
                    {o.agreedAmount != null && (
                      <p className="text-xs text-gray-400 mt-1">₹{o.agreedAmount.toLocaleString("en-IN")}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {o.addrName} · {o.line1}, {o.city}, {o.state} {o.pincode}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GPS modal */}
      {gpsOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60"
          onClick={(e) =>
            e.target === e.currentTarget && setGpsOrderId(null)
          }
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
                partnerPatch(gpsOrderId, { vehicleId });
                setGpsOrderId(null);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
