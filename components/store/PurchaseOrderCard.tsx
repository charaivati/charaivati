"use client";

const A = {
  border: "#DDDDDD",
  text: "#0F1111",
  textMuted: "#565959",
  accent: "#6366f1",
  surface: "#FFFFFF",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#6366f1",
  shipped: "#3B82F6",
  delivered: "#10B981",
  cancelled: "#EF4444",
};

// Items are stored as a JSON snapshot on the Order row: [{ blockId, title, price, quantity }]
export type OrderItem = { blockId: string; title: string; price: number; quantity: number; imageUrl?: string | null };
export type Order = {
  id: string; status: string; createdAt: string; total: number;
  storeId?: string;
  invoiceUrl?: string | null;
  invoiceSignedUrl?: string | null;
  store?: { id: string; slug?: string | null; name: string };
  user?: { name: string | null; email: string | null };
  items: OrderItem[];
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#999";
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0"
      style={{ background: `${color}20`, color }}>
      {status}
    </span>
  );
}

export default function PurchaseOrderCard({ order }: { order: Order }) {
  const storeHandle = order.store?.slug ?? order.store?.id ?? order.storeId;
  const storeName = order.store?.name;
  const total = order.total ?? order.items?.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0) ?? 0;
  return (
    <div className="rounded-xl p-4" style={{ background: A.surface, border: `1px solid ${A.border}` }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="text-xs font-mono font-bold" style={{ color: A.text }}>
            #{order.id.slice(-8).toUpperCase()}
          </div>
          <div className="text-xs" style={{ color: A.textMuted }}>{fmtDate(order.createdAt)}</div>
          {storeName && storeHandle && (
            <a href={`/store/${storeHandle}`} className="text-xs hover:underline"
              style={{ color: A.accent, textDecoration: "none" }}>
              {storeName}
            </a>
          )}
        </div>
        <StatusBadge status={order.status} />
      </div>
      {order.items?.length > 0 && (
        <div className="space-y-1 pt-2 border-t" style={{ borderColor: A.border }}>
          {order.items.map((item, idx) => (
            <div key={item.blockId ?? `${order.id}-${idx}`}
              className="flex justify-between text-xs" style={{ color: A.textMuted }}>
              <span style={{ color: A.text }}>{item.title}</span>
              <span>× {item.quantity} &nbsp; ₹{((item.price ?? 0) * item.quantity).toLocaleString("en-IN")}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: A.border }}>
        <span className="text-sm font-bold" style={{ color: A.text }}>
          Total: ₹{total.toLocaleString("en-IN")}
        </span>
        {order.invoiceSignedUrl ? (
          <a href={`/api/orders/${order.id}/invoice/download`} download={`invoice-${order.id}.pdf`}
            className="text-xs px-2.5 py-1 rounded-md font-medium"
            style={{ background: "#F0FDF4", color: "#10B981", border: "1px solid #A7F3D0", textDecoration: "none" }}>
            ⬇ Signed Invoice
          </a>
        ) : order.invoiceUrl ? (
          <span className="text-xs" style={{ color: A.textMuted }}>Invoice pending signature</span>
        ) : null}
      </div>
    </div>
  );
}
