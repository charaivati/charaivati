// DEPRECATED — logic moved to app/fleet/[pageId]/page.tsx
"use client";

import { useEffect, useState } from "react";

interface FleetBlock {
  id: string;
  title: string;
  pricingModel: string | null;
  price: number | null;
  perKmRate: number | null;
  perKgRate: number | null;
  vehicleType: string | null;
  maxWeightKg: number | null;
  maxDistanceKm: number | null;
  assignedUserId: string | null;
  visibility: string;
  serviceType: string;
}

const VEHICLE_ICON: Record<string, string> = { bike: "🚲", auto: "🛺", car: "🚗", van: "🚐", truck: "🚚" };

function pricingLabel(block: FleetBlock): string {
  const model = block.pricingModel ?? "fixed";
  if (model === "fixed") return `₹${block.price ?? 0} flat`;
  if (model === "per_km") {
    const parts = [`₹${block.perKmRate ?? 0}/km`];
    if ((block.price ?? 0) > 0) parts.push(`Base ₹${block.price}`);
    return parts.join(" + ");
  }
  return `₹${block.perKgRate ?? 0}/kg + ₹${block.perKmRate ?? 0}/km`;
}

function visibilityBadge(v: string) {
  if (v === "internal") return { label: "Internal", color: "#0369A1", bg: "#E0F2FE" };
  if (v === "inactive") return { label: "Inactive", color: "#6B7280", bg: "#F3F4F6" };
  return { label: "Public", color: "#15803D", bg: "#F0FDF4" };
}

const iStyle: React.CSSProperties = {
  background: "#fff", color: "#0F1111", border: "1px solid #DDDDDD",
  borderRadius: 6, padding: "7px 10px", fontSize: 13, width: "100%",
  outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#0F1111", display: "block", marginBottom: 4 };

// ─── Add Service Block Modal ──────────────────────────────────────────────────

function AddBlockModal({ sectionId, onClose, onCreated }: {
  sectionId: string;
  onClose: () => void;
  onCreated: (block: FleetBlock) => void;
}) {
  const [form, setForm] = useState({
    title: "", pricingModel: "fixed", price: "", perKmRate: "", perKgRate: "",
    vehicleType: "", maxWeightKg: "", maxDistanceKm: "", assignedUserId: "",
    visibility: "public",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Name is required"); return; }
    setLoading(true);
    const res = await fetch("/api/block", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({
        sectionId,
        title: form.title.trim(),
        mediaType: "none",
        actionType: "book",
        serviceType: "delivery",
        visibility: form.visibility,
        pricingModel: form.pricingModel,
        price: form.price ? parseFloat(form.price) : 0,
        perKmRate: form.perKmRate ? parseFloat(form.perKmRate) : null,
        perKgRate: form.perKgRate ? parseFloat(form.perKgRate) : null,
        vehicleType: form.vehicleType || null,
        maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null,
        maxDistanceKm: form.maxDistanceKm ? parseFloat(form.maxDistanceKm) : null,
        assignedUserId: form.assignedUserId.trim() || null,
      }),
    });
    if (res.ok) { onCreated(await res.json()); onClose(); }
    else { setError("Failed to create service block"); }
    setLoading(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>Add Service Block</h3>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Bike Delivery, Express" style={iStyle} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Pricing Model</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[["fixed", "Fixed"], ["per_km", "Per km"], ["per_kg_km", "Per kg/km"]].map(([v, l]) => (
                <button type="button" key={v} onClick={() => set("pricingModel", v)}
                  style={{ flex: 1, padding: "6px 4px", borderRadius: 7, border: form.pricingModel === v ? "1.5px solid #6366f1" : "1px solid #DDDDDD", background: form.pricingModel === v ? "#EEF2FF" : "#F9FAFB", fontSize: 11, fontWeight: form.pricingModel === v ? 600 : 400, cursor: "pointer", color: form.pricingModel === v ? "#6366f1" : "#0F1111" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Base Price (₹)</label>
            <input type="number" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0" style={iStyle} />
          </div>
          {(form.pricingModel === "per_km" || form.pricingModel === "per_kg_km") && (
            <div>
              <label style={labelStyle}>Per km Rate (₹/km)</label>
              <input type="number" min="0" step="0.01" value={form.perKmRate} onChange={(e) => set("perKmRate", e.target.value)} placeholder="e.g. 8" style={iStyle} />
            </div>
          )}
          {form.pricingModel === "per_kg_km" && (
            <div>
              <label style={labelStyle}>Per kg Rate (₹/kg)</label>
              <input type="number" min="0" step="0.01" value={form.perKgRate} onChange={(e) => set("perKgRate", e.target.value)} placeholder="e.g. 5" style={iStyle} />
            </div>
          )}
          <div>
            <label style={labelStyle}>Vehicle Type (optional)</label>
            <select value={form.vehicleType} onChange={(e) => set("vehicleType", e.target.value)} style={iStyle}>
              <option value="">— None —</option>
              <option value="bike">🚲 Bike</option>
              <option value="auto">🛺 Auto</option>
              <option value="car">🚗 Car</option>
              <option value="van">🚐 Van</option>
              <option value="truck">🚚 Truck</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Max Weight (kg)</label>
              <input type="number" min="0" value={form.maxWeightKg} onChange={(e) => set("maxWeightKg", e.target.value)} placeholder="optional" style={iStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Max Distance (km)</label>
              <input type="number" min="0" value={form.maxDistanceKm} onChange={(e) => set("maxDistanceKm", e.target.value)} placeholder="optional" style={iStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Assigned Employee (User ID, optional)</label>
            <input value={form.assignedUserId} onChange={(e) => set("assignedUserId", e.target.value)} placeholder="paste userId" style={iStyle} />
          </div>
          <div>
            <label style={labelStyle}>Visibility</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[["public", "Public"], ["internal", "Internal"], ["inactive", "Inactive"]].map(([v, l]) => (
                <button type="button" key={v} onClick={() => set("visibility", v)}
                  style={{ flex: 1, padding: "6px 4px", borderRadius: 7, border: form.visibility === v ? "1.5px solid #6366f1" : "1px solid #DDDDDD", background: form.visibility === v ? "#EEF2FF" : "#F9FAFB", fontSize: 11, fontWeight: form.visibility === v ? 600 : 400, cursor: "pointer", color: form.visibility === v ? "#6366f1" : "#0F1111" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={onClose} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #DDDDDD", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Service Block Modal ─────────────────────────────────────────────────

function EditBlockModal({ block, onClose, onSaved, onDeleted }: {
  block: FleetBlock;
  onClose: () => void;
  onSaved: (updated: FleetBlock) => void;
  onDeleted: (id: string) => void;
}) {
  const [form, setForm] = useState({
    title: block.title, pricingModel: block.pricingModel ?? "fixed",
    price: block.price != null ? String(block.price) : "",
    perKmRate: block.perKmRate != null ? String(block.perKmRate) : "",
    perKgRate: block.perKgRate != null ? String(block.perKgRate) : "",
    vehicleType: block.vehicleType ?? "", maxWeightKg: block.maxWeightKg != null ? String(block.maxWeightKg) : "",
    maxDistanceKm: block.maxDistanceKm != null ? String(block.maxDistanceKm) : "",
    assignedUserId: block.assignedUserId ?? "", visibility: block.visibility ?? "public",
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setLoading(true);
    await fetch("/api/block", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({
        blockId: block.id, title: form.title.trim(), pricingModel: form.pricingModel,
        price: form.price ? parseFloat(form.price) : null,
        perKmRate: form.perKmRate ? parseFloat(form.perKmRate) : null,
        perKgRate: form.perKgRate ? parseFloat(form.perKgRate) : null,
        vehicleType: form.vehicleType || null, maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null,
        maxDistanceKm: form.maxDistanceKm ? parseFloat(form.maxDistanceKm) : null,
        assignedUserId: form.assignedUserId.trim() || null, visibility: form.visibility,
      }),
    });
    onSaved({ ...block, ...form, price: form.price ? parseFloat(form.price) : null, perKmRate: form.perKmRate ? parseFloat(form.perKmRate) : null, perKgRate: form.perKgRate ? parseFloat(form.perKgRate) : null, vehicleType: form.vehicleType || null, maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null, maxDistanceKm: form.maxDistanceKm ? parseFloat(form.maxDistanceKm) : null, assignedUserId: form.assignedUserId.trim() || null });
    setLoading(false);
    onClose();
  }

  async function del() {
    if (!confirm("Delete this service block?")) return;
    setDeleting(true);
    await fetch("/api/block", { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ blockId: block.id }) });
    onDeleted(block.id);
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>Edit Service Block</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={labelStyle}>Name</label><input value={form.title} onChange={(e) => set("title", e.target.value)} style={iStyle} /></div>
          <div>
            <label style={labelStyle}>Pricing Model</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[["fixed", "Fixed"], ["per_km", "Per km"], ["per_kg_km", "Per kg/km"]].map(([v, l]) => (
                <button type="button" key={v} onClick={() => set("pricingModel", v)}
                  style={{ flex: 1, padding: "6px 4px", borderRadius: 7, border: form.pricingModel === v ? "1.5px solid #6366f1" : "1px solid #DDDDDD", background: form.pricingModel === v ? "#EEF2FF" : "#F9FAFB", fontSize: 11, fontWeight: form.pricingModel === v ? 600 : 400, cursor: "pointer", color: form.pricingModel === v ? "#6366f1" : "#0F1111" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div><label style={labelStyle}>Base Price (₹)</label><input type="number" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} style={iStyle} /></div>
          {(form.pricingModel === "per_km" || form.pricingModel === "per_kg_km") && (
            <div><label style={labelStyle}>Per km Rate (₹/km)</label><input type="number" min="0" step="0.01" value={form.perKmRate} onChange={(e) => set("perKmRate", e.target.value)} style={iStyle} /></div>
          )}
          {form.pricingModel === "per_kg_km" && (
            <div><label style={labelStyle}>Per kg Rate (₹/kg)</label><input type="number" min="0" step="0.01" value={form.perKgRate} onChange={(e) => set("perKgRate", e.target.value)} style={iStyle} /></div>
          )}
          <div>
            <label style={labelStyle}>Vehicle Type</label>
            <select value={form.vehicleType} onChange={(e) => set("vehicleType", e.target.value)} style={iStyle}>
              <option value="">— None —</option>
              <option value="bike">🚲 Bike</option>
              <option value="auto">🛺 Auto</option>
              <option value="car">🚗 Car</option>
              <option value="van">🚐 Van</option>
              <option value="truck">🚚 Truck</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Max Weight (kg)</label><input type="number" min="0" value={form.maxWeightKg} onChange={(e) => set("maxWeightKg", e.target.value)} style={iStyle} /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Max Distance (km)</label><input type="number" min="0" value={form.maxDistanceKm} onChange={(e) => set("maxDistanceKm", e.target.value)} style={iStyle} /></div>
          </div>
          <div><label style={labelStyle}>Assigned Employee (User ID)</label><input value={form.assignedUserId} onChange={(e) => set("assignedUserId", e.target.value)} placeholder="optional" style={iStyle} /></div>
          <div>
            <label style={labelStyle}>Visibility</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[["public", "Public"], ["internal", "Internal"], ["inactive", "Inactive"]].map(([v, l]) => (
                <button type="button" key={v} onClick={() => set("visibility", v)}
                  style={{ flex: 1, padding: "6px 4px", borderRadius: 7, border: form.visibility === v ? "1.5px solid #6366f1" : "1px solid #DDDDDD", background: form.visibility === v ? "#EEF2FF" : "#F9FAFB", fontSize: 11, fontWeight: form.visibility === v ? 600 : 400, cursor: "pointer", color: form.visibility === v ? "#6366f1" : "#0F1111" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={loading} style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "Saving…" : "Save"}
            </button>
            <button onClick={del} disabled={deleting} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
              {deleting ? "…" : "Delete"}
            </button>
            <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #DDDDDD", background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Fleet Block Card ─────────────────────────────────────────────────────────

function FleetBlockCard({ block, onEdit }: { block: FleetBlock; onEdit: () => void }) {
  const icon = block.vehicleType ? (VEHICLE_ICON[block.vehicleType] ?? "🚛") : "🚛";
  const badge = visibilityBadge(block.visibility);
  return (
    <div style={{
      background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12,
      padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 14,
    }}>
      <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{block.title}</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, color: badge.color, background: badge.bg }}>
            {badge.label}
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#6366f1", fontWeight: 600, margin: "0 0 4px" }}>{pricingLabel(block)}</p>
        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#6B7280" }}>
          {block.maxWeightKg != null && <span>Max {block.maxWeightKg} kg</span>}
          {block.maxDistanceKm != null && <span>Max {block.maxDistanceKm} km</span>}
          {block.assignedUserId && <span>Employee assigned</span>}
        </div>
      </div>
      <button
        onClick={onEdit}
        style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151", flexShrink: 0 }}
      >
        Edit
      </button>
    </div>
  );
}

// ─── Delivery Fee Panel ────────────────────────────────────────────────────────

function DeliveryFeePanel({ storeId, initialFee, initialFreeAbove }: {
  storeId: string;
  initialFee: number | null;
  initialFreeAbove: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [fee, setFee] = useState(initialFee != null ? String(initialFee) : "");
  const [freeAbove, setFreeAbove] = useState(initialFreeAbove != null ? String(initialFreeAbove) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/store/${storeId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ deliveryFee: fee ? parseFloat(fee) : null, freeDeliveryAbove: freeAbove ? parseFloat(freeAbove) : null }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#F9FAFB", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}
      >
        <span>🚚 Global Delivery Fee</span>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            Default delivery charge (₹)
            <input type="number" min="0" placeholder="e.g. 50" value={fee} onChange={(e) => setFee(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 6, padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            Free delivery above (₹) <span style={{ fontWeight: 400, color: "#9CA3AF" }}>optional</span>
            <input type="number" min="0" placeholder="e.g. 500" value={freeAbove} onChange={(e) => setFreeAbove(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 6, padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </label>
          <button onClick={save} disabled={saving}
            style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: 8, background: saving ? "#a5b4fc" : "#6366f1", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main FleetEditor ─────────────────────────────────────────────────────────

export default function FleetEditor({ pageId }: { pageId: string }) {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<FleetBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editBlock, setEditBlock] = useState<FleetBlock | null>(null);

  useEffect(() => {
    fetch(`/api/fleet/${pageId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setStoreId(d.storeId ?? null);
        setSectionId(d.sectionId ?? null);
        setBlocks(d.blocks ?? []);
        setDeliveryFee(d.deliveryFee ?? null);
        setFreeDeliveryAbove(d.freeDeliveryAbove ?? null);
      })
      .finally(() => setLoading(false));
  }, [pageId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#6366f1", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {storeId && (
        <DeliveryFeePanel storeId={storeId} initialFee={deliveryFee} initialFreeAbove={freeDeliveryAbove} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {blocks.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#9CA3AF", fontSize: 14 }}>
            No service blocks yet. Add your first one below.
          </div>
        )}
        {blocks.map((block) => (
          <FleetBlockCard key={block.id} block={block} onEdit={() => setEditBlock(block)} />
        ))}
      </div>

      {sectionId && (
        <button
          onClick={() => setAddOpen(true)}
          style={{
            marginTop: 16, width: "100%", padding: "12px 0", borderRadius: 12,
            border: "2px dashed #C7D2FE", background: "#EEF2FF", color: "#6366f1",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          + Add Service Block
        </button>
      )}

      {!sectionId && !loading && (
        <p style={{ fontSize: 12, color: "#EF4444", marginTop: 12 }}>Fleet store not initialized. Refresh and try again.</p>
      )}

      {addOpen && sectionId && (
        <AddBlockModal
          sectionId={sectionId}
          onClose={() => setAddOpen(false)}
          onCreated={(block) => setBlocks((prev) => [...prev, block])}
        />
      )}

      {editBlock && (
        <EditBlockModal
          block={editBlock}
          onClose={() => setEditBlock(null)}
          onSaved={(updated) => setBlocks((prev) => prev.map((b) => b.id === updated.id ? updated : b))}
          onDeleted={(id) => setBlocks((prev) => prev.filter((b) => b.id !== id))}
        />
      )}
    </div>
  );
}
