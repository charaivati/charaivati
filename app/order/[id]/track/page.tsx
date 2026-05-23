"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import TransportMap from "@/components/transport/TransportMap";

// ── Stepper constants (read-only version) ─────────────────────────────────────
const DELIVERY_STEPS = [
  "pending",
  "confirmed",
  "processing",
  "out_for_delivery",
  "delivered",
] as const;

const STEP_LABEL: Record<string, string> = {
  pending:          "Pending",
  confirmed:        "Confirmed",
  processing:       "Processing",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type OrderItem = { title: string; quantity: number; price: number };
type OrderData = {
  id: string;
  deliveryStatus: string;
  partnerStatus: string | null;
  assignedToId: string | null;
  vehicleId: string | null;
  deliveryNote: string | null;
  items: OrderItem[];
  total: number;
  createdAt: string;
  address: {
    name: string; phone: string; line1: string;
    city: string; state: string; pincode: string;
  };
  assignedCollab: {
    role: string;
    requester: { title: string };
    receiver:  { title: string };
  } | null;
};

type VehiclePos = { lat: number; lng: number; label: string; type: string };

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TrackOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [order,            setOrder]            = useState<OrderData | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [vehiclePos,       setVehiclePos]       = useState<VehiclePos | null>(null);
  const [customerConfirmed,setCustomerConfirmed]= useState(false);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const orderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch order (called on mount and by the order status poll)
  function fetchOrder() {
    return fetch(`/api/order/${id}/delivery`, { credentials: "include" })
      .then((r) => {
        if (r.status === 401) { router.push(`/login?redirect=/order/${id}/track`); return null; }
        if (!r.ok) { router.push("/"); return null; }
        return r.json();
      })
      .then((data) => { if (data) setOrder(data); });
  }

  useEffect(() => {
    fetchOrder().finally(() => setLoading(false));
  }, [id, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll order status — 2 s when out_for_delivery, 5 s otherwise
  useEffect(() => {
    const isDone = order?.deliveryStatus === "delivered" || customerConfirmed;
    if (isDone) {
      if (orderPollRef.current) { clearInterval(orderPollRef.current); orderPollRef.current = null; }
      return;
    }
    if (!order) return;
    const interval = order.deliveryStatus === "out_for_delivery" ? 2000 : 5000;
    orderPollRef.current = setInterval(() => { fetchOrder(); }, interval);
    return () => { if (orderPollRef.current) { clearInterval(orderPollRef.current); orderPollRef.current = null; } };
  }, [order?.deliveryStatus, order?.partnerStatus, customerConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCustomerConfirm() {
    setCustomerConfirmed(true);
    setOrder((prev) => prev ? { ...prev, deliveryStatus: "delivered" } : prev);
    fetch(`/api/order/${id}/customer-confirm`, {
      method: "POST", credentials: "include",
    }).catch(() => {});
  }

  // Live GPS poll — only when out_for_delivery AND vehicleId is linked
  useEffect(() => {
    const canTrack =
      order?.deliveryStatus === "out_for_delivery" && !!order?.vehicleId;

    if (!canTrack) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    const vid = order!.vehicleId!;

    function poll() {
      fetch(`/api/transport/vehicles?id=${encodeURIComponent(vid)}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const v = data?.vehicles?.[0];
          if (v) setVehiclePos({ lat: v.lat, lng: v.lng, label: v.bus_number, type: v.vehicle_type });
          else setVehiclePos(null);
        });
    }

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [order?.deliveryStatus, order?.vehicleId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const currentIdx  = DELIVERY_STEPS.indexOf(order.deliveryStatus as typeof DELIVERY_STEPS[number]);
  const isCancelled = order.deliveryStatus === "cancelled";
  const isLive      = order.deliveryStatus === "out_for_delivery";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <a href="/app/orders?tab=my"
            className="text-sm font-medium text-gray-500 hover:text-gray-800"
            style={{ textDecoration: "none" }}>
            ← My Orders
          </a>
          <a href="/app/home"
            className="text-sm font-medium"
            style={{ color: "#6366f1", textDecoration: "none" }}>
            Home
          </a>
        </div>
        <h1 className="text-lg font-bold text-gray-900 mt-1">Track Order</h1>
        <p className="text-xs text-gray-500 font-mono">#{order.id.slice(-8).toUpperCase()}</p>
      </div>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {/* ── Status stepper (read-only) ── */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-xs font-semibold text-gray-400 mb-4">DELIVERY STATUS</p>

          {isCancelled ? (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-50 text-red-500 border border-red-200">
              Delivery cancelled
            </span>
          ) : (
            <div className="flex items-center overflow-x-auto pb-1">
              {DELIVERY_STEPS.map((step, idx) => {
                const isCompleted = currentIdx > idx;
                const isActive    = currentIdx === idx;
                const circleColor = isCompleted ? "#10B981" : isActive ? "#6366f1" : "#D1D5DB";
                const labelColor  = isActive ? "#6366f1" : isCompleted ? "#10B981" : "#9CA3AF";

                return (
                  <div key={step} className="flex items-center">
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 64 }}>
                      {/* Circle */}
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: isCompleted || isActive ? circleColor : "#F3F4F6",
                        border: `2px solid ${circleColor}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {isCompleted ? (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? "#fff" : "#9CA3AF" }}>{idx + 1}</span>
                        )}
                      </div>
                      {/* Label */}
                      <span style={{
                        fontSize: 10, fontWeight: isActive ? 600 : 400,
                        color: labelColor, textAlign: "center", lineHeight: 1.3,
                      }}>
                        {STEP_LABEL[step]}
                      </span>
                    </div>

                    {/* Connector */}
                    {idx < DELIVERY_STEPS.length - 1 && (
                      <div style={{
                        width: 18, height: 2, flexShrink: 0, marginBottom: 20,
                        background: currentIdx > idx ? "#10B981" : "#E5E7EB",
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Thank-you state ── */}
        {(customerConfirmed || order.deliveryStatus === "delivered") && (
          <div className="bg-emerald-50 rounded-xl p-5 shadow-sm border border-emerald-200 text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm font-semibold text-emerald-800">Order Received!</p>
            <p className="text-xs text-emerald-600 mt-1">Thank you for confirming receipt.</p>
          </div>
        )}

        {/* ── Customer confirmation prompt ── */}
        {order.partnerStatus === "completed" && !customerConfirmed && order.deliveryStatus !== "delivered" && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-emerald-300">
            <p className="text-sm font-semibold text-gray-900 mb-1">Confirm you received this order?</p>
            <p className="text-xs text-gray-500 mb-4">Your delivery partner has marked this as delivered.</p>
            <button
              onClick={handleCustomerConfirm}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Yes, I received it
            </button>
          </div>
        )}

        {/* ── Live map — only when out_for_delivery ── */}
        {isLive && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
            {order.vehicleId ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                  <p className="text-xs font-semibold text-gray-700">Live Location</p>
                  {!vehiclePos && (
                    <span className="text-xs text-gray-400 ml-1">Waiting for location update…</span>
                  )}
                </div>
                <div style={{ height: 300 }}>
                  <TransportMap vehiclePosition={vehiclePos ?? undefined} autoCenter={false} />
                </div>
                <p className="text-xs text-gray-400 mt-2">Map refreshes every 5 seconds.</p>
              </>
            ) : (
              <div className="flex items-center gap-3 py-2">
                <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                <p className="text-sm text-gray-500">Delivery partner hasn't started GPS yet.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Assigned partner (if any) ── */}
        {order.assignedCollab && !isCancelled && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
            <p className="text-xs font-semibold text-gray-400 mb-2">DELIVERY PARTNER</p>
            <p className="text-sm text-gray-800 font-medium">
              {order.assignedCollab.receiver.title}
            </p>
            <p className="text-xs text-gray-400 capitalize">
              {order.assignedCollab.role.replace(/_/g, " ")}
            </p>
          </div>
        )}

        {/* ── Delivery note ── */}
        {order.deliveryNote && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <p className="text-xs font-semibold text-amber-700 mb-1">DELIVERY NOTE</p>
            <p className="text-sm text-amber-800">{order.deliveryNote}</p>
          </div>
        )}

        {/* ── Order summary ── */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-xs font-semibold text-gray-400 mb-3">ORDER SUMMARY</p>
          <div className="space-y-1 mb-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-700">{item.title} × {item.quantity}</span>
                <span className="text-gray-400">₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
              </div>
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-800">
            Total ₹{order.total.toLocaleString("en-IN")}
          </p>
        </div>

        {/* ── Delivery address ── */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-xs font-semibold text-gray-400 mb-2">DELIVERY ADDRESS</p>
          <p className="text-sm text-gray-800">{order.address.name}</p>
          <p className="text-sm text-gray-500">{order.address.line1}</p>
          <p className="text-sm text-gray-500">{order.address.city}, {order.address.state} {order.address.pincode}</p>
          <p className="text-sm text-gray-500">📞 {order.address.phone}</p>
        </div>

      </main>
    </div>
  );
}
