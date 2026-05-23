"use client";

import { useEffect, useState } from "react";
import AddressForm, { type AddressFormData } from "@/components/shared/AddressForm";

const A = {
  bg: "#E3E6E6",
  surface: "#FFFFFF",
  border: "#DDDDDD",
  text: "#0F1111",
  textMuted: "#565959",
  accent: "#6366f1",
  accentHover: "#4f46e5",
  link: "#007185",
  gold: "#FFA41C",
};

const iCls = "w-full text-sm px-3 py-2 rounded-md outline-none placeholder:text-zinc-400";
const iStyle = { background: A.surface, color: A.text, border: `1px solid ${A.border}` };

const PERSONAL_ID = "personal";
const SKIP_ID = "none";

type QuickItem = {
  blockId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
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

type BillingProfile = {
  id: string;
  legalName: string;
  companyName: string | null;
  gstNumber: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  linkedStore: { id: string; name: string } | null;
};

type Step = 1 | 2 | 3 | 4;

interface QuickOrderModalProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  initialItem: QuickItem;
  deliveryFee?: number | null;
  freeDeliveryAbove?: number | null;
}

function Spinner() {
  return <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />;
}

export default function QuickOrderModal({ open, onClose, storeId, storeName, initialItem, deliveryFee, freeDeliveryAbove }: QuickOrderModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [items, setItems] = useState<QuickItem[]>([]);

  // Address
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState("");
  const [addingAddr, setAddingAddr] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrFormError, setAddrFormError] = useState<string | null>(null);

  // Invoice
  const [billingProfiles, setBillingProfiles] = useState<BillingProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(PERSONAL_ID);
  const [userName, setUserName] = useState<string | null>(null);

  // Order
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setItems([{ ...initialItem }]);
    setSelectedAddrId("");
    setAddingAddr(false);
    setSelectedProfileId(PERSONAL_ID);
    setPlacing(false);
    setOrderId(null);
    setError("");
  }, [open, initialItem.blockId]);

  // Fetch addresses on address step
  useEffect(() => {
    if (!open || step !== 2) return;
    fetch("/api/store/address", { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((addrs: Address[]) => {
        setAddresses(addrs);
        const def = addrs.find((a) => a.isDefault) ?? addrs[0];
        if (def) setSelectedAddrId(def.id);
      })
      .catch(() => {});
  }, [open, step]);

  // Fetch billing profiles + user name on invoice step
  useEffect(() => {
    if (!open || step !== 3) return;
    Promise.all([
      fetch("/api/store/billing-profiles", { credentials: "include" }).then((r) => r.ok ? r.json() : []),
      fetch("/api/user/me", { credentials: "include" }).then((r) => r.ok ? r.json() : { user: null }),
    ]).then(([profiles, meData]) => {
      setBillingProfiles(Array.isArray(profiles) ? profiles : []);
      setUserName(meData?.user?.name ?? null);
    }).catch(() => {});
  }, [open, step]);

  const itemsTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const appliedDeliveryFee = deliveryFee != null && (freeDeliveryAbove == null || itemsTotal < freeDeliveryAbove) ? deliveryFee : 0;
  const total = itemsTotal + appliedDeliveryFee;
  const selectedAddr = addresses.find((a) => a.id === selectedAddrId);

  function updateQty(blockId: string, delta: number) {
    setItems((prev) =>
      prev.map((i) => i.blockId === blockId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)
    );
  }

  function removeItem(blockId: string) {
    setItems((prev) => prev.filter((i) => i.blockId !== blockId));
  }

  async function saveNewAddress(data: AddressFormData) {
    setSavingAddr(true);
    try {
      const r = await fetch("/api/store/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          line1: data.line1,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          isDefault: false,
          lat: data.lat,
          lng: data.lng,
        }),
      });
      if (r.ok) {
        const a = await r.json();
        setAddresses((prev) => [...prev, a]);
        setSelectedAddrId(a.id);
        setAddingAddr(false);
      }
    } finally { setSavingAddr(false); }
  }

  async function placeOrder() {
    setPlacing(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        storeId,
        addressId: selectedAddrId,
        items: items.map((i) => ({ blockId: i.blockId, title: i.title, price: i.price, quantity: i.quantity, imageUrl: i.imageUrl })),
      };

      if (selectedProfileId === PERSONAL_ID) {
        // Inline personal invoice — no GST, use delivery address details
        body.invoiceData = {
          legalName: userName ?? selectedAddr?.name ?? "Customer",
          addressLine: selectedAddr?.line1 ?? "",
          city: selectedAddr?.city ?? "",
          state: selectedAddr?.state ?? "",
          pinCode: selectedAddr?.pincode ?? "",
        };
      } else if (selectedProfileId !== SKIP_ID) {
        body.billingProfileId = selectedProfileId;
      }

      const r = await fetch("/api/store/orders/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const order = await r.json();
        setOrderId(order.id);
        setStep(4);
      } else {
        const d = await r.json();
        setError(d.error ?? "Failed to place order");
      }
    } finally { setPlacing(false); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pb-16 sm:pb-0"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: A.surface, maxHeight: "92vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: A.border }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: A.text }}>Quick Order</h2>
            <p className="text-xs" style={{ color: A.textMuted }}>{storeName}</p>
          </div>
          <div className="flex items-center gap-3">
            {step < 4 && (
              <div className="flex items-center gap-1">
                {([1, 2, 3] as const).map((s) => (
                  <div key={s} className="w-2 h-2 rounded-full transition-colors"
                    style={{ background: step >= s ? A.accent : A.border }} />
                ))}
              </div>
            )}
            <button onClick={onClose} className="text-lg leading-none" style={{ color: A.textMuted }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── Step 1: Items ─────────────────────────────── */}
          {step === 1 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: A.textMuted }}>Your order</p>
              {items.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: A.textMuted }}>No items. Add something to order.</p>
              ) : items.map((item) => (
                <div key={item.blockId} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: "#f0f0f0" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", background: "#f3f4f6", flexShrink: 0 }}>
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-lg">📦</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: A.text }}>{item.title}</div>
                    <div className="text-xs" style={{ color: A.textMuted }}>₹{item.price.toLocaleString("en-IN")}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateQty(item.blockId, -1)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ border: `1px solid ${A.border}`, color: A.text, background: "#f9fafb" }}>−</button>
                    <span className="text-sm font-semibold w-5 text-center" style={{ color: A.text }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.blockId, 1)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ border: `1px solid ${A.border}`, color: A.text, background: "#f9fafb" }}>+</button>
                    <button onClick={() => removeItem(item.blockId)} className="text-xs ml-1" style={{ color: "#EF4444" }}>✕</button>
                  </div>
                </div>
              ))}
              {appliedDeliveryFee > 0 && (
                <div className="flex justify-between text-xs pt-1" style={{ color: A.textMuted }}>
                  <span>Delivery fee</span>
                  <span>₹{appliedDeliveryFee.toLocaleString("en-IN")}</span>
                </div>
              )}
              {appliedDeliveryFee === 0 && deliveryFee != null && freeDeliveryAbove != null && (
                <div className="text-xs pt-1" style={{ color: "#15803D" }}>
                  🚚 Free delivery applied (order above ₹{freeDeliveryAbove.toLocaleString("en-IN")})
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold pt-1" style={{ color: A.text }}>
                <span>Total</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
            </>
          )}

          {/* ── Step 2: Delivery address ─────────────────── */}
          {step === 2 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: A.textMuted }}>Delivery address</p>
              <div className="space-y-2">
                {addresses.map((a) => (
                  <button key={a.id} onClick={() => setSelectedAddrId(a.id)}
                    className="w-full text-left p-3 rounded-lg"
                    style={{ border: `1px solid ${selectedAddrId === a.id ? A.accent : A.border}`, background: selectedAddrId === a.id ? "#EEF2FF" : A.surface }}>
                    <div className="text-xs font-semibold" style={{ color: A.text }}>{a.name} · {a.phone}</div>
                    <div className="text-xs mt-0.5" style={{ color: A.textMuted }}>{a.line1}, {a.city}, {a.state} {a.pincode}</div>
                  </button>
                ))}
              </div>
              <button className="text-xs" style={{ color: A.link }} onClick={() => { setAddingAddr((v) => !v); setAddrFormError(""); }}>
                {addingAddr ? "Cancel new address" : "+ Add new address"}
              </button>
              {addingAddr && (
                <div className="p-3 rounded-lg" style={{ border: `1px solid ${A.border}` }}>
                  <AddressForm
                    onSave={saveNewAddress}
                    onCancel={() => setAddingAddr(false)}
                    saving={savingAddr}
                  />
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Invoice ───────────────────────────── */}
          {step === 3 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: A.textMuted }}>Invoice details</p>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: A.textMuted }}>Invoice type</label>
                <select value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className={iCls} style={iStyle}>
                  <option value={PERSONAL_ID}>Personal (no GST)</option>
                  {billingProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.legalName}{p.gstNumber ? ` — GST: ${p.gstNumber}` : ""}{p.linkedStore ? ` (${p.linkedStore.name})` : ""}
                    </option>
                  ))}
                  <option value={SKIP_ID}>Don't need invoice</option>
                </select>
              </div>

              {selectedProfileId === PERSONAL_ID && (
                <div className="rounded-lg p-3 space-y-1" style={{ background: "#F9FAFB", border: `1px solid ${A.border}` }}>
                  <p className="text-xs font-medium" style={{ color: A.textMuted }}>Invoice will be issued to</p>
                  <p className="text-sm font-semibold" style={{ color: A.text }}>
                    {userName ?? selectedAddr?.name ?? "Personal"}
                  </p>
                  {selectedAddr && (
                    <p className="text-xs" style={{ color: A.textMuted }}>
                      {selectedAddr.line1}, {selectedAddr.city}, {selectedAddr.state} {selectedAddr.pincode}
                    </p>
                  )}
                  <p className="text-xs mt-1" style={{ color: A.textMuted }}>
                    To add GST details,{" "}
                    <a href="/store/account?tab=invoice" target="_blank" rel="noreferrer"
                      style={{ color: A.accent, textDecoration: "underline" }}>
                      save a billing profile
                    </a>
                    {" "}first.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Step 4: Confirmation ──────────────────────── */}
          {step === 4 && (
            <div className="text-center py-6 space-y-3">
              <div className="text-4xl">✅</div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#16A34A" }}>Order placed!</p>
                <p className="text-xs mt-1" style={{ color: A.textMuted }}>
                  Order <span className="font-mono font-bold">#{orderId?.slice(-8).toUpperCase()}</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: A.textMuted }}>The store owner will contact you shortly.</p>
              </div>
              <a href="/app/orders"
                className="inline-block text-xs font-semibold px-4 py-2 rounded-md"
                style={{ background: A.accent, color: "#fff", textDecoration: "none" }}>
                View my orders →
              </a>
            </div>
          )}

          {error && <p className="text-xs" style={{ color: "#EF4444" }}>{error}</p>}
        </div>

        {/* Footer */}
        {step < 4 && (
          <div className="shrink-0 px-5 py-4 border-t" style={{ borderColor: A.border }}>
            {step === 1 && (
              <button
                disabled={items.length === 0}
                onClick={() => setStep(2)}
                className="w-full py-3 rounded-xl text-sm font-bold"
                style={{ background: items.length ? A.gold : "#f3f4f6", color: items.length ? "#111" : A.textMuted, border: `1px solid ${items.length ? "#FF8F00" : A.border}` }}>
                Proceed to Delivery →
              </button>
            )}
            {step === 2 && (
              <div className="flex gap-2">
                <button onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ border: `1px solid ${A.border}`, color: A.textMuted, background: A.surface }}>
                  ← Back
                </button>
                <button
                  disabled={!selectedAddrId}
                  onClick={() => setStep(3)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: selectedAddrId ? A.accent : "#f3f4f6", color: selectedAddrId ? "#fff" : A.textMuted }}>
                  Continue →
                </button>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-2">
                {appliedDeliveryFee > 0 && (
                  <div className="flex justify-between text-xs" style={{ color: A.textMuted }}>
                    <span>Items</span>
                    <span>₹{itemsTotal.toLocaleString("en-IN")}</span>
                  </div>
                )}
                {appliedDeliveryFee > 0 && (
                  <div className="flex justify-between text-xs" style={{ color: A.textMuted }}>
                    <span>Delivery</span>
                    <span>₹{appliedDeliveryFee.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs mb-2" style={{ color: A.textMuted }}>
                  <span>Total</span>
                  <span className="font-bold" style={{ color: A.text }}>₹{total.toLocaleString("en-IN")}</span>
                </div>
                <div className="text-xs px-3 py-2 rounded-lg text-center" style={{ background: "#F0FDF4", color: "#16A34A" }}>
                  💵 Cash on Delivery
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{ border: `1px solid ${A.border}`, color: A.textMuted, background: A.surface }}>
                    ← Back
                  </button>
                  <button onClick={placeOrder} disabled={placing}
                    className="flex-1 py-2 rounded-lg text-sm font-bold"
                    style={{ background: A.accent, color: "#fff", opacity: placing ? 0.7 : 1 }}>
                    {placing ? "Placing…" : "Place Order"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
