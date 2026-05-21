"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTranslations } from "@/hooks/useTranslations";

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
  deliveryStatus?: string | null;
  partnerStatus?: string | null;
  assignedToId?: string | null;
  total: number;
  createdAt: string;
  store: { id: string; name: string; slug: string | null };
};

type VehiclePos = { lat: number; lng: number; label: string; type: string } | null;

const DELIVERY_LABEL_EN: Record<string, string> = {
  pending:          "Pending",
  confirmed:        "Confirmed",
  processing:       "Processing",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
  cancelled:        "Cancelled",
};

const STATUS_SLUG: Record<string, string> = {
  pending:          "app-orders-status-pending",
  confirmed:        "app-orders-status-confirmed",
  processing:       "app-orders-status-processing",
  out_for_delivery: "app-orders-status-out-for-delivery",
  delivered:        "app-orders-status-delivered",
  cancelled:        "app-orders-status-cancelled",
};

const DELIVERY_COLOR: Record<string, string> = {
  pending:          "#993C1D",
  confirmed:        "#185FA5",
  processing:       "#185FA5",
  out_for_delivery: "#185FA5",
  delivered:        "#0F6E56",
  cancelled:        "#DC2626",
};

const DELIVERY_BG: Record<string, string> = {
  pending:          "#FDF0EB",
  confirmed:        "#E6F1FB",
  processing:       "#E6F1FB",
  out_for_delivery: "#E6F1FB",
  delivered:        "#E1F5EE",
  cancelled:        "#FEE2E2",
};

const ORDER_COLOR: Record<string, string> = {
  pending:   "#993C1D",
  confirmed: "#185FA5",
  shipped:   "#185FA5",
  delivered: "#0F6E56",
  cancelled: "#DC2626",
};

const ORDER_BG: Record<string, string> = {
  pending:   "#FDF0EB",
  confirmed: "#E6F1FB",
  shipped:   "#E6F1FB",
  delivered: "#E1F5EE",
  cancelled: "#FEE2E2",
};

const PARTNER_COLOR: Record<string, string> = {
  assigned:  "#D97706",
  accepted:  "#16A34A",
  rejected:  "#DC2626",
  completed: "#2563EB",
};

const PARTNER_LABEL: Record<string, string> = {
  assigned:  "Awaiting partner",
  accepted:  "Partner accepted",
  rejected:  "Partner rejected",
  completed: "Delivered by partner",
};

const ORDERS_SLUGS = [
  "app-orders-heading","app-orders-tab-my","app-orders-tab-store","app-orders-tab-tracking",
  "app-orders-loading","app-orders-empty-my","app-orders-empty-store","app-orders-empty-tracking",
  "app-orders-no-gps","app-orders-manage-all","app-orders-manage","app-orders-full-view","app-orders-track",
  "app-orders-status-pending","app-orders-status-confirmed","app-orders-status-processing",
  "app-orders-status-out-for-delivery","app-orders-status-delivered","app-orders-status-cancelled",
].join(",");

function StatusBadge({
  status,
  colorMap,
  bgMap,
  label,
}: {
  status: string;
  colorMap: Record<string, string>;
  bgMap?: Record<string, string>;
  label: string;
}) {
  const color = colorMap[status] ?? "#6B7280";
  const bg = bgMap ? (bgMap[status] ?? color + "20") : color + "20";
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      background: bg,
      color,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function TrackingCard({ order, noGpsLabel, fullViewLabel }: { order: BuyerOrder; noGpsLabel: string; fullViewLabel: string }) {
  const [vehiclePos, setVehiclePos] = useState<VehiclePos>(null);

  const poll = useCallback(async () => {
    if (!order.vehicleId) return;
    try {
      const res = await fetch(`/api/transport/vehicles?id=${order.vehicleId}`);
      if (!res.ok) return;
      const data = await res.json();
      const v = data.vehicles?.[0];
      if (v) {
        setVehiclePos({ lat: v.lat, lng: v.lng, label: v.bus_number ?? "Delivery", type: v.vehicle_type ?? "Other" });
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
    <div style={{
      background: "#fff", border: "0.5px solid #e2e8f0",
      borderRadius: 12, overflow: "hidden", marginBottom: 10,
    }}>
      <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{order.store?.name ?? "Store"}</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
            {order.items.slice(0, 2).map((i) => `${i.title} x${i.quantity}`).join(", ")}
            {order.items.length > 2 ? ` +${order.items.length - 2} more` : ""}
          </div>
        </div>
        <Link href={`/order/${order.id}/track`} style={{ fontSize: 12, color: "#185FA5", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
          {fullViewLabel}
        </Link>
      </div>
      <div style={{ height: 220, position: "relative" }}>
        <TransportMap vehiclePosition={vehiclePos} />
        {!order.vehicleId && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.85)",
            fontSize: 13, color: "#64748B", textAlign: "center", padding: 16,
          }}>
            {noGpsLabel}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const t = useTranslations(ORDERS_SLUGS);

  const TABS = [
    { id: "my"       as const, label: t("app-orders-tab-my",      "My Orders")    },
    { id: "store"    as const, label: t("app-orders-tab-store",    "Store Orders") },
    { id: "tracking" as const, label: t("app-orders-tab-tracking", "Tracking")     },
  ];

  const [activeTab, setActiveTab] = useState<"my" | "store" | "tracking">("my");
  const [buyerOrders, setBuyerOrders]   = useState<BuyerOrder[]>([]);
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

  const trackingOrders = buyerOrders.filter((o) => o.deliveryStatus === "out_for_delivery");

  function statusLabel(status: string) {
    return t(STATUS_SLUG[status] ?? "", DELIVERY_LABEL_EN[status] ?? status);
  }

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh", paddingBottom: 80, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>

        <h1 style={{ fontSize: 18, fontWeight: 500, color: "#111827", margin: 0, padding: "16px 16px 8px" }}>
          {t("app-orders-heading", "Orders")}
        </h1>

        {/* Tab bar */}
        <div style={{
          display: "flex",
          background: "#fff",
          borderBottom: "0.5px solid #e2e8f0",
          position: "sticky", top: 56, zIndex: 20,
        }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, padding: "12px 0", fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#D85A30" : "#64748B",
                  background: "none", border: "none",
                  borderBottom: isActive ? "2px solid #D85A30" : "2px solid transparent",
                  cursor: "pointer", position: "relative",
                }}
              >
                {tab.label}
                {tab.id === "tracking" && trackingOrders.length > 0 && (
                  <span style={{
                    marginLeft: 4, background: "#D85A30", color: "#fff",
                    borderRadius: 99, fontSize: 10, padding: "1px 5px", verticalAlign: "middle",
                  }}>
                    {trackingOrders.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ padding: "12px 16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#64748B", padding: 48, fontSize: 14 }}>
              {t("app-orders-loading", "Loading...")}
            </div>
          ) : activeTab === "my" ? (
            buyerOrders.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748B", padding: 48, fontSize: 14 }}>
                {t("app-orders-empty-my", "No orders yet.")}
              </div>
            ) : (
              buyerOrders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    background: "#fff", border: "0.5px solid #e2e8f0",
                    borderRadius: 12, padding: "12px 14px", marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{o.store?.name ?? "Store"}</div>
                    <StatusBadge
                      status={o.deliveryStatus ?? o.status}
                      colorMap={o.deliveryStatus ? DELIVERY_COLOR : ORDER_COLOR}
                      bgMap={o.deliveryStatus ? DELIVERY_BG : ORDER_BG}
                      label={statusLabel(o.deliveryStatus ?? o.status)}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginBottom: 8 }}>
                    {o.items.slice(0, 2).map((i) => `${i.title} x${i.quantity}`).join(", ")}
                    {o.items.length > 2 ? ` +${o.items.length - 2} more` : ""}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>₹{o.total.toLocaleString("en-IN")}</span>
                    {o.deliveryStatus === "out_for_delivery" && (
                      <Link
                        href={`/order/${o.id}/track`}
                        style={{ fontSize: 12, color: "#fff", background: "#D85A30", padding: "4px 10px", borderRadius: 6, textDecoration: "none", fontWeight: 600 }}
                      >
                        {t("app-orders-track", "Track 📍")}
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )
          ) : activeTab === "store" ? (
            sellerOrders.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748B", padding: 48, fontSize: 14 }}>
                {t("app-orders-empty-store", "No store orders yet.")}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                  <Link href="/store/orders/all" style={{ fontSize: 12, color: "#185FA5", fontWeight: 600, textDecoration: "none" }}>
                    {t("app-orders-manage-all", "Manage all orders →")}
                  </Link>
                </div>
                {sellerOrders.map((o) => (
                  <div
                    key={o.id}
                    style={{
                      background: "#fff", border: "0.5px solid #e2e8f0",
                      borderRadius: 12, padding: "12px 14px", marginBottom: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, background: "#F8FAFC", color: "#64748B", padding: "2px 8px", borderRadius: 99, border: "0.5px solid #e2e8f0" }}>
                        {o.store?.name ?? "Store"}
                      </span>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <StatusBadge
                          status={o.deliveryStatus ?? "pending"}
                          colorMap={DELIVERY_COLOR}
                          bgMap={DELIVERY_BG}
                          label={statusLabel(o.deliveryStatus ?? "pending")}
                        />
                        {o.assignedToId && o.partnerStatus && (
                          <StatusBadge
                            status={o.partnerStatus}
                            colorMap={PARTNER_COLOR}
                            label={PARTNER_LABEL[o.partnerStatus] ?? o.partnerStatus}
                          />
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>₹{o.total.toLocaleString("en-IN")}</span>
                      <Link
                        href={o.store?.slug ? `/store/${o.store.slug}/orders` : `/store/orders/all`}
                        style={{ fontSize: 12, color: "#185FA5", fontWeight: 600, textDecoration: "none" }}
                      >
                        {t("app-orders-manage", "Manage →")}
                      </Link>
                    </div>
                  </div>
                ))}
              </>
            )
          ) : trackingOrders.length === 0 ? (
            <div style={{ textAlign: "center", color: "#64748B", padding: 48, fontSize: 14 }}>
              {t("app-orders-empty-tracking", "No active deliveries being tracked.")}
            </div>
          ) : (
            trackingOrders.map((o) => (
              <TrackingCard
                key={o.id}
                order={o}
                noGpsLabel={t("app-orders-no-gps", "Delivery partner hasn't started GPS yet.")}
                fullViewLabel={t("app-orders-full-view", "Full View →")}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
