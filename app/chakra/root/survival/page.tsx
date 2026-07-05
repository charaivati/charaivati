"use client";

// SURVIVAL-1: Root-chakra survival planning page — /chakra/root/survival.
// Reached from the root chakra detail page's "Work on this" factor links
// (SIGNAL_LINKS.health / SIGNAL_LINKS.funds in app/chakra/meta.ts).
// Three blocks, all riding EXISTING backends — no new write paths:
//   1. Food requirement (individual) — deterministic math from Profile.health
//      (edited via the existing EditHealthModal → PATCH /api/user/profile { health });
//   2. Survival funds — the Housing / Living / Health expense groups of
//      Profile.fundsProfile (FundsBlock's GroupColumn reused; whole fundsProfile
//      saved back so the /self dashboard reflects the same numbers);
//   3. Community — search & join a community group, or create a family group
//      (same POST /api/user/pages + POST /api/community-group flow as
//      /app/initiatives) and land DIRECTLY on /earn/initiative/[pageId].

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CHAKRAS } from "../../chakras";
import { useTranslations } from "@/hooks/useTranslations";
import EditHealthModal from "@/components/health/EditHealthModal";
import {
  GroupColumn, buildInitialExpenseGroups, sumGroups, formatINR,
} from "@/blocks/FundsBlock";
import type {
  HealthProfile, FundsProfile, FundGroup, GoalEntry, SkillEntry,
} from "@/types/self";

const T_SLUGS = [
  "chakra-journey", "chakra-saved",
  "survival-title", "survival-sub",
  "survival-food-title", "survival-food-edit", "survival-food-estimated",
  "survival-food-kcal", "survival-food-protein", "survival-food-cereals",
  "survival-food-pulses", "survival-food-oils", "survival-food-veg",
  "survival-food-water", "survival-food-perday", "survival-food-permonth",
  "survival-food-pref", "survival-food-athome", "survival-food-empty",
  "survival-funds-title", "survival-funds-sub", "survival-funds-total",
  "survival-funds-food", "survival-funds-income", "survival-funds-gap",
  "survival-community-title", "survival-community-sub", "survival-community-search",
  "survival-community-join", "survival-community-requested", "survival-community-member",
  "survival-community-view", "survival-community-none", "survival-community-members",
  "survival-community-create", "survival-community-create-sub",
  "survival-community-create-ph", "survival-community-create-btn",
].join(",");

const ROOT = CHAKRAS[0]; // Muladhara — colour + names

// Deterministic starfield — same Math.sin hash as /chakra/[key] (SSR-safe).
const STARS = Array.from({ length: 26 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
  return { top: r(1) * 100, left: r(2) * 100, size: 1 + r(3) * 1.5, delay: r(4) * 4, dur: 2 + r(5) * 3 };
});

const DEFAULT_HEALTH: HealthProfile = {
  food: "Vegetarian", exercise: "Mixed", sessionsPerWeek: 3,
  heightCm: "", weightKg: "", age: "",
};

const DEFAULT_FUNDS: FundsProfile = {
  sources: [], monthlyBurn: 0, targetRunway: 6, fundsPlan: null,
};

// The survival slice of the balance sheet — everything else (Transport,
// Lifestyle, Education, Financial…) belongs to other chakras' surfaces.
const SURVIVAL_GROUP_NAMES = ["Housing", "Living", "Health"];

// ─── Food requirement math — deterministic, in code (no AI call) ─────────────
// Daily calories: AI health-plan target when it exists, else a Mifflin-St Jeor
// estimate (gender-neutral midpoint constant −78, activity from sessions/week).
// Quantity split is a simple Indian-diet heuristic: 55% kcal cereals, 15%
// pulses, 20% oils/fats (9 kcal/g), fixed 400 g/day vegetables & fruit (WHO).
function computeFoodPlan(h: HealthProfile) {
  const w = parseFloat(String(h.weightKg ?? ""));
  const hc = parseFloat(String(h.heightCm ?? ""));
  const age = parseFloat(String(h.age ?? ""));
  const planKcal = h.healthPlan?.health_targets?.daily_calories_kcal ?? null;

  let kcal: number;
  let estimated = false;
  if (planKcal) {
    kcal = planKcal;
  } else if (w > 0 && hc > 0 && age > 0) {
    const bmr = 10 * w + 6.25 * hc - 5 * age - 78;
    const activity = Math.min(1.3 + 0.05 * (h.sessionsPerWeek || 0), 1.55);
    kcal = Math.round((bmr * activity) / 50) * 50;
    estimated = true;
  } else {
    kcal = 2000; // adult average until height/weight/age are filled in
    estimated = true;
  }

  return {
    kcal, estimated,
    proteinG: w > 0 ? Math.round(w * 0.9) : 55,
    cerealsG: Math.round((kcal * 0.55) / 3.45 / 10) * 10,
    pulsesG:  Math.round((kcal * 0.15) / 3.45 / 5) * 5,
    oilsG:    Math.round((kcal * 0.20) / 9 / 5) * 5,
    vegG:     400,
  };
}

const monthlyKg = (gPerDay: number) => ((gPerDay * 30) / 1000).toFixed(1);

// ─── Community types ──────────────────────────────────────────────────────────

type CommunityGroupItem = {
  id: string; pageId: string; slug: string | null; name: string;
  logoUrl: string | null; objective: string | null; memberCount: number;
  myStatus?: string | null; // "pending" | "approved" | null
};

export default function SurvivalPlanPage() {
  const t = useTranslations(T_SLUGS);
  const router = useRouter();
  const c = ROOT;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Profile-backed state ────────────────────────────────────────────────────
  const [loaded, setLoaded] = useState(false);
  const [health, setHealth] = useState<HealthProfile>(DEFAULT_HEALTH);
  const [funds, setFunds] = useState<FundsProfile>(DEFAULT_FUNDS);
  const [expenseGroups, setExpenseGroups] = useState<FundGroup[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fundsRef = useRef<FundsProfile>(DEFAULT_FUNDS);

  useEffect(() => {
    fetch("/api/user/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok || !j.profile) return;
        const p = j.profile;
        if (p.health) setHealth({ ...DEFAULT_HEALTH, ...p.health });
        const fp: FundsProfile = { ...DEFAULT_FUNDS, ...(p.fundsProfile ?? {}) };
        setFunds(fp);
        fundsRef.current = fp;
        // Bootstrap the full expense-group structure when none is saved yet, so
        // a later visit to the /self Funds panel sees the same familiar groups.
        const goals: GoalEntry[] = p.goals ?? [];
        const skills: SkillEntry[] = p.generalSkills ?? [];
        setExpenseGroups(
          fp.expenseGroups?.length ? fp.expenseGroups : buildInitialExpenseGroups(goals, skills, [])
        );
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  // ── Health save — same shape HealthBlock uses ───────────────────────────────
  function handleHealthSave(updated: HealthProfile) {
    setHealth(updated);
    fetch("/api/user/profile", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ health: updated }),
    }).then(flashSaved).catch(() => {});
  }

  // ── Funds save — whole fundsProfile, debounced (mirrors FundsBlock.saveAll) ──
  function saveFunds(nextGroups: FundGroup[]) {
    setExpenseGroups(nextGroups);
    const fp: FundsProfile = {
      ...fundsRef.current,
      expenseGroups: nextGroups,
      monthlyBurn: sumGroups(nextGroups), // keeps EnergyBlock / dashboard consistent
    };
    fundsRef.current = fp;
    setFunds(fp);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/user/profile", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundsProfile: fp }),
      }).then(flashSaved).catch(() => {});
    }, 800);
  }

  function onItemChange(groupName: string, ii: number, value: number) {
    saveFunds(expenseGroups.map((g) =>
      g.group !== groupName ? g : { ...g, items: g.items.map((item, j) => (j !== ii ? item : { ...item, value })) }
    ));
  }
  function onItemAdd(groupName: string, label: string) {
    saveFunds(expenseGroups.map((g) =>
      g.group !== groupName ? g : { ...g, items: [...g.items, { id: `sv-${Date.now().toString(36)}`, label, value: 0 }] }
    ));
  }
  function onItemRemove(groupName: string, ii: number) {
    saveFunds(expenseGroups.map((g) =>
      g.group !== groupName ? g : { ...g, items: g.items.filter((_, j) => j !== ii) }
    ));
  }

  // ── Derived numbers ─────────────────────────────────────────────────────────
  const plan = useMemo(() => computeFoodPlan(health), [health]);
  const survivalGroups = useMemo(
    () => expenseGroups
      .filter((g) => SURVIVAL_GROUP_NAMES.includes(g.group))
      .map((g) => ({ ...g, custom: true })), // show the add-item row on every survival group
    [expenseGroups]
  );
  const survivalTotal = sumGroups(survivalGroups);
  const foodMonthly = survivalGroups
    .flatMap((g) => g.items).find((i) => i.id === "liv-food")?.value ?? 0;
  const incomeTotal = funds.incomeGroups?.length
    ? sumGroups(funds.incomeGroups)
    : funds.sources.reduce((a, s) => a + (s.amount || 0), 0);

  // ── Community state ─────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<CommunityGroupItem[]>([]);
  const [query, setQuery] = useState("");
  const [joinBusy, setJoinBusy] = useState<string | null>(null);
  const [famName, setFamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/community-group?q=${encodeURIComponent(query)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((j) => setGroups(j.groups ?? []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function requestJoin(g: CommunityGroupItem) {
    if (joinBusy === g.id) return;
    setJoinBusy(g.id);
    try {
      const res = await fetch(`/api/community-group/${g.id}/membership/request`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const status = data.membership?.status === "approved" ? "approved" : "pending";
        setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, myStatus: status } : x)));
      }
    } finally {
      setJoinBusy(null);
    }
  }

  // Create a family group (community initiative) and land straight on its
  // initiative page — deliberately NOT via /app/home or the initiatives list.
  async function createFamilyGroup() {
    const title = famName.trim();
    if (!title || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const pageRes = await fetch("/api/user/pages", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type: "standard", pageType: "community_group" }),
      });
      const pageData = await pageRes.json().catch(() => ({}));
      if (!pageRes.ok || !pageData.ok) throw new Error(pageData.error || "Failed to create group");
      await fetch("/api/community-group", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: pageData.page.id }),
      });
      router.replace(`/earn/initiative/${pageData.page.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create group");
      setCreating(false);
    }
  }

  const foodRows: { label: string; grams: number }[] = [
    { label: t("survival-food-cereals", "Cereals (rice / atta)"), grams: plan.cerealsG },
    { label: t("survival-food-pulses", "Pulses / dal"),           grams: plan.pulsesG },
    { label: t("survival-food-oils", "Oils & fats"),              grams: plan.oilsG },
    { label: t("survival-food-veg", "Vegetables & fruit"),        grams: plan.vegG },
  ];

  const card: CSSProperties = { borderColor: `${c.color}26`, background: "rgba(8,8,14,0.62)" };

  return (
    <main className="relative min-h-screen bg-black text-white">
      <style>{`
        @keyframes chakraTwinkle { 0%,100% { opacity: .15; } 50% { opacity: 1; } }
        @keyframes chakraCardIn { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
      `}</style>

      {mounted && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          {STARS.map((s, i) => (
            <span key={i} style={{ position: "absolute", top: `${s.top}%`, left: `${s.left}%`,
              width: s.size, height: s.size, borderRadius: "50%", background: "#fff",
              animation: `chakraTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite` }} />
          ))}
        </div>
      )}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0"
        style={{ background: `radial-gradient(90% 50% at 50% 0%, ${c.color}22 0%, transparent 65%)` }} />

      <Link href="/chakra/root" className="fixed top-4 left-4 z-20 text-sm text-white/40 hover:text-white/80">
        ← {c.sanskrit}
      </Link>
      {saved && (
        <span className="fixed top-4 right-4 z-20 text-xs" style={{ color: c.color }}>
          {t("chakra-saved", "Saved ✓")}
        </span>
      )}

      <div className="relative z-10 mx-auto w-full max-w-md px-4 pb-12 pt-16" style={{ animation: "chakraCardIn .35s ease-out" }}>
        <h1 className="text-xl font-semibold">{t("survival-title", "Survival plan")}</h1>
        <p className="mt-1 text-sm text-white/50">
          {t("survival-sub", "Food, the funds to get it, and the people around you — the ground everything else stands on.")}
        </p>

        {/* ── 1 · Food requirement ── */}
        <section className="mt-6 rounded-xl border p-4" style={card}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium uppercase tracking-wider text-white/70">
              {t("survival-food-title", "Your food requirement")}
            </h2>
            <button type="button" onClick={() => setEditOpen(true)}
              className="text-xs font-medium hover:underline" style={{ color: c.color }}>
              {t("survival-food-edit", "Edit details")} →
            </button>
          </div>

          {!loaded ? (
            <div className="mt-3 h-28 animate-pulse rounded-lg bg-white/5" />
          ) : (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold" style={{ color: c.color }}>{plan.kcal.toLocaleString("en-IN")}</span>
                <span className="text-xs text-white/50">{t("survival-food-kcal", "kcal / day")}</span>
                <span className="ml-auto text-xs text-white/50">
                  {t("survival-food-protein", "Protein")} ~{plan.proteinG} g
                </span>
              </div>
              {plan.estimated && (
                <p className="mt-1 text-[11px] text-white/40">
                  {t("survival-food-estimated", "Estimated — add height, weight and age for a closer number.")}
                </p>
              )}

              <table className="mt-3 w-full text-xs">
                <thead>
                  <tr className="text-white/40">
                    <th className="pb-1 text-left font-normal" />
                    <th className="pb-1 text-right font-normal">{t("survival-food-perday", "per day")}</th>
                    <th className="pb-1 text-right font-normal">{t("survival-food-permonth", "per month")}</th>
                  </tr>
                </thead>
                <tbody>
                  {foodRows.map((row) => (
                    <tr key={row.label} className="border-t border-white/5">
                      <td className="py-1.5 text-white/80">{row.label}</td>
                      <td className="py-1.5 text-right tabular-nums text-white/60">{row.grams} g</td>
                      <td className="py-1.5 text-right tabular-nums text-white/60">{monthlyKg(row.grams)} kg</td>
                    </tr>
                  ))}
                  <tr className="border-t border-white/5">
                    <td className="py-1.5 text-white/80">{t("survival-food-water", "Water")}</td>
                    <td className="py-1.5 text-right tabular-nums text-white/60" colSpan={2}>2.5–3 L / day</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-3 border-t border-white/5 pt-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  {t("survival-food-pref", "Preference")} · {health.food}
                </p>
                {(health.availableFoods ?? []).length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(health.availableFoods ?? []).slice(0, 10).map((f) => (
                      <span key={f} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/60">{f}</span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-white/40">
                    {t("survival-food-empty", "Tell us what's available at home — it shapes the plan.")}
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        {/* ── 2 · Survival funds ── */}
        <section className="mt-4 rounded-xl border p-4" style={card}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-white/70">
            {t("survival-funds-title", "Funds for survival")}
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {t("survival-funds-sub", "Just the essentials — food, housing, health. The rest of your money lives in other chakras.")}
          </p>

          {!loaded ? (
            <div className="mt-3 h-40 animate-pulse rounded-lg bg-white/5" />
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: t("survival-funds-total", "Survival / mo"), value: formatINR(survivalTotal), accent: true },
                  { label: t("survival-funds-food", "Food / mo"), value: formatINR(foodMonthly) },
                  { label: t("survival-funds-income", "Income / mo"), value: formatINR(incomeTotal) },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-white/10 px-2 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-white/40">{m.label}</p>
                    <p className="text-sm font-bold tabular-nums" style={m.accent ? { color: c.color } : undefined}>{m.value}</p>
                  </div>
                ))}
              </div>
              {incomeTotal > 0 && survivalTotal > incomeTotal && (
                <p className="mt-2 text-[11px] text-amber-300/90">
                  {t("survival-funds-gap", "Survival costs exceed income — the Action factor (earning) is where this ground firms up.")}
                </p>
              )}

              <div className="mt-4">
                <GroupColumn
                  headerLabel=""
                  headerCls="hidden"
                  groups={survivalGroups}
                  total={survivalTotal}
                  onItemChange={onItemChange}
                  onItemAdd={onItemAdd}
                  onItemRemove={onItemRemove}
                />
              </div>
            </>
          )}
        </section>

        {/* ── 3 · Community ── */}
        <section className="mt-4 rounded-xl border p-4" style={card}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-white/70">
            {t("survival-community-title", "People to survive with")}
          </h2>
          <p className="mt-1 text-xs text-white/40">
            {t("survival-community-sub", "Food alone doesn't keep you standing — a family or community does. Join one, or start your own.")}
          </p>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("survival-community-search", "Search communities…")}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
          />

          <div className="mt-3 space-y-2">
            {groups.slice(0, 6).map((g) => (
              <div key={g.id} className="rounded-lg border border-white/10 p-3">
                <div className="flex items-center gap-2.5">
                  {g.logoUrl ? (
                    <img src={g.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                      style={{ background: `${c.color}22`, color: c.color }}>
                      {g.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{g.name}</p>
                    <p className="text-[10px] text-white/40">
                      {g.memberCount} {t("survival-community-members", "members")}
                      {g.objective ? <> · <span className="text-white/50">{g.objective}</span></> : null}
                    </p>
                  </div>
                  {g.myStatus === "approved" ? (
                    <span className="shrink-0 text-[10px] font-medium text-emerald-400">
                      {t("survival-community-member", "Member ✓")}
                    </span>
                  ) : g.myStatus === "pending" ? (
                    <span className="shrink-0 text-[10px] font-medium text-amber-300">
                      {t("survival-community-requested", "Requested")}
                    </span>
                  ) : (
                    <button type="button" onClick={() => requestJoin(g)} disabled={joinBusy === g.id}
                      className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium disabled:opacity-50"
                      style={{ background: `${c.color}22`, color: c.color }}>
                      {t("survival-community-join", "Join")}
                    </button>
                  )}
                </div>
                <Link href={`/community/${g.slug ?? g.pageId}`}
                  className="mt-1.5 inline-block text-[11px] text-white/40 hover:text-white/70">
                  {t("survival-community-view", "View community")} →
                </Link>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-xs text-white/40">{t("survival-community-none", "No communities found yet.")}</p>
            )}
          </div>

          {/* Create a family group → straight to its initiative page */}
          <div className="mt-4 border-t border-white/5 pt-4">
            <p className="text-xs font-medium text-white/70">
              {t("survival-community-create", "Start a family group")}
            </p>
            <p className="mt-0.5 text-[11px] text-white/40">
              {t("survival-community-create-sub", "A community initiative for your household — plan food and essentials together.")}
            </p>
            <div className="mt-2 flex gap-2">
              <input
                value={famName}
                onChange={(e) => setFamName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createFamilyGroup(); }}
                placeholder={t("survival-community-create-ph", "e.g. Sharma family")}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
              />
              <button type="button" onClick={createFamilyGroup} disabled={creating || !famName.trim()}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: c.color, color: "#0b0b10" }}>
                {creating ? "…" : t("survival-community-create-btn", "Create")}
              </button>
            </div>
            {createError && <p className="mt-1.5 text-[11px] text-red-400">{createError}</p>}
          </div>
        </section>
      </div>

      {editOpen && (
        <EditHealthModal health={health} onSave={handleHealthSave} onClose={() => setEditOpen(false)} />
      )}
    </main>
  );
}
