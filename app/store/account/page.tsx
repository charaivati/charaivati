"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AddressForm, { type AddressFormData } from "@/components/shared/AddressForm";

const A = {
  bg: "#E3E6E6",
  nav: "#131921",
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

// ─── Types ────────────────────────────────────────────────────────
type User = { id: string; name: string | null; email: string; avatarUrl?: string | null };
type Address = {
  id: string; name: string; phone: string; line1: string;
  city: string; state: string; pincode: string; isDefault: boolean;
};
// Items are stored as a JSON snapshot on the Order row: [{ blockId, title, price, quantity }]
type OrderItem = { blockId: string; title: string; price: number; quantity: number; imageUrl?: string | null };
type Order = {
  id: string; status: string; createdAt: string; total: number;
  storeId?: string;
  invoiceUrl?: string | null;
  invoiceSignedUrl?: string | null;
  store?: { id: string; slug?: string | null; name: string };
  user?: { name: string | null; email: string | null };
  items: OrderItem[];
};
type MyStore = { id: string; slug?: string | null; name: string };
type BillingProfile = {
  id: string;
  legalName: string;
  companyName: string | null;
  gstRegistered: boolean;
  gstin: string | null;
  gstState: string | null;
  annualTurnover: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  linkedStoreId: string | null;
  linkedStore: { id: string; name: string } | null;
};
const GSTIN_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Daman & Diu / Dadra & Nagar Haveli", "27": "Maharashtra",
  "29": "Karnataka", "30": "Goa", "32": "Kerala", "33": "Tamil Nadu",
  "34": "Puducherry", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

const TURNOVER_OPTIONS = [
  { value: "below_20L", label: "Below ₹20 Lakh" },
  { value: "20L_to_40L", label: "₹20L – ₹40L" },
  { value: "40L_to_5Cr", label: "₹40L – ₹5 Crore" },
  { value: "above_5Cr", label: "Above ₹5 Crore (E-Invoice required)" },
];

const BP_EMPTY: Omit<BillingProfile, "id" | "linkedStore"> = {
  legalName: "", companyName: "",
  gstRegistered: false, gstin: "", gstState: "", annualTurnover: "",
  addressLine: "", city: "", state: "", pinCode: "", linkedStoreId: "",
};

// ─── Constants ────────────────────────────────────────────────────
const iCls = "w-full text-sm px-3 py-2 rounded-md outline-none";
const iStyle = { background: A.surface, color: A.text, border: `1px solid ${A.border}` };
const ADDR_EMPTY = { name: "", phone: "", line1: "", city: "", state: "", pincode: "" };

// ─── Helpers ──────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

async function lookupPinCode(pin: string): Promise<{ city: string; state: string } | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();
    if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      return { city: po.District ?? "", state: po.State ?? "" };
    }
  } catch {}
  return null;
}

// ─── Small components ─────────────────────────────────────────────
function Spinner({ size = 6 }: { size?: number }) {
  return (
    <div
      style={{ width: size * 4, height: size * 4 }}
      className="rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"
    />
  );
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

function AddressCard({
  addr, onSetDefault, onDelete,
}: { addr: Address; onSetDefault: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-xl p-4"
      style={{ background: A.surface, border: `1px solid ${addr.isDefault ? A.accent : A.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: A.text }}>{addr.name}</span>
            {addr.isDefault && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "#DCFCE7", color: "#16A34A" }}>Default</span>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: A.textMuted }}>{addr.phone}</div>
          <div className="text-xs mt-1" style={{ color: A.textMuted }}>
            {addr.line1}, {addr.city}, {addr.state} – {addr.pincode}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {!addr.isDefault && (
            <button onClick={onSetDefault} className="text-xs px-2 py-1 rounded"
              style={{ border: `1px solid ${A.accent}`, color: A.accent, background: A.surface, cursor: "pointer" }}>
              Set default
            </button>
          )}
          <button onClick={onDelete} className="text-xs px-2 py-1 rounded"
            style={{ border: "1px solid #FCA5A5", color: "#EF4444", background: A.surface, cursor: "pointer" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function PurchaseOrderCard({ order }: { order: Order }) {
  const storeHandle = order.store?.slug ?? order.store?.id ?? order.storeId;
  const storeId = order.store?.id ?? order.storeId;
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

// ─── Main content ─────────────────────────────────────────────────
function AccountPageContent() {
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const initialTab =
    rawTab === "stores" ? "stores" : rawTab === "invoice" ? "invoice" : "purchases";
  const [activeTab, setActiveTab] = useState<"purchases" | "stores" | "invoice">(
    initialTab as "purchases" | "stores" | "invoice"
  );

  // User
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Purchases tab
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Address form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(ADDR_EMPTY);
  const [addFormError, setAddFormError] = useState("");
  const [addrPinLoading, setAddrPinLoading] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);

  // My Stores tab
  const [myStores, setMyStores] = useState<MyStore[]>([]);

  // Invoice / Billing profiles tab
  const [billingProfiles, setBillingProfiles] = useState<BillingProfile[]>([]);
  const [showBpForm, setShowBpForm] = useState(false);
  const [editingBpId, setEditingBpId] = useState<string | null>(null);
  const [bpForm, setBpForm] = useState<Omit<BillingProfile, "id" | "linkedStore">>(BP_EMPTY);
  const [billingPinLoading, setBillingPinLoading] = useState(false);
  const [savingBp, setSavingBp] = useState(false);
  const [bpSaved, setBpSaved] = useState(false);
  const [bpGstinError, setBpGstinError] = useState("");

  // Load user
  useEffect(() => {
    fetch("/api/user/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user ?? null))
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  // Load all data in parallel once user is known
  useEffect(() => {
    if (!user) return;
    setLoadingData(true);
    Promise.all([
      fetch("/api/store/address", { credentials: "include" }).then((r) => r.ok ? r.json() : []),
      fetch("/api/store/orders", { credentials: "include" }).then((r) => r.ok ? r.json() : []),
      fetch("/api/store/my-stores", { credentials: "include" }).then((r) => r.ok ? r.json() : { stores: [] }),
      fetch("/api/store/billing-profiles", { credentials: "include" }).then((r) => r.ok ? r.json() : []),
    ]).then(([addrs, ordersData, storesData, bpData]) => {
      setAddresses(Array.isArray(addrs) ? addrs : []);
      setOrders(Array.isArray(ordersData) ? ordersData : ordersData.orders ?? []);
      setMyStores(storesData.stores ?? []);
      setBillingProfiles(Array.isArray(bpData) ? bpData : []);
    }).catch(() => {})
      .finally(() => setLoadingData(false));
  }, [user]);

  // Address handlers
  function setAddrField(k: string, v: string) {
    setAddForm((f) => ({ ...f, [k]: v }));
    setAddFormError("");
  }

  async function handleAddrPinLookup(pin: string) {
    setAddrPinLoading(true);
    const result = await lookupPinCode(pin);
    if (result) setAddForm((f) => ({ ...f, city: result.city, state: result.state }));
    setAddrPinLoading(false);
  }

  async function handleSetDefault(id: string) {
    await fetch(`/api/store/address/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ isDefault: true }),
    });
    setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
  }

  async function handleDeleteAddr(id: string) {
    await fetch(`/api/store/address/${id}`, { method: "DELETE", credentials: "include" });
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSaveAddr(data: AddressFormData) {
    setSavingAddr(true);
    try {
      const r = await fetch("/api/store/address", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          ...data,
          isDefault: data.isDefault || addresses.length === 0,
        }),
      });
      if (r.ok) {
        const a = await r.json();
        setAddresses((prev) => [a, ...prev]);
        setShowAddForm(false);
      }
    } finally { setSavingAddr(false); }
  }

  // Billing profile handlers
  function setBpField(k: keyof typeof BP_EMPTY, v: string) {
    setBpForm((f) => ({ ...f, [k]: v }));
  }

  function openNewBpForm() {
    setEditingBpId(null);
    setBpForm(BP_EMPTY);
    setShowBpForm(true);
  }

  function openEditBpForm(profile: BillingProfile) {
    setEditingBpId(profile.id);
    setBpGstinError("");
    setBpForm({
      legalName: profile.legalName,
      companyName: profile.companyName ?? "",
      gstRegistered: profile.gstRegistered ?? false,
      gstin: profile.gstin ?? "",
      gstState: profile.gstState ?? "",
      annualTurnover: profile.annualTurnover ?? "",
      addressLine: profile.addressLine ?? "",
      city: profile.city ?? "",
      state: profile.state ?? "",
      pinCode: profile.pinCode ?? "",
      linkedStoreId: profile.linkedStoreId ?? "",
    });
    setShowBpForm(true);
  }

  async function handleBillingPinLookup(pin: string) {
    setBillingPinLoading(true);
    const result = await lookupPinCode(pin);
    if (result) setBpForm((f) => ({ ...f, city: result.city, state: result.state }));
    setBillingPinLoading(false);
  }

  async function handleSaveBp() {
    if (!bpForm.legalName.trim()) return;
    setSavingBp(true);
    try {
      const body = {
        legalName: bpForm.legalName.trim(),
        companyName: bpForm.companyName?.trim() || null,
        gstRegistered: bpForm.gstRegistered,
        gstin: bpForm.gstRegistered ? bpForm.gstin?.trim().toUpperCase() || null : null,
        gstState: bpForm.gstRegistered ? bpForm.gstState?.trim() || null : null,
        annualTurnover: bpForm.gstRegistered ? bpForm.annualTurnover || null : null,
        addressLine: bpForm.addressLine?.trim() || null,
        city: bpForm.city?.trim() || null,
        state: bpForm.state?.trim() || null,
        pinCode: bpForm.pinCode?.trim() || null,
        linkedStoreId: bpForm.linkedStoreId || null,
      };
      let r: Response;
      if (editingBpId) {
        r = await fetch(`/api/store/billing-profiles/${editingBpId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify(body),
        });
      } else {
        r = await fetch("/api/store/billing-profiles", {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify(body),
        });
      }
      if (r.ok) {
        const saved: BillingProfile = await r.json();
        if (editingBpId) {
          setBillingProfiles((prev) => prev.map((p) => p.id === editingBpId ? saved : p));
        } else {
          setBillingProfiles((prev) => [...prev, saved]);
        }
        setShowBpForm(false);
        setEditingBpId(null);
        setBpForm(BP_EMPTY);
        setBpSaved(true);
        setTimeout(() => setBpSaved(false), 2000);
      }
    } finally { setSavingBp(false); }
  }

  async function handleDeleteBp(id: string) {
    await fetch(`/api/store/billing-profiles/${id}`, { method: "DELETE", credentials: "include" });
    setBillingProfiles((prev) => prev.filter((p) => p.id !== id));
  }


  // Auth states
  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
        <Spinner size={7} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
        <div className="text-center space-y-3">
          <p className="text-sm" style={{ color: A.textMuted }}>Please sign in to view your account</p>
          <a href="/login" className="inline-block text-sm font-semibold px-5 py-2 rounded-md"
            style={{ background: A.accent, color: "#fff", textDecoration: "none" }}>
            Sign in
          </a>
        </div>
      </div>
    );
  }

  const initial = (user.name ?? user.email ?? "?")[0]?.toUpperCase() ?? "?";

  const tabs: { key: "purchases" | "stores" | "invoice"; label: string }[] = [
    { key: "purchases", label: "🛍️ My Purchases" },
    ...(myStores.length > 0 ? [{ key: "stores" as const, label: "🏪 My Stores" }] : []),
    { key: "invoice", label: "🧾 Invoice & Billing" },
  ];

  return (
    <div className="min-h-screen" style={{ background: A.bg }}>
      {/* Header */}
      <header className="w-full sticky top-0 z-50" style={{ background: A.nav }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => window.history.back()}
            className="text-white text-sm hover:opacity-80 flex items-center gap-1 shrink-0">
            ← Back
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div style={{
              width: 34, height: 34, borderRadius: "50%", background: A.accent, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{initial}</span>}
            </div>
            <span className="text-white text-sm font-medium hidden sm:block">{user.name ?? user.email}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-5" style={{ color: A.text }}>My Account</h1>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: A.surface, border: `1px solid ${A.border}` }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className="flex-1 py-2 px-1 rounded-md text-xs sm:text-sm font-medium transition-colors"
              style={activeTab === t.key
                ? { background: A.accent, color: "#fff" }
                : { background: "transparent", color: A.textMuted, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab 1: My Purchases ─────────────────────────────────── */}
        {activeTab === "purchases" && (
          <div className="space-y-6">
            {/* Addresses */}
            <section>
              <h2 className="text-sm font-bold mb-3" style={{ color: A.text }}>Delivery Addresses</h2>
              {loadingData ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : (
                <div className="space-y-3">
                  {addresses.length === 0 && !showAddForm && (
                    <p className="text-sm text-center py-4" style={{ color: A.textMuted }}>No saved addresses yet.</p>
                  )}
                  {addresses.map((addr) => (
                    <AddressCard key={addr.id} addr={addr}
                      onSetDefault={() => handleSetDefault(addr.id)}
                      onDelete={() => handleDeleteAddr(addr.id)} />
                  ))}

                  {showAddForm ? (
                    <div className="rounded-xl p-4" style={{ background: A.surface, border: `1px solid ${A.border}` }}>
                      <h3 className="text-sm font-semibold mb-3" style={{ color: A.text }}>New address</h3>
                      <AddressForm
                        onSave={handleSaveAddr}
                        onCancel={() => setShowAddForm(false)}
                        saving={savingAddr}
                      />
                    </div>
                  ) : (
                    <button onClick={() => setShowAddForm(true)}
                      className="w-full py-3 rounded-xl text-sm font-medium"
                      style={{ border: `2px dashed ${A.border}`, color: A.accent, background: "transparent", cursor: "pointer" }}>
                      + Add new address
                    </button>
                  )}
                </div>
              )}
            </section>

            <hr style={{ borderColor: A.border }} />

            {/* Orders */}
            <section>
              <h2 className="text-sm font-bold mb-3" style={{ color: A.text }}>My Orders</h2>
              {loadingData ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-sm" style={{ color: A.textMuted }}>No purchases yet.</p>
                  <a href="/" className="text-sm font-semibold" style={{ color: A.accent, textDecoration: "none" }}>
                    Browse stores →
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => <PurchaseOrderCard key={order.id} order={order} />)}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── Tab 2: My Stores ────────────────────────────────────── */}
        {activeTab === "stores" && (
          <div className="space-y-3">
            {loadingData ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : myStores.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: A.textMuted }}>
                No stores yet. Create one from your initiatives.
              </p>
            ) : (
              myStores.map((s) => {
                const storeHandle = s.slug ?? s.id;
                const storeTypeLabel = s.slug ? "Store" : "Store";
                return (
                  <div key={s.id} className="rounded-xl p-4 flex items-center justify-between gap-3"
                    style={{ background: A.surface, border: `1px solid ${A.border}` }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: A.text }}>{s.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: "#EEF2FF", color: A.accent }}>
                          {storeTypeLabel}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <a href={`/store/${storeHandle}`}
                        className="text-xs px-3 py-1.5 rounded-md font-medium"
                        style={{ border: `1px solid ${A.border}`, color: A.text, textDecoration: "none", background: A.surface }}>
                        Visit store
                      </a>
                      <a href={`/store/orders/all?storeId=${s.id}`}
                        className="text-xs px-3 py-1.5 rounded-md font-medium"
                        style={{ background: A.accent, color: "#fff", textDecoration: "none" }}>
                        Manage orders
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Tab 3: Invoice & Billing ─────────────────────────────── */}
        {activeTab === "invoice" && (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: A.textMuted }}>
              Save billing profiles for invoices. You can link each profile to a specific store (for GST purposes) or keep it personal.
            </p>

            {/* Existing profiles */}
            {billingProfiles.length > 0 && (
              <div className="space-y-3">
                {billingProfiles.map((profile) => (
                  <div key={profile.id} className="rounded-xl p-4" style={{ background: A.surface, border: `1px solid ${A.border}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: A.text }}>{profile.legalName}</span>
                          {profile.linkedStore && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "#EEF2FF", color: A.accent }}>
                              {profile.linkedStore.name}
                            </span>
                          )}
                        </div>
                        {profile.companyName && (
                          <div className="text-xs mt-0.5" style={{ color: A.textMuted }}>{profile.companyName}</div>
                        )}
                        {profile.gstRegistered && profile.gstin && (
                          <div className="text-xs mt-0.5 font-mono" style={{ color: A.textMuted }}>GSTIN: {profile.gstin}</div>
                        )}
                        {profile.gstRegistered && !profile.gstin && (
                          <div className="text-xs mt-0.5" style={{ color: A.textMuted }}>GST Registered</div>
                        )}
                        {!profile.gstRegistered && (
                          <div className="text-xs mt-0.5" style={{ color: A.textMuted }}>Bill of Supply</div>
                        )}
                        {(profile.addressLine || profile.city) && (
                          <div className="text-xs mt-1" style={{ color: A.textMuted }}>
                            {[profile.addressLine, profile.city, profile.state, profile.pinCode].filter(Boolean).join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button onClick={() => openEditBpForm(profile)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ border: `1px solid ${A.accent}`, color: A.accent, background: A.surface, cursor: "pointer" }}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteBp(profile.id)}
                          className="text-xs px-2 py-1 rounded"
                          style={{ border: "1px solid #FCA5A5", color: "#EF4444", background: A.surface, cursor: "pointer" }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new profile form */}
            {showBpForm ? (
              <div className="rounded-xl p-4 space-y-3" style={{ background: A.surface, border: `1px solid ${A.border}` }}>
                <h3 className="text-sm font-semibold" style={{ color: A.text }}>
                  {editingBpId ? "Edit billing profile" : "New billing profile"}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: A.textMuted }}>
                      Legal Name <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input value={bpForm.legalName}
                      onChange={(e) => setBpField("legalName", e.target.value)}
                      placeholder="Your legal name" className={iCls} style={iStyle} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1" style={{ color: A.textMuted }}>Company Name</label>
                    <input value={bpForm.companyName ?? ""}
                      onChange={(e) => setBpField("companyName", e.target.value)}
                      placeholder="Company (optional)" className={iCls} style={iStyle} />
                  </div>
                </div>

                {/* Link to Store */}
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: A.textMuted }}>Link to Store (optional)</label>
                  <select value={bpForm.linkedStoreId ?? ""}
                    onChange={(e) => setBpField("linkedStoreId", e.target.value)}
                    className={iCls} style={iStyle}>
                    <option value="">Personal / No store</option>
                    {myStores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* GST Registration */}
                <div className="space-y-3 pt-1">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div
                      onClick={() => { setBpForm((f) => ({ ...f, gstRegistered: !f.gstRegistered })); setBpGstinError(""); }}
                      style={{ width: 40, height: 22, borderRadius: 11, background: bpForm.gstRegistered ? A.accent : A.border, transition: "background 0.2s", cursor: "pointer", position: "relative", flexShrink: 0 }}>
                      <div style={{ position: "absolute", top: 3, left: bpForm.gstRegistered ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: A.text }}>
                      {bpForm.gstRegistered ? "GST Registered" : "Not GST Registered"}
                    </span>
                  </label>

                  {bpForm.gstRegistered ? (
                    <div className="rounded-lg p-3 space-y-3" style={{ background: "#F9FAFB", border: `1px solid ${A.border}` }}>
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: A.textMuted }}>
                          GSTIN <span style={{ color: "#EF4444" }}>*</span>
                        </label>
                        <input
                          value={bpForm.gstin ?? ""}
                          maxLength={15}
                          onChange={(e) => {
                            const upper = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
                            const code = upper.slice(0, 2);
                            setBpForm((f) => ({ ...f, gstin: upper, gstState: GSTIN_STATE_CODES[code] ?? f.gstState }));
                            setBpGstinError("");
                          }}
                          onBlur={() => {
                            const v = bpForm.gstin?.trim() ?? "";
                            const RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
                            if (v && !RE.test(v)) setBpGstinError("Invalid GSTIN format");
                            else setBpGstinError("");
                          }}
                          placeholder="e.g. 27AAAAA0000A1Z5"
                          className={iCls} style={bpGstinError ? { ...iStyle, borderColor: "#EF4444" } : iStyle}
                        />
                        {bpForm.gstState && !bpGstinError && (
                          <p className="text-xs mt-1" style={{ color: A.accent }}>📍 {bpForm.gstState}</p>
                        )}
                        {bpGstinError && <p className="text-xs mt-1" style={{ color: "#EF4444" }}>{bpGstinError}</p>}
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1" style={{ color: A.textMuted }}>Annual Turnover</label>
                        <select value={bpForm.annualTurnover ?? ""}
                          onChange={(e) => setBpField("annualTurnover", e.target.value)}
                          className={iCls} style={iStyle}>
                          <option value="">Select turnover range</option>
                          {TURNOVER_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {bpForm.annualTurnover === "above_5Cr" && (
                          <p className="text-xs mt-1" style={{ color: "#F59E0B" }}>
                            E-Invoice via IRP will be required for this store.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs px-1" style={{ color: A.textMuted }}>
                      Your invoices will be issued as Bill of Supply. Buyers cannot claim input tax credit.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: A.textMuted }}>Billing Address</label>
                  <input value={bpForm.addressLine ?? ""}
                    onChange={(e) => setBpField("addressLine", e.target.value)}
                    placeholder="Address line (optional)" className={iCls} style={iStyle} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <input value={bpForm.pinCode ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setBpField("pinCode", v);
                        if (v.length === 6) handleBillingPinLookup(v);
                      }}
                      placeholder="PIN code" inputMode="numeric" className={iCls} style={iStyle} />
                    {billingPinLoading && (
                      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: A.textMuted }}>⏳</span>
                    )}
                  </div>
                  <input value={bpForm.city ?? ""}
                    onChange={(e) => setBpField("city", e.target.value)}
                    placeholder="City" className={iCls} style={iStyle} />
                  <input value={bpForm.state ?? ""}
                    onChange={(e) => setBpField("state", e.target.value)}
                    placeholder="State" className={iCls} style={iStyle} />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button onClick={handleSaveBp}
                    disabled={savingBp || !bpForm.legalName.trim()}
                    className="text-sm px-5 py-2 rounded-md font-medium"
                    style={{
                      background: A.accent, color: "#fff",
                      opacity: (savingBp || !bpForm.legalName.trim()) ? 0.6 : 1,
                      cursor: (savingBp || !bpForm.legalName.trim()) ? "default" : "pointer",
                    }}>
                    {savingBp ? "Saving…" : editingBpId ? "Update" : "Save profile"}
                  </button>
                  <button onClick={() => { setShowBpForm(false); setEditingBpId(null); setBpForm(BP_EMPTY); }}
                    className="text-sm px-4 py-2 rounded-md"
                    style={{ border: `1px solid ${A.border}`, color: A.textMuted, background: A.surface, cursor: "pointer" }}>
                    Cancel
                  </button>
                  {bpSaved && <span className="text-sm font-medium" style={{ color: "#10B981" }}>✓ Saved</span>}
                </div>
              </div>
            ) : (
              <button onClick={openNewBpForm}
                className="w-full py-3 rounded-xl text-sm font-medium"
                style={{ border: `2px dashed ${A.border}`, color: A.accent, background: "transparent", cursor: "pointer" }}>
                + Add billing profile
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function StoreAccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
        <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    }>
      <AccountPageContent />
    </Suspense>
  );
}
