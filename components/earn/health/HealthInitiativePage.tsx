"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const InitiativePostsBlock = dynamic(
  () => import("@/components/initiative/InitiativePostsBlock"),
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthBusiness = {
  id: string;
  specialty: string;
  credentials: string | null;
  consultationMode: string;
  searchTags: string[];
  about: string | null;
};

type HealthService = {
  id: string;
  title: string;
  description: string | null;
  duration: string | null;
  price: string | null;
};

type HealthBooking = {
  id: string;
  status: string;
  preferredTime: string | null;
  message: string | null;
  meetingLink: string | null;
  createdAt: string;
  service: { id: string; title: string } | null;
  visitor?: { id: string; name: string | null; avatarUrl: string | null };
};

type Subscriber = {
  subscriptionId: string;
  userId: string;
  tier: string;
  subscribedAt: string;
  consentGranted: boolean;
  consentFields: string[] | null;
  user: { name: string | null; avatarUrl: string | null };
  health: Record<string, unknown> | null;
  lastAdviceAt: string | null;
};

type AdviceType = "meal" | "exercise" | "sleep" | "general";

type Tab = "overview" | "services" | "bookings" | "clients" | "settings";

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIALTY_LABELS: Record<string, string> = {
  nutrition: "Nutrition",
  fitness: "Fitness",
  sleep: "Sleep",
  mental: "Mental Health",
  holistic: "Holistic",
};

const SPECIALTY_OPTIONS = Object.entries(SPECIALTY_LABELS);

const ADVICE_TYPES: { value: AdviceType; label: string }[] = [
  { value: "meal",     label: "Meal"     },
  { value: "exercise", label: "Exercise" },
  { value: "sleep",    label: "Sleep"    },
  { value: "general",  label: "General"  },
];

const FIELD_LABELS: Record<string, string> = {
  food:              "Diet",
  exercise:          "Exercise",
  sessionsPerWeek:   "Sessions / Week",
  heightCm:          "Height (cm)",
  weightKg:          "Weight (kg)",
  age:               "Age",
  sleepQuality:      "Sleep Quality",
  mood:              "Mood",
  stressLevel:       "Stress",
  bodyFatPct:        "Body Fat %",
  waistCm:           "Waist (cm)",
  hipCm:             "Hip (cm)",
  bicepCm:           "Bicep (cm)",
  chestCm:           "Chest (cm)",
  medicalConditions: "Medical Conditions",
  focusClarity:      "Focus & Clarity",
  socialInteraction: "Social",
  energyLevel:       "Energy",
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "bg-amber-900/40 text-amber-300 border-amber-800/40",
    confirmed: "bg-emerald-900/40 text-emerald-300 border-emerald-800/40",
    declined:  "bg-red-900/40 text-red-300 border-red-800/40",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${map[status] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{children}</h3>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 rounded-xl border border-gray-800 bg-gray-900/50 text-center text-gray-500 text-sm">
      {children}
    </div>
  );
}

function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-4 rounded-xl border border-red-800/40 bg-red-950/20 text-red-400 text-sm">
      {message}
      <br />
      <button onClick={onRetry} className="mt-2 underline text-red-300 hover:text-red-200 transition-colors">
        Retry
      </button>
    </div>
  );
}

function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-gray-900 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Subscriber helpers ───────────────────────────────────────────────────────

type IndicatorLevel = "up" | "mid" | "down";

function bmiLevel(bmi: number): IndicatorLevel {
  if (bmi < 18.5) return "down";
  if (bmi <= 24.9) return "up";
  return "down";
}
function sleepLevel(q: string): IndicatorLevel {
  if (q === "good") return "up";
  if (q === "moderate") return "mid";
  return "down";
}
function moodLevel(m: string): IndicatorLevel {
  if (m === "😄" || m === "🙂") return "up";
  if (m === "😐") return "mid";
  return "down";
}
function levelColor(l: IndicatorLevel) {
  if (l === "up")  return "text-emerald-400";
  if (l === "mid") return "text-yellow-400";
  return "text-red-400";
}
function levelArrow(l: IndicatorLevel) {
  if (l === "up")  return "↑";
  if (l === "mid") return "→";
  return "↓";
}
function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
function filteredHealth(health: Record<string, unknown>, consentFields: string[] | null) {
  if (!consentFields || consentFields.length === 0) return [];
  return consentFields
    .filter((k) => k in health && health[k] !== null && health[k] !== undefined && health[k] !== "")
    .map((k): [string, unknown] => [k, health[k]]);
}

function SubAvatar({ name, avatarUrl, size = "md" }: { name: string | null; avatarUrl: string | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={name ?? ""} className={`${dim} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-teal-700 to-emerald-800 flex items-center justify-center font-bold text-white shrink-0`}>
      {initials(name)}
    </div>
  );
}

function Indicator({ label, level }: { label: string; level: IndicatorLevel }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 ${levelColor(level)}`}>
      {levelArrow(level)} {label}
    </span>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  pageId,
  pageTitle,
  healthBusiness,
  isOwner,
  onHbUpdate,
}: {
  pageId: string;
  pageTitle: string;
  healthBusiness: HealthBusiness | null;
  isOwner: boolean;
  onHbUpdate: (hb: HealthBusiness) => void;
}) {
  const [about, setAbout] = useState(healthBusiness?.about ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveAbout() {
    setSaving(true);
    try {
      const res = await fetch(`/api/health-business/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ about: about.trim() || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        onHbUpdate(updated);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Practitioner header card */}
      <div className="p-5 rounded-2xl border border-teal-800/50 bg-teal-900/10 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{pageTitle}</h2>
            {healthBusiness?.credentials && (
              <p className="text-sm text-gray-400 mt-0.5">{healthBusiness.credentials}</p>
            )}
          </div>
          {healthBusiness && (
            <span className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium bg-teal-900/60 text-teal-300 border border-teal-700/50">
              {SPECIALTY_LABELS[healthBusiness.specialty] ?? healthBusiness.specialty}
            </span>
          )}
        </div>

        {healthBusiness && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Mode:</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
              {healthBusiness.consultationMode === "manual" ? "Manual" :
               healthBusiness.consultationMode === "rules"  ? "Rules" : "Agent"}
            </span>
          </div>
        )}

        {healthBusiness && healthBusiness.searchTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {healthBusiness.searchTags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-teal-950 text-teal-400 border border-teal-800/40">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* About section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel>About this practice</SectionLabel>
          {isOwner && !editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-teal-400 hover:underline">
              {about ? "Edit" : "Add description →"}
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={4}
              placeholder="Describe your practice, approach, and what visitors can expect…"
              className="w-full bg-gray-900 border border-teal-700/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-teal-500 focus:outline-none resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setAbout(healthBusiness?.about ?? ""); setEditing(false); }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveAbout}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium disabled:opacity-50 transition-colors"
              >
                {saving && <Spinner />}
                Save
              </button>
            </div>
          </div>
        ) : about ? (
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{about}</p>
        ) : null}
      </div>

      {/* Posts feed */}
      <div className="space-y-2">
        <SectionLabel>Posts</SectionLabel>
        <InitiativePostsBlock
          pageId={pageId}
          isCreator={isOwner}
          accentColor="#0F6E56"
          theme="dark"
        />
      </div>
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab({
  pageId,
  isOwner,
  onBookClick,
}: {
  pageId: string;
  isOwner: boolean;
  onBookClick: (service: HealthService) => void;
}) {
  const [services, setServices] = useState<HealthService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/health-services?pageId=${pageId}`, { credentials: "include" });
      if (res.ok) setServices(await res.json());
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => { load(); }, [load]);

  function openAddForm() {
    setEditingId(null);
    setFormTitle(""); setFormDesc(""); setFormDuration(""); setFormPrice("");
    setShowForm(true);
  }

  function openEditForm(s: HealthService) {
    setEditingId(s.id);
    setFormTitle(s.title);
    setFormDesc(s.description ?? "");
    setFormDuration(s.duration ?? "");
    setFormPrice(s.price ?? "");
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      const body = { title: formTitle, description: formDesc || null, duration: formDuration || null, price: formPrice || null };
      if (editingId) {
        const res = await fetch(`/api/health-services/${editingId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify(body),
        });
        if (res.ok) setServices((prev) => prev.map((s) => s.id === editingId ? { ...s, ...body, id: s.id } : s));
      } else {
        const res = await fetch("/api/health-services", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ pageId, ...body }),
        });
        if (res.ok) { const svc = await res.json(); setServices((prev) => [...prev, svc]); }
      }
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/health-services/${id}`, { method: "DELETE", credentials: "include" });
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return <SkeletonCards count={2} />;

  return (
    <div className="space-y-3">
      {services.length === 0 && !showForm && (
        <EmptyState>{isOwner ? "No services yet. Add your first service below." : "No services listed yet."}</EmptyState>
      )}

      {services.map((s) => (
        <div key={s.id} className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-white">{s.title}</p>
            <div className="flex items-center gap-2 shrink-0">
              {s.price && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-900/50 text-teal-300 border border-teal-800/40 font-medium">
                  {s.price}
                </span>
              )}
              {s.duration && <span className="text-xs text-gray-500">{s.duration}</span>}
            </div>
          </div>
          {s.description && <p className="text-xs text-gray-400 leading-relaxed">{s.description}</p>}
          <div className="flex items-center gap-2 pt-1">
            {isOwner ? (
              <>
                <button onClick={() => openEditForm(s)} className="text-xs text-teal-400 hover:underline">Edit</button>
                <span className="text-gray-700">·</span>
                <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400 hover:underline">Delete</button>
              </>
            ) : (
              <button
                onClick={() => onBookClick(s)}
                className="text-xs px-3 py-1 rounded-lg bg-teal-700 hover:bg-teal-600 text-white font-medium transition-colors"
              >
                Book
              </button>
            )}
          </div>
        </div>
      ))}

      {isOwner && (
        showForm ? (
          <div className="p-4 rounded-xl border border-teal-800/50 bg-teal-900/10 space-y-3">
            <SectionLabel>{editingId ? "Edit service" : "New service"}</SectionLabel>
            <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Service title *"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none" />
            <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Description (optional)" rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none resize-none" />
            <div className="grid grid-cols-2 gap-2">
              <input value={formDuration} onChange={(e) => setFormDuration(e.target.value)} placeholder="Duration (e.g. 30 min)"
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none" />
              <input value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="Price (e.g. ₹500 or Free)"
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting || !formTitle.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium disabled:opacity-50 transition-colors">
                {submitting && <Spinner />}
                {editingId ? "Save changes" : "Add service"}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={openAddForm}
            className="w-full p-3 rounded-xl border border-dashed border-teal-800/60 text-teal-400 text-sm hover:bg-teal-900/10 transition-colors">
            + Add Service
          </button>
        )
      )}
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab({
  pageId,
  isOwner,
  prefillService,
  onPrefillClear,
}: {
  pageId: string;
  isOwner: boolean;
  prefillService: HealthService | null;
  onPrefillClear: () => void;
}) {
  const [bookings, setBookings] = useState<HealthBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<HealthService[]>([]);
  const [selServiceId, setSelServiceId] = useState("");
  const [prefTime, setPrefTime] = useState("");
  const [visitorMsg, setVisitorMsg] = useState("");
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [meetingLinkInput, setMeetingLinkInput] = useState("");
  const [actioning, setActioning] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        fetch(`/api/health-bookings?pageId=${pageId}`, { credentials: "include" }),
        !isOwner ? fetch(`/api/health-services?pageId=${pageId}`, { credentials: "include" }) : Promise.resolve(null),
      ]);
      if (bRes.ok) setBookings(await bRes.json());
      if (sRes?.ok) setServices(await sRes.json());
    } finally {
      setLoading(false);
    }
  }, [pageId, isOwner]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (prefillService) { setSelServiceId(prefillService.id); onPrefillClear(); }
  }, [prefillService, onPrefillClear]);

  function mark(id: string, on: boolean) {
    setActioning((prev) => { const next = new Set(prev); on ? next.add(id) : next.delete(id); return next; });
  }

  async function submitBooking() {
    setSubmittingBooking(true);
    try {
      const res = await fetch("/api/health-bookings", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ pageId, serviceId: selServiceId || null, preferredTime: prefTime || null, message: visitorMsg || null }),
      });
      if (res.ok) {
        const booking = await res.json(); setBookings((prev) => [booking, ...prev]);
        setSelServiceId(""); setPrefTime(""); setVisitorMsg("");
        setBookingSuccess(true);
        setTimeout(() => setBookingSuccess(false), 4000);
      }
    } finally {
      setSubmittingBooking(false);
    }
  }

  async function handleDecline(id: string) {
    mark(id, true);
    try {
      const res = await fetch(`/api/health-bookings/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ status: "declined" }),
      });
      if (res.ok) setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: "declined" } : b));
    } finally { mark(id, false); }
  }

  async function handleConfirm(id: string) {
    mark(id, true);
    try {
      const res = await fetch(`/api/health-bookings/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ status: "confirmed", meetingLink: meetingLinkInput.trim() || null }),
      });
      if (res.ok) {
        const updated: HealthBooking = await res.json();
        setBookings((prev) => prev.map((b) => b.id === id ? updated : b));
        setConfirmingId(null); setMeetingLinkInput("");
      }
    } finally { mark(id, false); }
  }

  if (loading) return <SkeletonCards count={2} />;

  if (isOwner) {
    const pending   = bookings.filter((b) => b.status === "pending");
    const confirmed = bookings.filter((b) => b.status === "confirmed");
    const past      = bookings.filter((b) => b.status === "declined");

    const BookingCard = ({ b }: { b: HealthBooking }) => {
      const isConfirming = confirmingId === b.id;
      return (
        <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white">{b.visitor?.name ?? "Unknown visitor"}</p>
              {b.service && <p className="text-xs text-gray-400 mt-0.5">Service: {b.service.title}</p>}
              {b.preferredTime && (
                <p className="text-xs text-gray-400">Requested: {new Date(b.preferredTime).toLocaleString()}</p>
              )}
              {b.message && <p className="text-xs text-gray-400 italic mt-1">&ldquo;{b.message}&rdquo;</p>}
              {b.meetingLink && (
                <a href={b.meetingLink} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-teal-400 hover:underline block mt-1 truncate">🔗 {b.meetingLink}</a>
              )}
            </div>
            <StatusChip status={b.status} />
          </div>

          {b.status === "pending" && (
            isConfirming ? (
              <div className="space-y-2 pt-1">
                <input value={meetingLinkInput} onChange={(e) => setMeetingLinkInput(e.target.value)}
                  placeholder="Meeting link or location (optional)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={() => handleConfirm(b.id)} disabled={actioning.has(b.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium disabled:opacity-50 transition-colors">
                    {actioning.has(b.id) && <Spinner />} Confirm
                  </button>
                  <button onClick={() => { setConfirmingId(null); setMeetingLinkInput(""); }}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">Back</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 pt-1">
                <button onClick={() => setConfirmingId(b.id)}
                  className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-xs font-medium transition-colors">
                  Confirm
                </button>
                <button onClick={() => handleDecline(b.id)} disabled={actioning.has(b.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-xs transition-colors disabled:opacity-50">
                  {actioning.has(b.id) && <Spinner />} Decline
                </button>
              </div>
            )
          )}
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {bookings.length === 0 && <EmptyState>No booking requests yet.</EmptyState>}
        {pending.length > 0 && (
          <section className="space-y-2">
            <SectionLabel>Pending ({pending.length})</SectionLabel>
            {pending.map((b) => <BookingCard key={b.id} b={b} />)}
          </section>
        )}
        {confirmed.length > 0 && (
          <section className="space-y-2">
            <SectionLabel>Confirmed ({confirmed.length})</SectionLabel>
            {confirmed.map((b) => <BookingCard key={b.id} b={b} />)}
          </section>
        )}
        {past.length > 0 && (
          <section className="space-y-2">
            <SectionLabel>Past</SectionLabel>
            {past.map((b) => <BookingCard key={b.id} b={b} />)}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-teal-800/50 bg-teal-900/10 space-y-3">
        <p className="text-sm font-semibold text-teal-300">Request a booking</p>
        {services.length > 0 && (
          <select value={selServiceId} onChange={(e) => setSelServiceId(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none">
            <option value="">Select a service (optional)</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
        <input type="datetime-local" value={prefTime} onChange={(e) => setPrefTime(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none" />
        <textarea value={visitorMsg} onChange={(e) => setVisitorMsg(e.target.value)}
          placeholder="Message to practitioner (optional)" rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-teal-500 focus:outline-none resize-none" />
        {bookingSuccess && (
          <div className="text-xs px-3 py-2 rounded-lg bg-emerald-900/40 border border-emerald-800/50 text-emerald-300">
            Booking request sent!
          </div>
        )}
        <button onClick={submitBooking} disabled={submittingBooking}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
          {submittingBooking && <Spinner />} Submit request
        </button>
      </div>

      {bookings.length > 0 && (
        <section className="space-y-3">
          <SectionLabel>Your bookings</SectionLabel>
          {bookings.map((b) => (
            <div key={b.id} className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  {b.service && <p className="text-sm text-white font-medium">{b.service.title}</p>}
                  {b.preferredTime && <p className="text-xs text-gray-400">{new Date(b.preferredTime).toLocaleString()}</p>}
                  {b.meetingLink && (
                    <a href={b.meetingLink} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-teal-400 hover:underline block mt-1 truncate">🔗 {b.meetingLink}</a>
                  )}
                </div>
                <StatusChip status={b.status} />
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ─── Respond Panel (slide-over) ───────────────────────────────────────────────

function RespondPanel({
  subscriber,
  businessId,
  onClose,
  onSent,
}: {
  subscriber: Subscriber;
  businessId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [advice, setAdvice] = useState("");
  const [adviceType, setAdviceType] = useState<AdviceType>("general");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const snapshot = subscriber.health
    ? filteredHealth(subscriber.health, subscriber.consentFields)
    : [];

  async function send() {
    setError(null);
    const trimmed = advice.trim();
    if (!trimmed) { setError("Please enter advice before sending."); return; }
    setSending(true);
    try {
      const res = await fetch("/api/health-business/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ healthBusinessId: businessId, userId: subscriber.userId, advice: trimmed, adviceType }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `Status ${res.status}`);
      onSent();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send advice");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-[480px] bg-[#0d0d0d] border-l border-gray-800 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <SubAvatar name={subscriber.user.name} avatarUrl={subscriber.user.avatarUrl} size="sm" />
            <div>
              <p className="text-sm font-semibold text-white">{subscriber.user.name ?? "Subscriber"}</p>
              <p className="text-xs text-gray-500 capitalize">{subscriber.tier} tier</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <SectionLabel>Health Snapshot</SectionLabel>
            <div className="mt-3">
              {snapshot.length === 0 ? (
                <p className="text-sm text-gray-600 italic">
                  {subscriber.consentGranted ? "No consented fields to display." : "Subscriber has not granted data access."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {snapshot.map(([key, val]) => (
                    <div key={key} className="p-2.5 rounded-lg bg-gray-900 border border-gray-800">
                      <p className="text-xs text-gray-500 mb-0.5">{FIELD_LABELS[key] ?? key}</p>
                      <p className="text-sm text-white font-medium truncate">
                        {Array.isArray(val) ? (val as unknown[]).join(", ") : String(val)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <SectionLabel>Advice Type</SectionLabel>
            <div className="flex flex-wrap gap-2 mt-2">
              {ADVICE_TYPES.map(({ value, label }) => (
                <button key={value} type="button" onClick={() => setAdviceType(value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                    adviceType === value
                      ? "border-teal-500 bg-teal-500/20 text-teal-300"
                      : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Your Advice</SectionLabel>
            <textarea ref={textareaRef} value={advice} onChange={(e) => setAdvice(e.target.value)}
              placeholder="Write personalised advice based on the subscriber's health profile…"
              disabled={sending} rows={7}
              className="mt-2 w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500 resize-none outline-none focus:border-teal-600 transition-colors" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 shrink-0 flex gap-2 justify-end">
          <button onClick={onClose} disabled={sending}
            className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 hover:border-gray-500 text-sm text-gray-300 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={send} disabled={sending || !advice.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {sending && <Spinner />}
            {sending ? "Sending…" : "Send Advice"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Subscriber Card ──────────────────────────────────────────────────────────

function SubscriberCard({ subscriber, onRespond }: { subscriber: Subscriber; onRespond: (s: Subscriber) => void }) {
  const health = subscriber.health ?? {};
  const bmi = (() => {
    const h = parseFloat(String(health.heightCm ?? ""));
    const w = parseFloat(String(health.weightKg ?? ""));
    return h > 0 && w > 0 ? w / Math.pow(h / 100, 2) : null;
  })();
  const sleep = String(health.sleepQuality ?? "");
  const mood  = String(health.mood ?? "");

  const cf = subscriber.consentFields;
  const showBMI   = bmi !== null  && (!cf || cf.includes("heightCm") || cf.includes("weightKg"));
  const showSleep = !!sleep       && (!cf || cf.includes("sleepQuality"));
  const showMood  = !!mood        && (!cf || cf.includes("mood"));

  return (
    <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-3">
        <SubAvatar name={subscriber.user.name} avatarUrl={subscriber.user.avatarUrl} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-white truncate">{subscriber.user.name ?? "User"}</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-900/40 text-teal-300 border border-teal-800/40 capitalize shrink-0">
              {subscriber.tier}
            </span>
          </div>

          {(showBMI || showSleep || showMood) ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {showBMI  && bmi   && <Indicator label={`BMI ${bmi.toFixed(1)}`} level={bmiLevel(bmi)} />}
              {showSleep        && <Indicator label={`Sleep ${sleep}`}         level={sleepLevel(sleep)} />}
              {showMood         && <Indicator label={`Mood ${mood}`}           level={moodLevel(mood)} />}
            </div>
          ) : (
            <p className="text-xs text-gray-600 mb-2 italic">No health indicators consented</p>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Since {fmtDate(subscriber.subscribedAt)}</span>
            <span className="text-gray-700">·</span>
            <span>Last advice: {fmtDate(subscriber.lastAdviceAt)}</span>
          </div>
        </div>

        <button onClick={() => onRespond(subscriber)}
          className="shrink-0 px-3 py-1.5 rounded-lg text-sm bg-teal-700 hover:bg-teal-600 text-white transition-colors font-medium">
          Respond
        </button>
      </div>
    </div>
  );
}

// ─── Clients Tab ──────────────────────────────────────────────────────────────

function ClientsTab({ pageId }: { pageId: string }) {
  type Phase = "loading" | "ready" | "error";
  const [phase, setPhase] = useState<Phase>("loading");
  const [businessId, setBusinessId] = useState("");
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [respondingTo, setRespondingTo] = useState<Subscriber | null>(null);
  const [sentBanner, setSentBanner] = useState(false);

  const fetchSubscribers = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch(`/api/health-business/subscribers/${pageId}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `Status ${res.status}`);
      setBusinessId(data.businessId ?? "");
      setSubscribers(data.subscribers ?? []);
      setPhase("ready");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to load subscribers");
      setPhase("error");
    }
  }, [pageId]);

  useEffect(() => { fetchSubscribers(); }, [fetchSubscribers]);

  function handleSent() {
    setRespondingTo(null);
    setSentBanner(true);
    setTimeout(() => setSentBanner(false), 3000);
    fetchSubscribers();
  }

  return (
    <div className="space-y-5">
      {sentBanner && (
        <div className="p-3 rounded-xl bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-sm">
          ✓ Advice sent successfully.
        </div>
      )}

      <div className="flex items-center justify-between">
        <SectionLabel>
          Active Subscribers{phase === "ready" ? ` (${subscribers.length})` : ""}
        </SectionLabel>
      </div>

      {phase === "loading" && <SkeletonCards count={3} />}

      {phase === "error" && (
        <ErrorRetry message={errorMsg} onRetry={fetchSubscribers} />
      )}

      {phase === "ready" && subscribers.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-3xl mb-3">🌱</p>
          <p className="text-gray-400 font-medium">No active subscribers yet</p>
          <p className="text-gray-600 text-sm mt-1">Share your health page to start getting subscribers.</p>
        </div>
      )}

      {phase === "ready" && subscribers.length > 0 && (
        <div className="space-y-3">
          {subscribers.map((s) => (
            <SubscriberCard key={s.subscriptionId} subscriber={s} onRespond={setRespondingTo} />
          ))}
        </div>
      )}

      {respondingTo && (
        <RespondPanel
          subscriber={respondingTo}
          businessId={businessId}
          onClose={() => setRespondingTo(null)}
          onSent={handleSent}
        />
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({
  pageId,
  healthBusiness,
  onSaved,
}: {
  pageId: string;
  healthBusiness: HealthBusiness | null;
  onSaved: (updated: HealthBusiness) => void;
}) {
  const [specialty,    setSpecialty]    = useState(healthBusiness?.specialty ?? "nutrition");
  const [credentials,  setCredentials]  = useState(healthBusiness?.credentials ?? "");
  const [mode,         setMode]         = useState(healthBusiness?.consultationMode ?? "manual");
  const [tagsInput,    setTagsInput]    = useState(healthBusiness?.searchTags.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/health-business/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          specialty,
          credentials: credentials.trim() || null,
          consultationMode: mode,
          searchTags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        onSaved(await res.json());
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">Specialty</label>
        <div className="flex flex-wrap gap-2">
          {SPECIALTY_OPTIONS.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setSpecialty(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                specialty === value
                  ? "bg-teal-700 border-teal-600 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-teal-700 hover:text-teal-300"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">Credentials</label>
        <textarea value={credentials} onChange={(e) => setCredentials(e.target.value)}
          placeholder="e.g. Certified Nutritionist, RDN, MSc" rows={2}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-teal-500 focus:outline-none resize-none" />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">Consultation Mode</label>
        <div className="space-y-2">
          {(["manual", "rules", "agent"] as const).map((m) => (
            <label key={m}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                mode === m ? "border-teal-700/60 bg-teal-900/10" : "border-gray-800 bg-gray-900/50"
              } ${m !== "manual" ? "opacity-50 cursor-not-allowed" : ""}`}>
              <input type="radio" name="mode" value={m} checked={mode === m} disabled={m !== "manual"}
                onChange={() => setMode(m)} className="accent-teal-500" />
              <span className="text-sm text-white capitalize">{m}</span>
              {m !== "manual" && <span className="ml-auto text-xs text-gray-500">Coming soon</span>}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">Search Tags</label>
        <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
          placeholder="weight loss, diabetes care, prenatal yoga, …"
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-teal-500 focus:outline-none" />
        <p className="text-xs text-gray-600">Comma-separated. Used when people search for practitioners.</p>
      </div>

      {saved && (
        <div className="text-xs px-3 py-2 rounded-lg bg-emerald-900/40 border border-emerald-800/50 text-emerald-300">
          Settings saved.
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
        {saving && <Spinner />}
        Save settings
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface HealthInitiativePageProps {
  pageId: string;
  pageTitle: string;
  pageDescription: string | null;
  isOwner: boolean;
  healthBusiness: HealthBusiness | null;
}

export default function HealthInitiativePage({
  pageId,
  pageTitle,
  isOwner,
  healthBusiness: initialHB,
}: HealthInitiativePageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [hb, setHb] = useState<HealthBusiness | null>(initialHB);
  const [bookingPrefill, setBookingPrefill] = useState<HealthService | null>(null);

  function handleBookClick(service: HealthService) {
    setBookingPrefill(service);
    setActiveTab("bookings");
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview",  label: "Overview"  },
    { id: "services",  label: "Services"  },
    { id: "bookings",  label: "Bookings"  },
    ...(isOwner ? [
      { id: "clients"  as Tab, label: "Clients"  },
      { id: "settings" as Tab, label: "Settings" },
    ] : []),
  ];

  return (
    <div>
      <div className="flex gap-1 p-1 rounded-xl bg-gray-900 border border-gray-800 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-teal-700 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <OverviewTab
          pageId={pageId}
          pageTitle={pageTitle}
          healthBusiness={hb}
          isOwner={isOwner}
          onHbUpdate={setHb}
        />
      )}
      {activeTab === "services" && (
        <ServicesTab pageId={pageId} isOwner={isOwner} onBookClick={handleBookClick} />
      )}
      {activeTab === "bookings" && (
        <BookingsTab
          pageId={pageId}
          isOwner={isOwner}
          prefillService={bookingPrefill}
          onPrefillClear={() => setBookingPrefill(null)}
        />
      )}
      {activeTab === "clients"  && isOwner && <ClientsTab pageId={pageId} />}
      {activeTab === "settings" && isOwner && (
        <SettingsTab pageId={pageId} healthBusiness={hb} onSaved={setHb} />
      )}
    </div>
  );
}
