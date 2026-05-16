"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStoreShell } from "@/app/store/[id]/StoreShellContext";
import QuickOrderModal from "@/components/store/QuickOrderModal";
import StoreImagePickerModal from "@/components/store/StoreImagePickerModal";

const A = {
  bg: "#E3E6E6",
  nav: "#131921",
  surface: "#FFFFFF",
  border: "#DDDDDD",
  text: "#0F1111",
  textMuted: "#565959",
  accent: "#6366f1",
  accentHover: "#4f46e5",
  link: "#007185",
};

type MediaType = "image" | "video" | "link" | "none";
type ActionType = "view" | "buy" | "book" | "contact" | "subscribe";
type RatingData = { average: number; count: number; userRating: number | null };

type Block = {
  id: string;
  title: string;
  description?: string | null;
  mediaType: MediaType;
  mediaUrl?: string | null;
  actionType: ActionType;
  price?: number | null;
};

type CartItem = {
  id: string;
  blockId: string;
  quantity: number;
  block: {
    id: string;
    title: string;
    price: number | null;
    mediaUrl: string | null;
    mediaType: string;
  };
};

type Address = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
};

const inputCls = "w-full text-sm px-3 py-2 rounded-md outline-none placeholder:text-zinc-500";
const inputStyle = { background: "#fff", color: A.text, border: `1px solid ${A.border}` };

// ─── Overlay ──────────────────────────────────────────────────────────────────

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-xl p-5 shadow-2xl" style={{ background: "#fff", border: `1px solid ${A.border}` }}>
        {children}
        <button onClick={onClose} className="mt-3 w-full text-xs py-2 rounded-md"
          style={{ color: A.textMuted, border: `1px solid ${A.border}`, background: "#fff" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({ open, onClose, items, onRemove, storeName, onCheckout }: {
  open: boolean; onClose: () => void; items: CartItem[];
  onRemove: (blockId: string) => void; storeName: string; onCheckout: () => void;
}) {
  const total = items.reduce((s, i) => s + (i.block.price ?? 0) * i.quantity, 0);
  return (
    <div className={`fixed inset-0 z-50 ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div onClick={onClose} className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.45)", opacity: open ? 1 : 0, transition: "opacity 0.2s" }} />
      <div className="absolute right-0 top-0 h-full"
        style={{ width: 380, maxWidth: "92vw", background: "#fff", borderLeft: `1px solid ${A.border}`, boxShadow: "-10px 0 30px rgba(0,0,0,0.16)", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s" }}>
        <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: A.border }}>
          <h3 className="font-semibold" style={{ color: A.text }}>Cart — {storeName}</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="p-4" style={{ height: "calc(100% - 130px)", overflowY: "auto" }}>
          {items.length === 0
            ? <div className="h-full flex items-center justify-center text-sm" style={{ color: A.textMuted }}>Your cart is empty</div>
            : items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: "#f0f0f0" }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", background: "#f3f4f6", flexShrink: 0 }}>
                  {i.block.mediaUrl ? <img src={i.block.mediaUrl} className="w-full h-full object-cover" alt={i.block.title} /> : <div />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{i.block.title}</div>
                  <div className="text-xs" style={{ color: A.textMuted }}>{i.block.price == null ? "Free" : `₹${i.block.price}`}</div>
                  <div className="text-xs" style={{ color: A.textMuted }}>Qty: {i.quantity}</div>
                </div>
                <button className="text-xs" style={{ color: "#EF4444" }} onClick={() => onRemove(i.blockId)}>×</button>
              </div>
            ))
          }
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white" style={{ borderColor: A.border }}>
          <div className="font-semibold mb-2">Total: ₹{total.toLocaleString("en-IN")}</div>
          <button onClick={onCheckout} disabled={!items.length} className="w-full py-2 rounded-md text-sm font-semibold"
            style={{ background: A.accent, color: "#fff", opacity: items.length ? 1 : 0.5 }}>
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Address Modal ────────────────────────────────────────────────────────────

function AddressModal({ open, onClose, onSelected }: {
  open: boolean; onClose: () => void; onSelected: (address: Address) => void;
}) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", line1: "", city: "", state: "", pincode: "" });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/store/address", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((a: Address[]) => { setAddresses(a); const d = a.find((x) => x.isDefault) ?? a[0]; if (d) setSelected(d.id); })
      .catch(() => {});
  }, [open]);

  if (!open) return null;
  return (
    <Overlay onClose={onClose}>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Select delivery address</h3>
        {addresses.map((a) => (
          <button key={a.id} onClick={() => setSelected(a.id)} className="w-full text-left p-2 rounded-md"
            style={{ border: `1px solid ${selected === a.id ? A.accent : A.border}` }}>
            <div className="text-xs font-semibold">{a.name} · {a.phone}</div>
            <div className="text-xs" style={{ color: A.textMuted }}>{a.line1}, {a.city}, {a.state} {a.pincode}</div>
          </button>
        ))}
        <button className="text-xs" style={{ color: A.link }} onClick={() => { setAdding((v) => !v); setFormError(""); }}>+ Add new address</button>
        {adding && (
          <div className="space-y-2">
            {Object.keys(form).map((k) => (
              <input key={k} value={(form as any)[k]}
                onChange={(e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setFormError(""); }}
                placeholder={k} className={inputCls} style={inputStyle} />
            ))}
            {formError && <p className="text-xs" style={{ color: "#EF4444" }}>{formError}</p>}
            <button className="text-xs px-3 py-1 rounded" style={{ background: A.accent, color: "#fff" }}
              onClick={async () => {
                const { name, phone, line1, city, state, pincode } = form;
                if (!name.trim() || !phone.trim() || !line1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
                  setFormError("Please fill all address fields");
                  return;
                }
                setFormError("");
                const r = await fetch("/api/store/address", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: name.trim(), phone: phone.trim(), line1: line1.trim(), city: city.trim(), state: state.trim(), pincode: pincode.trim(), isDefault: true }) });
                if (r.ok) { const a = await r.json(); setAddresses((p) => [a, ...p]); setSelected(a.id); setAdding(false); setForm({ name: "", phone: "", line1: "", city: "", state: "", pincode: "" }); }
              }}>Save address</button>
          </div>
        )}
        <button disabled={!selected}
          onClick={() => { const addr = addresses.find((a) => a.id === selected); if (addr) onSelected(addr); onClose(); }}
          className="w-full py-2 rounded text-xs"
          style={{ background: A.accent, color: "#fff", opacity: selected ? 1 : 0.5 }}>
          Use this address
        </button>
      </div>
    </Overlay>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────

const CHECKOUT_PERSONAL_ID = "personal";
const CHECKOUT_SKIP_ID = "none";

type CheckoutBillingProfile = {
  id: string; legalName: string; gstNumber: string | null;
  linkedStore: { name: string } | null;
};

function CheckoutModal({ open, onClose, items, total, storeId, onOrderPlaced }: {
  open: boolean; onClose: () => void; items: CartItem[];
  total: number; storeId: string; onOrderPlaced: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", line1: "", city: "", state: "", pincode: "" });
  const [formError, setFormError] = useState("");

  // Invoice step state
  const [billingProfiles, setBillingProfiles] = useState<CheckoutBillingProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(CHECKOUT_PERSONAL_ID);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1); setSuccess(false); setSelectedProfileId(CHECKOUT_PERSONAL_ID);
    fetch("/api/store/address", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((a: Address[]) => { setAddresses(a); const d = a.find((x) => x.isDefault) ?? a[0]; if (d) setSelected(d.id); })
      .catch(() => {});
  }, [open]);

  // Fetch billing profiles + user when reaching invoice step
  useEffect(() => {
    if (!open || step !== 2) return;
    Promise.all([
      fetch("/api/store/billing-profiles", { credentials: "include" }).then((r) => r.ok ? r.json() : []),
      fetch("/api/user/me", { credentials: "include" }).then((r) => r.ok ? r.json() : { user: null }),
    ]).then(([profiles, meData]) => {
      setBillingProfiles(Array.isArray(profiles) ? profiles : []);
      setUserName(meData?.user?.name ?? null);
    }).catch(() => {});
  }, [open, step]);

  const selectedAddr = addresses.find((a) => a.id === selected);

  async function handlePlaceOrder() {
    setPlacing(true);
    const body: Record<string, unknown> = { storeId, addressId: selected };
    if (selectedProfileId === CHECKOUT_PERSONAL_ID) {
      body.invoiceData = {
        legalName: userName ?? selectedAddr?.name ?? "Customer",
        addressLine: selectedAddr?.line1 ?? "",
        city: selectedAddr?.city ?? "",
        state: selectedAddr?.state ?? "",
        pinCode: selectedAddr?.pincode ?? "",
      };
    } else if (selectedProfileId !== CHECKOUT_SKIP_ID) {
      body.billingProfileId = selectedProfileId;
    }
    const r = await fetch("/api/store/orders", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify(body),
    });
    setPlacing(false);
    if (r.ok) { setSuccess(true); onOrderPlaced(); setTimeout(onClose, 3000); }
  }

  if (!open) return null;
  return (
    <Overlay onClose={onClose}>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Checkout</h3>

        {/* ── Step 1: Address ── */}
        {step === 1 && (
          <>
            <div className="space-y-2 max-h-48 overflow-auto">
              {addresses.map((a) => (
                <button key={a.id} onClick={() => setSelected(a.id)} className="w-full text-left p-2 rounded-md"
                  style={{ border: `1px solid ${selected === a.id ? A.accent : A.border}` }}>
                  <div className="text-xs font-semibold">{a.name} · {a.phone}</div>
                  <div className="text-xs" style={{ color: A.textMuted }}>{a.line1}, {a.city}, {a.state} {a.pincode}</div>
                </button>
              ))}
            </div>
            <button className="text-xs" style={{ color: A.link }} onClick={() => { setAdding((v) => !v); setFormError(""); }}>+ Add new address</button>
            {adding && (
              <div className="space-y-2">
                {Object.keys(form).map((k) => (
                  <input key={k} value={(form as any)[k]}
                    onChange={(e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setFormError(""); }}
                    placeholder={k} className={inputCls} style={inputStyle} />
                ))}
                {formError && <p className="text-xs" style={{ color: "#EF4444" }}>{formError}</p>}
                <button className="text-xs px-3 py-1 rounded" style={{ background: A.accent, color: "#fff" }}
                  onClick={async () => {
                    const { name, phone, line1, city, state, pincode } = form;
                    if (!name.trim() || !phone.trim() || !line1.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
                      setFormError("Please fill all address fields"); return;
                    }
                    setFormError("");
                    const r = await fetch("/api/store/address", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: name.trim(), phone: phone.trim(), line1: line1.trim(), city: city.trim(), state: state.trim(), pincode: pincode.trim(), isDefault: false }) });
                    if (r.ok) { const a = await r.json(); setAddresses((p) => [...p, a]); setSelected(a.id); setAdding(false); setForm({ name: "", phone: "", line1: "", city: "", state: "", pincode: "" }); }
                  }}>Save address</button>
              </div>
            )}
            <button disabled={!selected} onClick={() => setStep(2)} className="w-full py-2 rounded text-xs"
              style={{ background: A.accent, color: "#fff", opacity: selected ? 1 : 0.5 }}>
              Next →
            </button>
          </>
        )}

        {/* ── Step 2: Invoice ── */}
        {step === 2 && (
          <>
            <p className="text-xs font-medium" style={{ color: A.textMuted }}>Invoice type</p>
            <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}
              className={inputCls} style={inputStyle}>
              <option value={CHECKOUT_PERSONAL_ID}>Personal (no GST)</option>
              {billingProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.legalName}{p.gstNumber ? ` — GST: ${p.gstNumber}` : ""}{p.linkedStore ? ` (${p.linkedStore.name})` : ""}
                </option>
              ))}
              <option value={CHECKOUT_SKIP_ID}>Don't need invoice</option>
            </select>
            {selectedProfileId === CHECKOUT_PERSONAL_ID && (
              <div className="rounded p-2 text-xs space-y-0.5" style={{ background: "#F9FAFB", border: `1px solid ${A.border}` }}>
                <p className="font-semibold" style={{ color: A.text }}>{userName ?? selectedAddr?.name ?? "Personal"}</p>
                {selectedAddr && <p style={{ color: A.textMuted }}>{selectedAddr.line1}, {selectedAddr.city}, {selectedAddr.state} {selectedAddr.pincode}</p>}
                <p style={{ color: A.textMuted }}>
                  Want GST?{" "}
                  <a href="/store/account?tab=invoice" target="_blank" rel="noreferrer" style={{ color: A.accent }}>Save a billing profile</a>.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="text-xs px-3 py-1.5 rounded" style={{ border: `1px solid ${A.border}`, color: A.textMuted }}>← Back</button>
              <button onClick={() => setStep(3)} className="flex-1 py-1.5 rounded text-xs font-semibold" style={{ background: A.accent, color: "#fff" }}>Next →</button>
            </div>
          </>
        )}

        {/* ── Step 3: Review + place ── */}
        {step === 3 && (
          <>
            {success ? (
              <div className="text-sm py-4 text-center" style={{ color: "#16A34A" }}>
                ✓ Order placed!<br />
                <span className="text-xs" style={{ color: A.textMuted }}>The store owner will contact you shortly.</span>
              </div>
            ) : (
              <>
                <div className="text-xs space-y-1 max-h-32 overflow-auto">
                  {items.map((i) => (
                    <div key={i.id} className="flex justify-between">
                      <span>{i.block.title} ×{i.quantity}</span>
                      <span>₹{((i.block.price ?? 0) * i.quantity).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs font-semibold flex justify-between border-t pt-1" style={{ borderColor: A.border }}>
                  <span>Total</span><span>₹{total.toLocaleString("en-IN")}</span>
                </div>
                <div className="text-xs px-2 py-1 rounded" style={{ background: "#F0FDF4", color: "#16A34A" }}>
                  💵 Cash on Delivery
                </div>
                <button onClick={() => setStep(2)} className="text-xs" style={{ color: A.link }}>← Change invoice</button>
                <button disabled={placing} onClick={handlePlaceOrder}
                  className="w-full py-2 rounded text-xs font-semibold" style={{ background: A.accent, color: "#fff" }}>
                  {placing ? "Placing…" : "Place Order"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}

// ─── AddBlockModal ────────────────────────────────────────────────────────────

function AddBlockModal({ sectionId, storeId, onClose, onCreated }: {
  sectionId: string; storeId: string; onClose: () => void; onCreated: (block: Block) => void;
}) {
  const [form, setForm] = useState({ title: "", description: "", mediaType: "image" as MediaType, mediaUrl: "", actionType: "view" as ActionType, price: "" });
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showPasteUrl, setShowPasteUrl] = useState(false);
  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    const res = await fetch("/api/block", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ sectionId, title: form.title, description: form.description || null, mediaType: form.mediaType, mediaUrl: form.mediaUrl || null, actionType: form.actionType, price: form.price ? parseFloat(form.price) : null }) });
    if (res.ok) { onCreated(await res.json()); onClose(); }
    setLoading(false);
  }

  return (
    <>
      <Overlay onClose={onClose}>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold" style={{ color: A.text }}>New product</h3>
          <input autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Title" className={inputCls} style={inputStyle} />
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Description (optional)" rows={2} className={inputCls} style={inputStyle} />

          {/* Image field — library picker + paste URL */}
          <div className="space-y-2">
            {form.mediaUrl && (
              <div className="relative">
                <img src={form.mediaUrl} alt="" className="w-full max-h-28 object-cover rounded-md" />
                <button type="button" onClick={() => set("mediaUrl", "")}
                  className="absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>✕</button>
              </div>
            )}
            <button type="button" onClick={() => setShowPicker(true)}
              className="w-full py-2 rounded-md text-xs font-medium"
              style={{ border: `1px solid ${A.accent}`, color: A.accent, background: "#EEF2FF", cursor: "pointer" }}>
              📂 Choose from library
            </button>
            <button type="button" onClick={() => setShowPasteUrl((v) => !v)}
              className="text-xs" style={{ color: A.textMuted, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              {showPasteUrl ? "Hide URL input" : "Paste URL instead"}
            </button>
            {showPasteUrl && (
              <input value={form.mediaUrl} onChange={(e) => { set("mediaUrl", e.target.value); set("mediaType", "image"); }}
                placeholder="https://… image or video URL"
                className={inputCls} style={inputStyle} />
            )}
          </div>

          <input value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Price (optional)" inputMode="decimal" className={inputCls} style={inputStyle} />
          <button type="submit" disabled={loading || !form.title.trim()} className="py-2 rounded-md text-xs font-semibold disabled:opacity-40"
            style={{ background: A.accent, color: "#fff", border: `1px solid ${A.accentHover}` }}>
            {loading ? "Adding…" : "Add product"}
          </button>
        </form>
      </Overlay>

      {showPicker && (
        <StoreImagePickerModal
          storeId={storeId}
          onSelect={(url) => { set("mediaUrl", url); set("mediaType", "image"); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

// ─── TopNav ───────────────────────────────────────────────────────────────────

function TopNav({
  storeName,
  isOwner,
  editMode,
  onToggleEdit,
  onSearch,
  searchQuery,
  userName,
  onAccountClick,
  onCartOpen,
  cartCount,
  onAddressClick,
  deliveryLabel,
  storeId,
}: {
  storeName: string;
  isOwner: boolean;
  editMode: boolean;
  onToggleEdit: () => void;
  onSearch: (q: string) => void;
  searchQuery: string;
  userName?: string | null;
  onAccountClick?: () => void;
  onCartOpen: () => void;
  cartCount: number;
  onAddressClick: () => void;
  deliveryLabel: string;
  storeId: string;
}) {
  function MobileMenu({ isOwner, editMode, onToggleEdit, userName, onAddressClick, deliveryLabel }: { isOwner: boolean; editMode: boolean; onToggleEdit: () => void; userName?: string | null; storeId: string; onAddressClick: () => void; deliveryLabel: string }) {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ position: "relative" }}>
        <button onClick={() => setOpen((o) => !o)} className="text-white text-lg" style={{ flexShrink: 0 }}>☰</button>
        {open && (
          <div style={{ position: "absolute", right: 0, top: 28, width: 220, background: "#fff", border: `1px solid ${A.border}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", zIndex: 60 }}>
            <div style={{ padding: "10px 16px", fontSize: 12, borderBottom: "1px solid #f0f0f0", color: A.textMuted }}>
              📍 {deliveryLabel}
              <button onClick={() => { onAddressClick(); setOpen(false); }} style={{ marginLeft: 8, fontSize: 11, color: "#6366f1", border: "none", background: "none", cursor: "pointer" }}>Change</button>
            </div>
            <a href="/store/account" style={{ display: "block", padding: "10px 16px", fontSize: 12, color: A.text, textDecoration: "none" }}>{userName ? `Hello, ${userName.split(" ")[0]}` : "Hello, Sign in"}</a>
            <a href="/store/account?tab=orders" style={{ display: "block", padding: "10px 16px", fontSize: 12, color: A.text, textDecoration: "none" }}>Orders</a>
            {isOwner && <button onClick={() => { onToggleEdit(); setOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 12, border: "none", background: "none", color: A.text }}>{editMode ? "Done" : "Edit Section"}</button>}
          </div>
        )}
      </div>
    );
  }
  return (
    <header className="w-full sticky top-0 z-50">
      <div className="w-full" style={{ background: A.nav }}>
        <div className="max-w-7xl mx-auto px-3 h-14 flex items-center gap-3">
          <div className="hidden md:flex flex-col text-white text-xs leading-tight pr-3">
            <span className="opacity-80">Deliver to</span>
            <span className="font-bold">Kolkata 700001</span>
          </div>
          <div className="flex-1 flex">
            <input value={searchQuery} onChange={(e) => onSearch(e.target.value)} placeholder={`Search ${storeName}`} className="flex-1 h-10 px-3 text-sm outline-none" style={{ borderTop: `1px solid ${A.border}`, borderBottom: `1px solid ${A.border}` }} />
            <button className="h-10 px-4 rounded-r-md" style={{ background: "#FEBD69", border: "1px solid #FEBD69" }}>🔍</button>
          </div>
          <div className="hidden md:flex items-center gap-5 text-white text-xs pl-3">
            {isOwner ? (
              <a href="/self?tab=earn" className="leading-tight text-white text-xs hover:opacity-80">
                <div className="opacity-80">Manage</div>
                <div className="font-bold">Your Stores ▾</div>
              </a>
            ) : (
              <a href="/store/account" style={{ textDecoration: "none" }}
                className="leading-tight text-white text-xs hover:opacity-80">
                <div className="opacity-80">
                  {userName ? `Hello, ${userName.split(" ")[0]}` : "Hello, Sign in"}
                </div>
                <div className="font-bold">My Account ▾</div>
              </a>
            )}
            <a href="/store/account?tab=orders" style={{ textDecoration: "none" }}
              className="leading-tight text-white text-xs hover:opacity-80">
              <div className="opacity-80">Returns &amp;</div>
              <div className="font-bold">Orders</div>
            </a>
            <button onClick={onCartOpen} className="flex items-center gap-1 relative">
              <span className="text-lg">🛒</span>
              <span className="font-bold">Cart</span>
              {(cartCount ?? 0) > 0 && (
                <span style={{ position: "absolute", top: -6, right: -8, background: "#6366f1", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {cartCount}
                </span>
              )}
            </button>
            {isOwner && (
              <button
                onClick={onToggleEdit}
                className="text-xs font-semibold px-3 py-1.5 rounded-md"
                style={editMode
                  ? { background: A.accent, color: "#fff", border: `1px solid ${A.accentHover}` }
                  : { background: "transparent", color: "#fff", border: "1px solid #848688" }}
              >
                {editMode ? "Done" : "Edit Section"}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex md:hidden w-full px-3 py-2 gap-2 items-center" style={{ background: "#232F3E" }}>
        <div className="flex flex-1">
          <input placeholder="Search Store" value={searchQuery} onChange={(e) => onSearch(e.target.value)} className="flex-1 h-9 px-3 text-sm outline-none rounded-l-md" style={{ borderTop: `1px solid ${A.border}`, borderBottom: `1px solid ${A.border}`, borderLeft: `1px solid ${A.border}` }} />
          <button className="h-9 px-3 rounded-r-md" style={{ background: "#FEBD69", border: "1px solid #FEBD69" }}>🔍</button>
        </div>
        <button onClick={onCartOpen} className="flex items-center gap-1 relative text-white" style={{ flexShrink: 0 }}><span className="text-lg">🛒</span>{cartCount > 0 && (<span style={{ position: "absolute", top: -4, right: -6, background: "#6366f1", color: "#fff", borderRadius: "50%", width: 14, height: 14, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>{cartCount}</span>)}</button>
        <MobileMenu isOwner={isOwner} editMode={editMode} onToggleEdit={onToggleEdit} userName={userName} storeId={storeId} onAddressClick={onAddressClick} deliveryLabel={deliveryLabel} />
      </div>
    </header>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function QtyStepperInline({ qty, onChange }: { qty: number; onChange: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  function clamp(n: number) { return Math.min(99, Math.max(1, n)); }

  function startEdit() { setRaw(String(qty)); setEditing(true); }

  function commitEdit() {
    const n = parseInt(raw, 10);
    onChange(isNaN(n) ? qty : clamp(n));
    setEditing(false);
  }

  const btn: React.CSSProperties = {
    width: 18, height: 18, borderRadius: 4, border: `1px solid ${A.border}`,
    background: "#f9fafb", color: A.text, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 700, lineHeight: 1, flexShrink: 0, padding: 0,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
      <button type="button" style={btn}
        onClick={(e) => { e.stopPropagation(); onChange(clamp(qty - 1)); }}>−</button>
      {editing ? (
        <input
          autoFocus
          value={raw}
          onChange={(e) => setRaw(e.target.value.replace(/\D/g, ""))}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false); }}
          style={{ width: 26, height: 18, textAlign: "center", fontSize: 11, border: `1px solid ${A.accent}`, borderRadius: 3, outline: "none", color: A.text, background: "#fff", padding: 0 }}
        />
      ) : (
        <span
          onClick={(e) => { e.stopPropagation(); startEdit(); }}
          style={{ width: 26, textAlign: "center", fontSize: 11, fontWeight: 600, color: A.text, cursor: "text", userSelect: "none" }}
        >{qty}</span>
      )}
      <button type="button" style={btn}
        onClick={(e) => { e.stopPropagation(); onChange(clamp(qty + 1)); }}>+</button>
    </div>
  );
}

// ─── StarRating ───────────────────────────────────────────────────────────────

function StarRating({ productId, ratingData, isOwner, isLoggedIn, onRate }: {
  productId: string;
  ratingData: RatingData | undefined;
  isOwner: boolean;
  isLoggedIn: boolean;
  onRate: (productId: string, rating: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  const isInteractive = isLoggedIn && !isOwner;
  const avg = ratingData?.average ?? 0;
  const count = ratingData?.count ?? 0;
  const userRating = ratingData?.userRating ?? 0;

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2000);
  }

  function handleClick(i: number) {
    if (isOwner) { showFlash("You can't rate your own product."); return; }
    if (!isLoggedIn) { showFlash("Log in to rate."); return; }
    onRate(productId, i);
    setThanks(true);
    setTimeout(() => setThanks(false), 2000);
  }

  if (flash) return (
    <p className="text-xs mt-1" style={{ color: A.textMuted, minHeight: 18 }}>{flash}</p>
  );
  if (thanks) return (
    <p className="text-xs mt-1 font-medium" style={{ color: "#10B981", minHeight: 18 }}>Thanks for rating!</p>
  );

  // Skeleton while data loading
  if (ratingData === undefined) return (
    <div className="flex items-center gap-0.5 mt-1" style={{ minHeight: 18 }}>
      {[1,2,3,4,5].map((i) => (
        <span key={i} style={{ color: "#E5E7EB", fontSize: 13, lineHeight: 1 }}>☆</span>
      ))}
    </div>
  );

  const filledUpTo = hovered || userRating || Math.round(avg);

  const starRow = (
    <span
      className="flex items-center"
      style={{ gap: 1 }}
      onMouseLeave={() => isInteractive && setHovered(0)}
    >
      {[1,2,3,4,5].map((i) => (
        <span
          key={i}
          onMouseEnter={() => isInteractive && setHovered(i)}
          onClick={() => handleClick(i)}
          style={{
            color: i <= filledUpTo ? "#F59E0B" : "#D1D5DB",
            fontSize: 13,
            lineHeight: 1,
            cursor: isInteractive ? "pointer" : "default",
            userSelect: "none" as const,
          }}
        >
          {i <= filledUpTo ? "★" : "☆"}
        </span>
      ))}
    </span>
  );

  if (count === 0) {
    return (
      <div className="flex items-center gap-1 mt-1" style={{ minHeight: 18 }}>
        {isInteractive ? (
          <>
            {starRow}
            <span style={{ fontSize: 10, color: A.textMuted }}>Be first</span>
          </>
        ) : (
          <span style={{ fontSize: 10, color: A.textMuted }}>No ratings yet</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1" style={{ minHeight: 18 }}>
      {starRow}
      <span style={{ fontSize: 10, color: A.textMuted }}>({count})</span>
    </div>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({ block, editMode, onRemove, onAddToCart, onBuyNow, onWishlist, isWishlisted, ratingData, isOwner, isLoggedIn, onRate }: {
  block: Block; editMode: boolean; onRemove?: () => void;
  onAddToCart?: (qty: number) => void; onBuyNow?: (qty: number) => void; onWishlist?: () => void; isWishlisted?: boolean;
  ratingData?: RatingData; isOwner?: boolean; isLoggedIn?: boolean;
  onRate?: (productId: string, rating: number) => void;
}) {
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);

  function handleAddToCart() {
    if (!onAddToCart) return;
    onAddToCart(qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="rounded-md bg-white hover:shadow-md transition-shadow relative" style={{ border: `1px solid ${A.border}` }}>
      {!editMode && (
        <button onClick={onWishlist}
          style={{ position: "absolute", top: 6, right: 6, zIndex: 2, width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
          {isWishlisted ? <span style={{ color: "#EF4444" }}>♥</span> : <span style={{ color: "#9CA3AF" }}>♡</span>}
        </button>
      )}
      {editMode && onRemove && (
        <button onClick={onRemove} className="absolute top-1 right-1 z-10 text-xs px-2 py-0.5 rounded"
          style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}>
          Remove
        </button>
      )}
      <div className="overflow-hidden bg-white aspect-[4/3]">
        {block.mediaUrl
          ? <img src={block.mediaUrl} alt={block.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: A.textMuted, background: "#f5f5f5" }}>No media</div>
        }
      </div>
      <div className="px-3 pb-4 pt-2">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm leading-snug line-clamp-2 flex-1" style={{ color: A.text }}>{block.title || "Untitled"}</p>
          {!editMode && <QtyStepperInline qty={qty} onChange={setQty} />}
        </div>
        {block.description && (
          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: A.textMuted }}>{block.description}</p>
        )}
        {!editMode && (
          <StarRating
            productId={block.id}
            ratingData={ratingData}
            isOwner={isOwner ?? false}
            isLoggedIn={isLoggedIn ?? false}
            onRate={onRate ?? (() => {})}
          />
        )}
        {block.price != null && (
          <div className="mt-1">
            <span className="text-sm font-medium" style={{ color: A.text }}>₹{block.price.toLocaleString("en-IN")}</span>
          </div>
        )}
        {!editMode && (
          <div className="mt-3 flex gap-2">
            <button onClick={handleAddToCart}
              className="text-xs font-medium px-3 py-2 rounded-md flex-1 transition-all"
              style={added
                ? { background: "#10B981", color: "#fff", border: "1px solid #059669" }
                : { background: A.accent, color: "#fff", border: `1px solid ${A.accentHover}` }}>
              {added ? "✓ Added" : "Add to Cart"}
            </button>
            <button onClick={() => onBuyNow?.(qty)} className="text-xs font-medium px-3 py-2 rounded-md"
              style={{ background: "#FFA41C", border: "1px solid #FF8F00", color: "#111" }}>
              Buy Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SectionPage() {
  const { id, sectionId } = useParams<{ id: string; sectionId: string }>();
  const router = useRouter();

  const [storeName, setStoreName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<{ name: string | null; email: string | null } | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [quickOrderItem, setQuickOrderItem] = useState<{ blockId: string; title: string; price: number; quantity: number; imageUrl?: string | null } | null>(null);
  const [ratings, setRatings] = useState<Record<string, RatingData>>({});

  useEffect(() => {
    fetch(`/api/store/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        // Canonical redirect: cuid URL → slug URL
        if (data.slug && id !== data.slug) {
          router.replace(`/store/${data.slug}/section/${sectionId}`);
          return;
        }
        setStoreName(data.name ?? "Store");
        setStoreId(data.id ?? id);
        setStoreSlug(data.slug ?? null);
        setIsOwner(!!data.isOwner);
        const found = (data.sections ?? []).find((s: any) => s.id === sectionId);
        if (found) {
          setSectionTitle(found.title);
          const foundBlocks: Block[] = found.blocks ?? [];
          setBlocks(foundBlocks);
          if (foundBlocks.length > 0) {
            const ids = foundBlocks.map((b) => b.id).join(",");
            fetch(`/api/store/products/ratings?ids=${ids}`, { credentials: "include" })
              .then((r) => r.ok ? r.json() : {})
              .then(setRatings)
              .catch(() => {});
          }
        }
        fetch(`/api/store/cart/${data.id}`, { credentials: "include" })
          .then((r) => r.ok ? r.json() : []).then(setCartItems).catch(() => {});
        fetch("/api/store/wishlist", { credentials: "include" })
          .then((r) => r.ok ? r.json() : [])
          .then((items: any[]) => setWishlist(new Set(items.map((i) => i.blockId)))).catch(() => {});
        fetch("/api/store/address", { credentials: "include" })
          .then((r) => r.ok ? r.json() : [])
          .then((addresses: Address[]) => { const d = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null; setDefaultAddress(d); }).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, sectionId]);

  useEffect(() => {
    fetch("/api/user/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : { user: null })
      .then(d => setCurrentUser(d.user))
      .catch(() => {});
  }, []);

  async function removeBlock(blockId: string) {
    const res = await fetch("/api/block", { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ blockId }) });
    if (res.ok) setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  }

  async function handleRate(productId: string, rating: number) {
    try {
      const res = await fetch(`/api/store/products/${productId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating }),
      });
      if (res.ok) {
        const data = await res.json();
        setRatings((prev) => ({
          ...prev,
          [productId]: { average: data.average, count: data.count, userRating: rating },
        }));
      }
    } catch {}
  }

  function handleBuyNow(block: Block, qty: number) {
    setQuickOrderItem({ blockId: block.id, title: block.title, price: block.price ?? 0, quantity: qty, imageUrl: block.mediaUrl ?? null });
  }

  async function handleAddToCart(block: Block, qty: number) {
    const res = await fetch(`/api/store/cart/${storeId}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ blockId: block.id, quantity: qty }) });
    if (res.ok) {
      const item = await res.json();
      setCartItems((prev) => {
        const existing = prev.find((i) => i.blockId === block.id);
        if (existing) return prev.map((i) => i.blockId === block.id ? { ...i, quantity: i.quantity + qty } : i);
        return [...prev, item];
      });
    }
  }

  async function handleWishlist(blockId: string) {
    const res = await fetch("/api/store/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ blockId, storeId: storeId || id }),
    });
    if (res.ok) {
      const data = await res.json();
      setWishlist((prev) => {
        const next = new Set(prev);
        if (data.wishlisted) next.add(blockId); else next.delete(blockId);
        return next;
      });
    }
  }

  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((s, i) => s + (i.block.price ?? 0) * i.quantity, 0);

  // Sync to shared layout shell — must be before any early return
  const shell = useStoreShell();
  useEffect(() => { shell.setStoreName(storeName); }, [storeName]);
  useEffect(() => { shell.setIsOwner(isOwner); }, [isOwner]);
  useEffect(() => { shell.setCartCount(cartCount); }, [cartCount]);
  useEffect(() => {
    shell.setDeliveryLabel(defaultAddress ? `${defaultAddress.city} ${defaultAddress.pincode}` : "Set address");
  }, [defaultAddress]);
  useEffect(() => {
    shell.registerOpenCart(() => setCartOpen(true));
    shell.registerOpenAddress(() => setAddressModalOpen(true));
    shell.setShowNav(true);
  }, []);

  const visibleBlocks = blocks.filter((b) =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.description ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    searchQuery === ""
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
        <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  async function handleRemoveFromCart(blockId: string) {
    await fetch(`/api/store/cart/${storeId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ blockId }) });
    setCartItems((prev) => prev.filter((i) => i.blockId !== blockId));
  }

  return (
    <div className="min-h-screen" style={{ background: A.bg }}>

      <main className="max-w-7xl mx-auto px-3 py-6">
        <a href={`/store/${storeSlug ?? (storeId || id)}`} className="text-sm hover:underline mb-4 block" style={{ color: "#6366f1" }}>
          ← Back to store
        </a>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold" style={{ color: A.text }}>{sectionTitle}</h1>
          {editMode && isOwner && (
            <button onClick={() => setAddingBlock(true)} className="text-xs font-semibold px-3 py-1.5 rounded-md"
              style={{ background: "#fff", color: A.text, border: `1px solid ${A.border}` }}>
              + Add product
            </button>
          )}
        </div>
        <p className="text-sm mb-4" style={{ color: A.textMuted }}>
          {blocks.length} product{blocks.length !== 1 ? "s" : ""} in this section
        </p>

        {visibleBlocks.length === 0 ? (
          <p className="text-sm" style={{ color: A.textMuted }}>No products yet.{isOwner ? " Click 'Edit Section' to add some." : ""}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {visibleBlocks.map((block) => (
              <ProductCard
                key={block.id}
                block={block}
                editMode={editMode}
                onRemove={() => removeBlock(block.id)}
                onAddToCart={(qty) => handleAddToCart(block, qty)}
                onBuyNow={(qty) => handleBuyNow(block, qty)}
                onWishlist={() => handleWishlist(block.id)}
                isWishlisted={wishlist.has(block.id)}
                ratingData={ratings[block.id]}
                isOwner={isOwner}
                isLoggedIn={currentUser !== null}
                onRate={handleRate}
              />
            ))}
          </div>
        )}
      </main>

      {addingBlock && (
        <AddBlockModal sectionId={sectionId} storeId={storeId || id} onClose={() => setAddingBlock(false)}
          onCreated={(block) => { setBlocks((prev) => [...prev, block]); setAddingBlock(false); }} />
      )}

      <CartDrawer
        open={cartOpen} onClose={() => setCartOpen(false)}
        items={cartItems} onRemove={handleRemoveFromCart}
        storeName={storeName} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
      />

      <CheckoutModal
        open={checkoutOpen} onClose={() => setCheckoutOpen(false)}
        items={cartItems} total={cartTotal} storeId={storeId}
        onOrderPlaced={() => { setCartItems([]); setCartOpen(false); setCheckoutOpen(false); }}
      />

      <AddressModal
        open={addressModalOpen} onClose={() => setAddressModalOpen(false)}
        onSelected={(addr) => setDefaultAddress(addr)}
      />

      {/* Floating edit button for section owners */}
      {isOwner && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 50 }}>
          <button
            onClick={() => setEditMode((v) => !v)}
            style={{ padding: "10px 20px", borderRadius: 24, background: editMode ? "#6366f1" : "#fff", color: editMode ? "#fff" : "#0F1111", border: "1px solid #DDDDDD", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {editMode ? "✓ Done" : "✏️ Edit Section"}
          </button>
        </div>
      )}

      {quickOrderItem && (
        <QuickOrderModal
          open={!!quickOrderItem}
          onClose={() => setQuickOrderItem(null)}
          storeId={storeId}
          storeName={storeName}
          initialItem={quickOrderItem}
        />
      )}
    </div>
  );
}
