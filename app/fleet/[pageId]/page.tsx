"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { geocodeSearch, reverseGeocode } from "@/lib/geo/geocode";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineKm } from "@/lib/geo/haversine";

// On-demand pin picker — Leaflet, loaded client-side only (same pattern as REQBCAST-1g2).
const MapPicker = dynamic(() => import("@/components/shared/MapPicker"), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────

interface PageInfo {
  title: string;
  description: string | null;
  avatarUrl: string | null;
  slug: string | null;
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Shared form styles ─────────────────────────────────────────────────────────

const iStyle: React.CSSProperties = {
  background: "#fff", color: "#0F1111", border: "1px solid #DDDDDD",
  borderRadius: 6, padding: "7px 10px", fontSize: 13, width: "100%",
  outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "#0F1111", display: "block", marginBottom: 4,
};

// ── Add Service Block Modal ───────────────────────────────────────────────────

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
            <button type="button" onClick={onClose} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #DDDDDD", background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Service Block Modal ───────────────────────────────────────────────────

function EditBlockModal({ block, onClose, onSaved, onDeleted }: {
  block: FleetBlock;
  onClose: () => void;
  onSaved: (updated: FleetBlock) => void;
  onDeleted: (id: string) => void;
}) {
  const [form, setForm] = useState({
    title: block.title,
    pricingModel: block.pricingModel ?? "fixed",
    price: block.price != null ? String(block.price) : "",
    perKmRate: block.perKmRate != null ? String(block.perKmRate) : "",
    perKgRate: block.perKgRate != null ? String(block.perKgRate) : "",
    vehicleType: block.vehicleType ?? "",
    maxWeightKg: block.maxWeightKg != null ? String(block.maxWeightKg) : "",
    maxDistanceKm: block.maxDistanceKm != null ? String(block.maxDistanceKm) : "",
    assignedUserId: block.assignedUserId ?? "",
    visibility: block.visibility ?? "public",
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setLoading(true);
    await fetch("/api/block", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({
        blockId: block.id,
        title: form.title.trim(),
        pricingModel: form.pricingModel,
        price: form.price ? parseFloat(form.price) : null,
        perKmRate: form.perKmRate ? parseFloat(form.perKmRate) : null,
        perKgRate: form.perKgRate ? parseFloat(form.perKgRate) : null,
        vehicleType: form.vehicleType || null,
        maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null,
        maxDistanceKm: form.maxDistanceKm ? parseFloat(form.maxDistanceKm) : null,
        assignedUserId: form.assignedUserId.trim() || null,
        visibility: form.visibility,
      }),
    });
    onSaved({
      ...block, ...form,
      price: form.price ? parseFloat(form.price) : null,
      perKmRate: form.perKmRate ? parseFloat(form.perKmRate) : null,
      perKgRate: form.perKgRate ? parseFloat(form.perKgRate) : null,
      vehicleType: form.vehicleType || null,
      maxWeightKg: form.maxWeightKg ? parseFloat(form.maxWeightKg) : null,
      maxDistanceKm: form.maxDistanceKm ? parseFloat(form.maxDistanceKm) : null,
      assignedUserId: form.assignedUserId.trim() || null,
    });
    setLoading(false);
    onClose();
  }

  async function del() {
    if (!confirm("Delete this service block?")) return;
    setDeleting(true);
    await fetch("/api/block", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ blockId: block.id }),
    });
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
            <button onClick={onClose} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #DDDDDD", background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Delivery Fee Panel ─────────────────────────────────────────────────────────

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
      body: JSON.stringify({
        deliveryFee: fee ? parseFloat(fee) : null,
        freeDeliveryAbove: freeAbove ? parseFloat(freeAbove) : null,
      }),
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

// ── Block card in edit mode (shows visibility badge + Edit button) ─────────────

function EditableBlockCard({ block, onEdit }: { block: FleetBlock; onEdit: () => void }) {
  const icon = block.vehicleType ? (VEHICLE_ICON[block.vehicleType] ?? "🚛") : "🚛";
  const badge = visibilityBadge(block.visibility);
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 14 }}>
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

// ── Public block card (visitor view, same layout as before) ───────────────────

function PublicBlockCard({ block, disabled, onBook }: { block: FleetBlock; disabled: boolean; onBook: () => void }) {
  const icon = block.vehicleType ? (VEHICLE_ICON[block.vehicleType] ?? "🚛") : "🚛";
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <span style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 2px" }}>{block.title}</p>
        <p style={{ fontSize: 14, color: "#6366f1", fontWeight: 600, margin: "0 0 4px" }}>{pricingLabel(block)}</p>
        <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#9CA3AF" }}>
          {block.maxWeightKg != null && <span>Max {block.maxWeightKg} kg</span>}
          {block.maxDistanceKm != null && <span>Max {block.maxDistanceKm} km</span>}
        </div>
      </div>
      <button
        onClick={onBook}
        disabled={disabled}
        style={{
          display: "inline-block", padding: "9px 18px", borderRadius: 10, fontWeight: 700, fontSize: 13, flexShrink: 0,
          background: disabled ? "#F3F4F6" : "#FEF3C7", color: disabled ? "#9CA3AF" : "#B45309",
          border: `1px solid ${disabled ? "#E5E7EB" : "#FDE68A"}`, cursor: disabled ? "default" : "pointer",
        }}
      >
        {disabled ? "Closed" : "Book →"}
      </button>
    </div>
  );
}

// ── Booking modal — start/drop locations, price computed from the block's pricing model ──

type GeoPoint = { lat: number; lng: number; label: string };
type Addr = { id: string; name: string; line1: string; city: string; lat: number | null; lng: number | null; isDefault: boolean };
const TEMP = "__temp__"; // sentinel select value → one-off location, not a saved address

function locBtn(outline = false): React.CSSProperties {
  return { padding: "7px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", color: outline ? "#6366f1" : "#fff", background: outline ? "#F9FAFB" : "#6366f1", border: outline ? "1px solid #DDDDDD" : "none" };
}

// Saved-address dropdown + a "different location" option resolved by search,
// live GPS, or an on-demand draggable map pin — same pattern as the errand
// pickup/drop picker in app/app/requests/page.tsx (REQBCAST-1g2).
function LocSelect({ label, value, onChange, addrs, temp, onTemp, defaultCenter, allowGps }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  addrs: Addr[];
  temp: GeoPoint | null;
  onTemp: (l: GeoPoint | null) => void;
  defaultCenter: GeoPoint;
  allowGps?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={iStyle}>
        <option value="">— Select —</option>
        {addrs.filter((a) => a.lat != null).map((a) => <option key={a.id} value={a.id}>{a.name} — {a.line1}, {a.city}</option>)}
        <option value={TEMP}>Use a different location…</option>
      </select>
      {value === TEMP && <TempPicker temp={temp} onResolve={onTemp} defaultCenter={defaultCenter} allowGps={allowGps} />}
    </div>
  );
}

function TempPicker({ temp, onResolve, defaultCenter, allowGps }: {
  temp: GeoPoint | null;
  onResolve: (l: GeoPoint | null) => void;
  defaultCenter: GeoPoint;
  allowGps?: boolean;
}) {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [none, setNone] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoPoint[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [reverse, setReverse] = useState(false);
  const geo = useGeolocation();
  const gotFix = useRef(false);
  const queryIdRef = useRef(0);

  const center = temp ?? defaultCenter;

  useEffect(() => {
    const query = q.trim();
    if (!query) { setSuggestions([]); setNone(false); return; }
    const id = ++queryIdRef.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await geocodeSearch(query, center);
        if (id !== queryIdRef.current) return;
        setSuggestions(results);
        setNone(results.length === 0);
      } catch {
        if (id === queryIdRef.current) { setSuggestions([]); setNone(true); }
      } finally {
        if (id === queryIdRef.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, center.lat, center.lng]);

  async function go() {
    const query = q.trim();
    if (!query) return;
    const id = ++queryIdRef.current;
    setSearching(true); setNone(false); onResolve(null);
    try {
      const results = await geocodeSearch(query, center);
      if (id !== queryIdRef.current) return;
      setSuggestions(results);
      if (results.length > 0) onResolve(results[0]); else setNone(true);
    } catch {
      if (id === queryIdRef.current) setNone(true);
    } finally {
      if (id === queryIdRef.current) setSearching(false);
    }
  }

  function pick(s: GeoPoint) {
    onResolve(s);
    setSuggestions([]);
    setNone(false);
    setQ(s.label);
  }

  function useCurrent() {
    setLocating(true); setNone(false); gotFix.current = false;
    geo.startWatch(async (lat, lng) => {
      if (gotFix.current) return;
      gotFix.current = true;
      geo.stopWatch();
      const label = await reverseGeocode(lat, lng);
      onResolve({ lat, lng, label });
      setLocating(false);
    }, () => { geo.stopWatch(); setLocating(false); });
  }

  async function onPin(lat: number, lng: number) {
    setReverse(true);
    const label = await reverseGeocode(lat, lng);
    onResolve({ lat, lng, label });
    setReverse(false);
  }
  function openMap() {
    setNone(false); setMapOpen(true);
    if (!temp) onPin(defaultCenter.lat, defaultCenter.lng);
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 6, position: "relative" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }}
          placeholder="Search an address or place" style={{ ...iStyle, marginBottom: 0 }} />
        <button type="button" disabled={searching || !q.trim()} onClick={go} style={{ ...locBtn(), opacity: searching || !q.trim() ? 0.5 : 1, flexShrink: 0 }}>
          {searching ? "…" : "Search"}
        </button>
        {suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, marginTop: 2, overflow: "hidden" }}>
            {suggestions.map((s, i) => (
              <button key={i} type="button" onClick={() => pick(s)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "#374151" }}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {allowGps && (
          <button type="button" disabled={locating} onClick={useCurrent} style={{ ...locBtn(true), opacity: locating ? 0.5 : 1 }}>
            {locating ? "Locating…" : "📍 Use my current location"}
          </button>
        )}
        <button type="button" onClick={() => (mapOpen ? setMapOpen(false) : openMap())} style={locBtn(true)}>
          🗺️ Set on map
        </button>
      </div>
      {mapOpen && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>Drag the pin to adjust</div>
          <MapPicker lat={center.lat} lng={center.lng} onMove={onPin} />
          <button type="button" onClick={() => setMapOpen(false)} style={{ ...locBtn(), marginTop: 6, width: "100%" }}>
            Use this location
          </button>
        </div>
      )}
      {(reverse || (locating && !mapOpen)) && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>Finding address…</div>}
      {temp && <div style={{ fontSize: 12, color: "#059669", marginTop: 4 }}>📍 {temp.label}</div>}
      {none && (
        <div style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>
          No match found — try a more specific search.{" "}
          <button type="button" onClick={openMap} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", padding: 0, fontSize: 12, textDecoration: "underline" }}>
            Set it on the map instead
          </button>
        </div>
      )}
    </div>
  );
}

function BookModal({ pageId, block, addrs, onClose }: { pageId: string; block: FleetBlock; addrs: Addr[]; onClose: () => void }) {
  const defaultAddr = addrs.find((a) => a.isDefault && a.lat != null) ?? addrs.find((a) => a.lat != null);
  const [fStart, setFStart] = useState(defaultAddr?.id ?? "");
  const [startTemp, setStartTemp] = useState<GeoPoint | null>(null);
  const [fDrop, setFDrop] = useState("");
  const [dropTemp, setDropTemp] = useState<GeoPoint | null>(null);
  const [weightKg, setWeightKg] = useState("1");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ total: number; distanceKm: number } | null>(null);

  const needsWeight = (block.pricingModel ?? "fixed") === "per_kg_km";

  // Resolve a pickup/drop selection to coords + label, from a saved address OR a one-off temp location.
  function resolveLoc(id: string, temp: GeoPoint | null): GeoPoint | null {
    if (id === TEMP) return temp;
    const a = addrs.find((x) => x.id === id);
    if (!a || a.lat == null || a.lng == null) return null;
    return { lat: a.lat, lng: a.lng, label: `${a.name} — ${a.city}` };
  }
  const start = resolveLoc(fStart, startTemp);
  const drop = resolveLoc(fDrop, dropTemp);
  const defaultCenter: GeoPoint = defaultAddr && defaultAddr.lat != null && defaultAddr.lng != null
    ? { lat: defaultAddr.lat, lng: defaultAddr.lng, label: "" }
    : { lat: 12.9716, lng: 77.5946, label: "" }; // Bangalore — last-resort map centre

  const distanceKm = start && drop ? haversineKm(start.lat, start.lng, drop.lat, drop.lng) : null;
  const weight = parseFloat(weightKg) || 1;
  const estimate = distanceKm == null ? null : (() => {
    const model = block.pricingModel ?? "fixed";
    if (model === "per_km") return (block.price ?? 0) + (block.perKmRate ?? 0) * distanceKm;
    if (model === "per_kg_km") return (block.perKgRate ?? 0) * weight + (block.perKmRate ?? 0) * distanceKm;
    return block.price ?? 0;
  })();

  async function submit() {
    if (!start || !drop) return;
    setBooking(true);
    setError("");
    try {
      const res = await fetch(`/api/fleet/${pageId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          blockId: block.id,
          startLat: start.lat, startLng: start.lng, startLabel: start.label,
          dropLat: drop.lat, dropLng: drop.lng, dropLabel: drop.label,
          weightKg: needsWeight ? weight : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Booking failed"); return; }
      setDone({ total: data.total, distanceKm: data.distanceKm });
    } catch {
      setError("Booking failed");
    } finally {
      setBooking(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>✅</p>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Booked!</h3>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 16px" }}>
              ₹{done.total.toLocaleString("en-IN")} · {done.distanceKm} km
            </p>
            <a href="/app/orders?tab=my"
              style={{ display: "inline-block", padding: "10px 20px", borderRadius: 8, background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              View my orders →
            </a>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>Book {block.title}</h3>
            <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 16px" }}>{pricingLabel(block)}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <LocSelect
                label="Start location"
                value={fStart} onChange={setFStart}
                addrs={addrs} temp={startTemp} onTemp={setStartTemp}
                defaultCenter={defaultCenter} allowGps
              />
              <LocSelect
                label="Drop location"
                value={fDrop} onChange={setFDrop}
                addrs={addrs} temp={dropTemp} onTemp={setDropTemp}
                defaultCenter={defaultCenter}
              />
              {needsWeight && (
                <div>
                  <label style={labelStyle}>Approx. weight (kg)</label>
                  <input type="number" min="0.1" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} style={iStyle} />
                </div>
              )}
              {estimate != null && distanceKm != null && (
                <div style={{ padding: "10px 12px", borderRadius: 8, background: "#EEF2FF", fontSize: 13, color: "#4338CA", fontWeight: 600 }}>
                  Estimated ₹{Math.round(estimate).toLocaleString("en-IN")} · {distanceKm.toFixed(1)} km
                </div>
              )}
              {error && <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{error}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={submit} disabled={!start || !drop || booking}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: (!start || !drop || booking) ? 0.5 : 1 }}>
                  {booking ? "Booking…" : "Confirm booking"}
                </button>
                <button type="button" onClick={onClose} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #DDDDDD", background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FleetPage() {
  const params = useParams();
  const pageId = params?.pageId as string;
  const router = useRouter();

  const [page, setPage] = useState<PageInfo | null>(null);
  const [blocks, setBlocks] = useState<FleetBlock[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState<number | null>(null);
  const [acceptingOrders, setAcceptingOrders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editBlock, setEditBlock] = useState<FleetBlock | null>(null);
  const [bookBlock, setBookBlock] = useState<FleetBlock | null>(null);
  const [addrs, setAddrs] = useState<Addr[]>([]);

  // API returns storeId only for the page owner
  const isOwner = !!storeId;

  useEffect(() => {
    fetch(`/api/fleet/${pageId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setPage(d.page ?? null);
        setBlocks(d.blocks ?? []);
        setStoreId(d.storeId ?? null);
        setSectionId(d.sectionId ?? null);
        setDeliveryFee(d.deliveryFee ?? null);
        setFreeDeliveryAbove(d.freeDeliveryAbove ?? null);
        setAcceptingOrders(d.acceptingOrders ?? false);
        // Canonical redirect: cuid → slug
        if (d.page?.slug && pageId !== d.page.slug) router.replace(`/fleet/${d.page.slug}`);
      })
      .finally(() => setLoading(false));
    fetch("/api/store/address", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((a) => setAddrs(Array.isArray(a) ? a : []))
      .catch(() => {});
  }, [pageId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#6366f1", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!page) {
    return (
      <div style={{ minHeight: "100vh", background: "#F9FAFB", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 14, color: "#9CA3AF" }}>Fleet not found.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "20px 0" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {page.avatarUrl ? (
              <img src={page.avatarUrl} alt={page.title} style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 12, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>
                🚛
              </div>
            )}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>{page.title}</h1>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "#FEF3C7", color: "#B45309", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Fleet
                </span>
              </div>
              {page.description && (
                <p style={{ fontSize: 14, color: "#6B7280", margin: "4px 0 0", lineHeight: 1.5 }}>{page.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 20px" }}>
        {/* Delivery fee panel — edit mode only */}
        {editMode && storeId && (
          <DeliveryFeePanel storeId={storeId} initialFee={deliveryFee} initialFreeAbove={freeDeliveryAbove} />
        )}

        {/* Taking-bookings banner — visitors only, same idea as the store "Taking orders" banner */}
        {!isOwner && (
          <div style={{
            marginBottom: 16, padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: acceptingOrders ? "#F0FDF4" : "#FFFBEB",
            color: acceptingOrders ? "#15803D" : "#B45309",
            border: `1px solid ${acceptingOrders ? "#BBF7D0" : "#FDE68A"}`,
          }}>
            {acceptingOrders ? "Fleet on Service — accepting bookings" : "Not taking bookings right now"}
          </div>
        )}

        {blocks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#9CA3AF" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚛</div>
            <p style={{ fontSize: 15 }}>
              {editMode ? "No service blocks yet. Add your first one below." : "No services listed yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {blocks.map((block) =>
              editMode ? (
                <EditableBlockCard key={block.id} block={block} onEdit={() => setEditBlock(block)} />
              ) : (
                <PublicBlockCard
                  key={block.id}
                  block={block}
                  disabled={!acceptingOrders}
                  onBook={() => setBookBlock(block)}
                />
              )
            )}
          </div>
        )}

        {/* Add block button — edit mode only */}
        {editMode && sectionId && (
          <button
            onClick={() => setAddOpen(true)}
            style={{ marginTop: 16, width: "100%", padding: "12px 0", borderRadius: 12, border: "2px dashed #C7D2FE", background: "#EEF2FF", color: "#6366f1", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            + Add Service Block
          </button>
        )}
      </div>

      {/* Floating edit button — owner only, same position and style as store page */}
      {isOwner && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 50, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <button
            onClick={() => setEditMode((e) => !e)}
            style={{ padding: "10px 20px", borderRadius: 24, background: editMode ? "#6366f1" : "#fff", color: editMode ? "#fff" : "#0F1111", border: "1px solid #DDDDDD", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {editMode ? "✓ Done Editing" : "✏️ Edit Fleet"}
          </button>
        </div>
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
      {bookBlock && (
        <BookModal pageId={pageId} block={bookBlock} addrs={addrs} onClose={() => setBookBlock(null)} />
      )}
    </div>
  );
}
