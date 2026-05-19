"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const TransportMap = dynamic(
  () => import("@/components/transport/TransportMap"),
  { ssr: false }
);

type OrderItem = {
  blockId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
};

type BuyerOrder = {
  id: string;
  status: string;
  deliveryStatus?: string;
  vehicleId?: string | null;
  total: number;
  createdAt: string;
  store?: { id: string; name: string; slug: string | null };
  items: OrderItem[];
};

type SellerOrder = {
  id: string;
  status: string;
  deliveryStatus?: string;
  total: number;
  createdAt: string;
  store: { id: string; name: string; slug: string | null };
};

type VehiclePos = { lat: number; lng: number; label: string; type: string } | null;

const DELIVERY_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const DELIVERY_COLOR: Record<string, string> = {
  pending: "#6B7280",
  confirmed: "#2563EB",
  processing: "#D97706",
  out_for_delivery: "#7C3AED",
  delivered: "#16A34A",
  cancelled: "#DC2626",
};

const ORDER_COLOR: Record<string, string> = {
  pending: "#6B7280",
  confirmed: "#2563EB",
  shipped: "#D97706",
  delivered: "#16A34A",
  cancelled: "#DC2626",
};

function StatusBadge({
  status,
  colorMap,
}: {
  status: string;
  colorMap: Record<string, string>;
}) {
  const color = colorMap[status] ?? "#6B7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: color + "20",
        color,
        whiteSpace: "nowrap",
      }}
    >
      {DELIVERY_LABEL[status] ?? status}
    </span>
  );
}

function TrackingCard({ order }: { order: BuyerOrder }) {
  const [vehiclePos, setVehiclePos] = useState<VehiclePos>(null);

  const poll = useCallback(async () => {
    if (!order.vehicleId) return;
    try {
      const res = await fetch(`/api/transport/vehicles?id=${order.vehicleId}`);
      if (!res.ok) return;
      const data = await res.json();
      const v = data.vehicles?.[0];
      if (v) {
        setVehiclePos({
          lat: v.lat,
          lng: v.lng,
          label: v.bus_number ?? "Delivery",
          type: v.vehicle_type ?? "Other",
        });
      } else {
        setVehiclePos(null);
      }
    } catch {}
  }, [order.vehicleId]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [poll]);

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {order.store?.name ?? "Store"}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
            {order.items
              .slice(0, 2)
              .map((i) => `${i.title} x${i.quantity}`)
              .join(", ")}
            {order.items.length > 2 ? ` +${order.items.length - 2} more` : ""}
          </div>
        </div>
        <Link
          href={`/order/${order.id}/track`}
          style={{
            fontSize: 12,
            color: "#6366F1",
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Full View →
        </Link>
      </div>
      <div style={{ height: 220, position: "relative" }}>
        <TransportMap vehiclePosition={vehiclePos} />
        {!order.vehicleId && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.85)",
              fontSize: 13,
              color: "#6B7280",
              textAlign: "center",
              padding: 16,
            }}
          >
            Delivery partner hasn't started GPS yet.
          </div>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: "my" as const, label: "My Orders" },
  { id: "store" as const, label: "Store Orders" },
  { id: "tracking" as const, label: "Tracking" },
];

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<"my" | "store" | "tracking">("my");
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrder[]>([]);
  const [sellerOrders, setSellerOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/store/orders").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/store/orders?all=true").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([buyer, seller]) => {
        setBuyerOrders(Array.isArray(buyer) ? buyer : []);
        setSellerOrders(Array.isArray(seller) ? seller : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const trackingOrders = buyerOrders.filter(
    (o) => o.deliveryStatus === "out_for_delivery"
  );

  return (
    <div>
      {/* Inner tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #E5E7EB",
          background: "#fff",
          position: "sticky",
          top: 56,
          zIndex: 20,
        }}
      >
        {TABS.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1,
                padding: "12px 0",
                fontSize: 13,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? "#6366F1" : "#6B7280",
                background: "none",
                border: "none",
                borderBottom: isActive
                  ? "2px solid #6366F1"
                  : "2px solid transparent",
                cursor: "pointer",
                position: "relative",
              }}
            >
              {t.label}
              {t.id === "tracking" && trackingOrders.length > 0 && (
                <span
                  style={{
                    marginLeft: 4,
                    background: "#6366F1",
                    color: "#fff",
                    borderRadius: 99,
                    fontSize: 10,
                    padding: "1px 5px",
                    verticalAlign: "middle",
                  }}
                >
                  {trackingOrders.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "12px 16px" }}>
        {loading ? (
          <div
            style={{
              textAlign: "center",
              color: "#6B7280",
              padding: 48,
              fontSize: 14,
            }}
          >
            Loading...
          </div>
        ) : activeTab === "my" ? (
          buyerOrders.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "#6B7280",
                padding: 48,
                fontSize: 14,
              }}
            >
              No orders yet.
            </div>
          ) : (
            buyerOrders.map((o) => (
              <div
                key={o.id}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {o.store?.name ?? "Store"}
                  </div>
                  <StatusBadge
                    status={o.deliveryStatus ?? o.status}
                    colorMap={o.deliveryStatus ? DELIVERY_COLOR : ORDER_COLOR}
                  />
                </div>
                <div
                  style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}
                >
                  {o.items
                    .slice(0, 2)
                    .map((i) => `${i.title} x${i.quantity}`)
                    .join(", ")}
                  {o.items.length > 2
                    ? ` +${o.items.length - 2} more`
                    : ""}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    ₹{o.total.toLocaleString("en-IN")}
                  </span>
                  {o.deliveryStatus === "out_for_delivery" && (
                    <Link
                      href={`/order/${o.id}/track`}
                      style={{
                        fontSize: 12,
                        color: "#fff",
                        background: "#6366F1",
                        padding: "4px 10px",
                        borderRadius: 6,
                        textDecoration: "none",
                        fontWeight: 600,
                      }}
                    >
                      Track 📍
                    </Link>
                  )}
                </div>
              </div>
            ))
          )
        ) : activeTab === "store" ? (
          sellerOrders.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "#6B7280",
                padding: 48,
                fontSize: 14,
              }}
            >
              No store orders yet.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 8,
                }}
              >
                <Link
                  href="/store/orders/all"
                  style={{
                    fontSize: 12,
                    color: "#6366F1",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Manage all orders →
                </Link>
              </div>
              {sellerOrders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 10,
                    padding: "12px 14px",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        background: "#F3F4F6",
                        color: "#374151",
                        padding: "2px 8px",
                        borderRadius: 99,
                      }}
                    >
                      {o.store?.name ?? "Store"}
                    </span>
                    <StatusBadge
                      status={o.deliveryStatus ?? o.status}
                      colorMap={o.deliveryStatus ? DELIVERY_COLOR : ORDER_COLOR}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      ₹{o.total.toLocaleString("en-IN")}
                    </span>
                    <Link
                      href={
                        o.store?.slug
                          ? `/store/${o.store.slug}/orders`
                          : `/store/orders/all`
                      }
                      style={{
                        fontSize: 12,
                        color: "#6366F1",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      Manage →
                    </Link>
                  </div>
                </div>
              ))}
            </>
          )
        ) : trackingOrders.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "#6B7280",
              padding: 48,
              fontSize: 14,
            }}
          >
            No active deliveries being tracked.
          </div>
        ) : (
          trackingOrders.map((o) => <TrackingCard key={o.id} order={o} />)
        )}
      </div>
    </div>
  );
}
