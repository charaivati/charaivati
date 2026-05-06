"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

type HealthData = Record<string, unknown>;

type Subscriber = {
  subscriptionId: string;
  userId: string;
  tier: string;
  subscribedAt: string;
  consentGranted: boolean;
  consentFields: string[] | null;
  user: { name: string | null; avatarUrl: string | null };
  health: HealthData | null;
  lastAdviceAt: string | null;
};

type AdviceType = "meal" | "exercise" | "sleep" | "general";

// ─── Constants ───────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  food: "Diet",
  exercise: "Exercise",
  sessionsPerWeek: "Sessions / Week",
  heightCm: "Height (cm)",
  weightKg: "Weight (kg)",
  age: "Age",
  sleepQuality: "Sleep Quality",
  mood: "Mood",
  stressLevel: "Stress",
  bodyFatPct: "Body Fat %",
  waistCm: "Waist (cm)",
  hipCm: "Hip (cm)",
  bicepCm: "Bicep (cm)",
  chestCm: "Chest (cm)",
  medicalConditions: "Medical Conditions",
  focusClarity: "Focus & Clarity",
  socialInteraction: "Social",
  energyLevel: "Energy",
};

const ADVICE_TYPES: { value: AdviceType; label: string }[] = [
  { value: "meal", label: "Meal" },
  { value: "exercise", label: "Exercise" },
  { value: "sleep", label: "Sleep" },
  { value: "general", label: "General" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcBMI(health: HealthData): number | null {
  const h = parseFloat(String(health.heightCm ?? ""));
  const w = parseFloat(String(health.weightKg ?? ""));
  if (!h || !w) return null;
  return w / Math.pow(h / 100, 2);
}

type IndicatorLevel = "up" | "mid" | "down";

function bmiLevel(bmi: number): IndicatorLevel {
  if (bmi < 18.5) return "down";
  if (bmi <= 24.9) return "mid";
  return "up";
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
  if (l === "up") return "text-emerald-400";
  if (l === "mid") return "text-yellow-400";
  return "text-red-400";
}

function levelArrow(l: IndicatorLevel) {
  if (l === "up") return "↑";
  if (l === "mid") return "→";
  return "↓";
}

function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function filteredHealth(health: HealthData, consentFields: string[] | null): [string, unknown][] {
  if (!consentFields || consentFields.length === 0) return [];
  return consentFields
    .filter((k) => k in health && health[k] !== null && health[k] !== undefined && health[k] !== "")
    .map((k) => [k, health[k]]);
}

function renderValue(key: string, val: unknown): string {
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Indicator({ label, level }: { label: string; level: IndicatorLevel }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-800 ${levelColor(level)}`}>
      {levelArrow(level)} {label}
    </span>
  );
}

function Avatar({ name, avatarUrl, size = "md" }: { name: string | null; avatarUrl: string | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name ?? ""} className={`${dim} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center font-bold text-white shrink-0`}>
      {initials(name)}
    </div>
  );
}

// ─── Respond Panel ────────────────────────────────────────────────────────────

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

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

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
        body: JSON.stringify({
          healthBusinessId: businessId,
          userId: subscriber.userId,
          advice: trimmed,
          adviceType,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `Status ${res.status}`);
      onSent();
    } catch (e: any) {
      setError(e.message || "Failed to send advice");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-[480px] bg-[#0d0d0d] border-l border-gray-800 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <Avatar name={subscriber.user.name} avatarUrl={subscriber.user.avatarUrl} size="sm" />
            <div>
              <p className="text-sm font-semibold text-white">{subscriber.user.name ?? "Subscriber"}</p>
              <p className="text-xs text-gray-500 capitalize">{subscriber.tier} tier</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Health snapshot */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Health Snapshot</p>
            {snapshot.length === 0 ? (
              <p className="text-sm text-gray-600 italic">
                {subscriber.consentGranted ? "No consented fields to display." : "Subscriber has not granted data access."}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {snapshot.map(([key, val]) => (
                  <div key={key} className="p-2.5 rounded-lg bg-gray-900 border border-gray-800">
                    <p className="text-xs text-gray-500 mb-0.5">{FIELD_LABELS[key] ?? key}</p>
                    <p className="text-sm text-white font-medium truncate">{renderValue(key, val)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advice type */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Advice Type</p>
            <div className="flex flex-wrap gap-2">
              {ADVICE_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAdviceType(value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                    adviceType === value
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                      : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Advice textarea */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Your Advice</p>
            <textarea
              ref={textareaRef}
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
              placeholder="Write personalised advice based on the subscriber's health profile..."
              disabled={sending}
              rows={7}
              className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500 resize-none outline-none focus:border-emerald-600 transition-colors"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-800 shrink-0 flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 hover:border-gray-500 text-sm text-gray-300 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending || !advice.trim()}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Sending…" : "Send Advice"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Subscriber Card ──────────────────────────────────────────────────────────

function SubscriberCard({
  subscriber,
  onRespond,
}: {
  subscriber: Subscriber;
  onRespond: (s: Subscriber) => void;
}) {
  const health = subscriber.health ?? {};
  const bmi = calcBMI(health);
  const sleep = String(health.sleepQuality ?? "");
  const mood = String(health.mood ?? "");

  const showBMI =
    bmi !== null &&
    (!subscriber.consentFields ||
      subscriber.consentFields.includes("heightCm") ||
      subscriber.consentFields.includes("weightKg"));
  const showSleep =
    !!sleep && (!subscriber.consentFields || subscriber.consentFields.includes("sleepQuality"));
  const showMood =
    !!mood && (!subscriber.consentFields || subscriber.consentFields.includes("mood"));

  return (
    <div className="p-4 rounded-xl border border-gray-800 bg-gray-950/60 hover:border-gray-700 transition-colors">
      <div className="flex items-start gap-3">
        <Avatar name={subscriber.user.name} avatarUrl={subscriber.user.avatarUrl} />

        <div className="flex-1 min-w-0">
          {/* Name + tier */}
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-white truncate">{subscriber.user.name ?? "User"}</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-800/40 capitalize shrink-0">
              {subscriber.tier}
            </span>
          </div>

          {/* Visual indicators */}
          {(showBMI || showSleep || showMood) ? (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {showBMI && bmi && (
                <Indicator label={`BMI ${bmi.toFixed(1)}`} level={bmiLevel(bmi)} />
              )}
              {showSleep && (
                <Indicator label={`Sleep ${sleep}`} level={sleepLevel(sleep)} />
              )}
              {showMood && (
                <Indicator label={`Mood ${mood}`} level={moodLevel(mood)} />
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-600 mb-2 italic">No health indicators consented</p>
          )}

          {/* Last advice + since */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Since {fmtDate(subscriber.subscribedAt)}</span>
            <span className="text-gray-700">·</span>
            <span>Last advice: {fmtDate(subscriber.lastAdviceAt)}</span>
          </div>
        </div>

        {/* Action */}
        <button
          onClick={() => onRespond(subscriber)}
          className="shrink-0 px-3 py-1.5 rounded-lg text-sm bg-emerald-600/80 hover:bg-emerald-600 text-white transition-colors font-medium"
        >
          Respond
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HealthDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = params?.businessId as string;

  type Phase = "loading" | "ready" | "error";
  const [phase, setPhase] = useState<Phase>("loading");
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [respondingTo, setRespondingTo] = useState<Subscriber | null>(null);
  const [sentBanner, setSentBanner] = useState(false);

  const fetchSubscribers = useCallback(async () => {
    try {
      const res = await fetch(`/api/health-business/${businessId}/subscribers`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `Status ${res.status}`);
      setSubscribers(data.subscribers ?? []);
      setPhase("ready");
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to load subscribers");
      setPhase("error");
    }
  }, [businessId]);

  useEffect(() => { fetchSubscribers(); }, [fetchSubscribers]);

  function handleSent() {
    setRespondingTo(null);
    setSentBanner(true);
    setTimeout(() => setSentBanner(false), 3000);
    fetchSubscribers();
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-[#080808]/90 backdrop-blur border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← Initiatives
          </button>
          <span className="text-gray-700">/</span>
          <span className="text-sm text-gray-300 font-medium">Subscriber Dashboard</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Banner */}
        {sentBanner && (
          <div className="p-3 rounded-xl bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-sm">
            ✓ Advice sent successfully.
          </div>
        )}

        {/* Section header */}
        <div>
          <h1 className="text-lg font-semibold text-white">Active Subscribers</h1>
          {phase === "ready" && (
            <p className="text-sm text-gray-500 mt-0.5">{subscribers.length} active subscription{subscribers.length !== 1 ? "s" : ""}</p>
          )}
        </div>

        {/* States */}
        {phase === "loading" && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-gray-900 animate-pulse" />
            ))}
          </div>
        )}

        {phase === "error" && (
          <div className="p-4 rounded-xl border border-red-800/40 bg-red-950/20 text-red-400 text-sm">
            {errorMsg}
            <br />
            <button onClick={fetchSubscribers} className="mt-2 underline text-red-300 hover:text-red-200">
              Retry
            </button>
          </div>
        )}

        {phase === "ready" && subscribers.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">🌱</p>
            <p className="text-gray-400 font-medium">No active subscribers yet</p>
            <p className="text-gray-600 text-sm mt-1">Share your health business page to start getting subscribers.</p>
          </div>
        )}

        {phase === "ready" && subscribers.length > 0 && (
          <div className="space-y-3">
            {subscribers.map((s) => (
              <SubscriberCard key={s.subscriptionId} subscriber={s} onRespond={setRespondingTo} />
            ))}
          </div>
        )}
      </div>

      {/* Respond panel */}
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
