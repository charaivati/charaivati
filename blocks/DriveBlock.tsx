"use client";
// blocks/DriveBlock.tsx — drive picker (State A typewriter + State B compact identity)

import React, { useEffect, useRef, useState } from "react";
import { SectionCard } from "@/components/self/shared";
import { DRIVES, DRIVE_IDENTITY } from "@/hooks/useSelfState";
import { safeFetchJson } from "@/hooks/useAIBlock";
import type { DriveType } from "@/types/self";
import { ArrowRight, ChevronLeft } from "lucide-react";

const DRIVE_PILL: Record<DriveType, string> = {
  learning: "text-sky-400 border-sky-500/40 bg-sky-500/10",
  helping:  "text-rose-400 border-rose-500/40 bg-rose-500/10",
  building: "text-indigo-400 border-indigo-500/40 bg-indigo-500/10",
  doing:    "text-amber-400 border-amber-500/40 bg-amber-500/10",
};

function DriveGrid({
  drives,
  onToggle,
  visible,
  animated,
}: {
  drives: DriveType[];
  onToggle: (d: DriveType) => void;
  visible: boolean;
  animated: boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {DRIVES.map((d, idx) => {
        const selected = drives.includes(d.id);
        const atLimit  = !selected && drives.length >= 2;
        return (
          <button key={d.id} type="button" onClick={() => onToggle(d.id)} disabled={atLimit}
            className={`rounded-xl border px-4 py-4 text-left transition-all ${
              selected ? "border-indigo-500 bg-indigo-500/10"
                : atLimit ? "border-gray-800 bg-gray-950/20 opacity-40 cursor-not-allowed"
                : "border-gray-800 bg-gray-950/40 hover:border-gray-600"
            }${animated ? " drive-card" : ""}`}
            style={animated ? {
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(8px)",
              transitionDelay: `${idx * 120}ms`,
            } : undefined}>
            <div className={`text-sm font-semibold mb-1 ${selected ? "text-indigo-300" : "text-white"}`}>
              {selected && <span className="mr-1.5 text-indigo-400">✓</span>}{d.label}
            </div>
            <div className="text-xs text-gray-500">{d.description}</div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Onboarding Banner (replaces State A when no drives) ─────────────────────

type OBMode     = "focused" | "zoomed";
type OBCategory = "learn" | "build" | "execute" | "connect";
type OBStep     = "category" | "question";

const OB_CATS: { id: OBCategory; label: string; icon: string; driveId: DriveType; desc: string; zoomedLabel: string; zoomedDesc: string }[] = [
  { id: "learn",   label: "Learn",   icon: "📖", driveId: "learning", desc: "Something to understand or master",   zoomedLabel: "Exploring Wisdom",  zoomedDesc: "Research, mastery, and intellectual depth"     },
  { id: "build",   label: "Build",   icon: "🔨", driveId: "building", desc: "A product, project, or system",       zoomedLabel: "Building Legacy",   zoomedDesc: "Creating structures that outlast you"          },
  { id: "execute", label: "Execute", icon: "⚡", driveId: "doing",    desc: "A habit or practice to stay on",      zoomedLabel: "Executing Deeply",  zoomedDesc: "Consistency, discipline, a life well-run"       },
  { id: "connect", label: "Connect", icon: "🤝", driveId: "helping",  desc: "A cause or group to support",         zoomedLabel: "Serving a Cause",   zoomedDesc: "A movement, a mission, a people to stand for"  },
];

const OB_COLORS: Record<OBCategory, { ring: string; bg: string }> = {
  learn:   { ring: "ring-sky-500/50",     bg: "bg-sky-500/10"     },
  build:   { ring: "ring-indigo-500/50",  bg: "bg-indigo-500/10"  },
  execute: { ring: "ring-amber-500/50",   bg: "bg-amber-500/10"   },
  connect: { ring: "ring-emerald-500/50", bg: "bg-emerald-500/10" },
};

const OB_QS_FOCUSED: Record<OBCategory, { prompt: string; qs: { q: string; ph: string }[] }> = {
  learn: {
    prompt: "What do you want to learn?",
    qs: [
      { q: "What specifically do you want to learn?",            ph: "e.g. Machine learning, guitar, public speaking…"    },
      { q: "Why now — what triggered this?",                     ph: "e.g. A new job, a conversation, long curiosity…"    },
      { q: "How much time can you give this per week?",          ph: "e.g. 1 hour daily, weekends only…"                  },
      { q: "How will you know you've learned it?",               ph: "e.g. Build something, pass a test, teach someone…"  },
    ],
  },
  build: {
    prompt: "What do you want to build?",
    qs: [
      { q: "What are you building?",                             ph: "e.g. A SaaS product, a community, a restaurant…"   },
      { q: "Who is it for?",                                     ph: "e.g. Small business owners, students, my city…"    },
      { q: "What's your first concrete step?",                   ph: "e.g. Write a spec, talk to 10 users, build MVP…"   },
      { q: "When do you want something to show for it?",         ph: "e.g. 3 months, end of year, no deadline yet…"      },
    ],
  },
  execute: {
    prompt: "What do you want to get done consistently?",
    qs: [
      { q: "What are you trying to execute on?",                 ph: "e.g. Exercise 4x/week, write daily, ship Fridays…" },
      { q: "What's been stopping you so far?",                   ph: "e.g. No structure, procrastination, burnout…"      },
      { q: "How often do you need to show up for this?",         ph: "e.g. Daily, 3x a week, every morning…"             },
      { q: "What does 'done well' look like for you?",           ph: "e.g. 30-day streak, a shipped product…"            },
    ],
  },
  connect: {
    prompt: "Who or what do you want to support?",
    qs: [
      { q: "What cause, person, or group are you showing up for?", ph: "e.g. My family, climate change, local youth…"   },
      { q: "What does your support look like practically?",         ph: "e.g. Volunteering, funding, advocacy…"          },
      { q: "How much time or resource can you commit?",             ph: "e.g. 2 hours/week, ₹5k/month…"                 },
      { q: "What would meaningful progress look like?",             ph: "e.g. 50 people helped, a project launched…"    },
    ],
  },
};

const OB_QS_ZOOMED: Record<OBCategory, { prompt: string; qs: { q: string; ph: string }[] }> = {
  learn: {
    prompt: "What domain are you trying to master?",
    qs: [
      { q: "What is the core question or problem driving your learning?",         ph: "The deeper reason, not just the topic…"               },
      { q: "What already exists — who are the key thinkers or resources?",        ph: "Books, institutions, people you know of…"             },
      { q: "What's missing that you want to address?",                            ph: "The gap you sense, even if you can't fully name it…"  },
      { q: "What level of mastery are you aiming for?",                           ph: "Practitioner, expert, or original contributor?"       },
      { q: "What does a 1-year and 3-year milestone look like?",                  ph: "What can you do, create, or show?"                    },
      { q: "How much time per week can you protect — non-negotiably?",            ph: "e.g. 10 hours/week, every morning 6–8am…"             },
      { q: "What is the output — skill, body of work, credential, publication?",  ph: "What you want to have made or become…"                },
    ],
  },
  build: {
    prompt: "What are you building and why does it need to exist?",
    qs: [
      { q: "What problem are you solving? Who suffers from it today?",            ph: "Name the pain and the people who feel it…"            },
      { q: "Who else is working on this — competitors, potential allies?",        ph: "What's out there? What's missing?"                    },
      { q: "What is your specific angle — why you, why this approach?",           ph: "Your unfair advantage or unique insight…"             },
      { q: "What does the structure look like — venture, verticals, movement?",   ph: "Single thing or portfolio of bets?"                   },
      { q: "What are your success parameters at 6 months, 2 years, 5 years?",    ph: "Revenue, users, impact — be concrete…"                },
      { q: "What is your current resource base — time, capital, team?",           ph: "Hours/week, funding, co-founders, network…"           },
      { q: "What is the first version that proves the idea works?",               ph: "The smallest thing that validates everything…"        },
    ],
  },
  execute: {
    prompt: "What does a well-functioning life look like for you?",
    qs: [
      { q: "What does financial stability mean for you — number, lifestyle?",     ph: "e.g. ₹2L/month, no debt, own a home…"                },
      { q: "What is your current income structure and what needs to change?",     ph: "Job, freelance, business — what's working?"           },
      { q: "What do you want freedom for?",                                       ph: "What would you do with more time and security?"       },
      { q: "What are the 2–3 things you must execute consistently?",              ph: "Your non-negotiables to keep everything moving…"      },
      { q: "What has historically derailed your consistency?",                    ph: "Your known failure modes, honestly…"                  },
      { q: "What does a good week look like, concretely?",                        ph: "Day by day — what happened?"                          },
      { q: "When do you want this stability locked in by?",                       ph: "A date or milestone, not a feeling…"                  },
    ],
  },
  connect: {
    prompt: "What change are you trying to create in the world?",
    qs: [
      { q: "What is the problem or injustice you're responding to?",              ph: "What makes you angry or sad enough to act?"           },
      { q: "Who is already working on this — are they sufficient?",               ph: "What exists? What's missing from their efforts?"      },
      { q: "What is your specific contribution?",                                 ph: "Organizing, funding, advocacy, infrastructure?"       },
      { q: "Who are you trying to reach or mobilize?",                            ph: "Voters, youth, local community, policymakers?"        },
      { q: "What does meaningful scale look like?",                               ph: "Local, national, or systemic change?"                 },
      { q: "What resources do you have and need?",                                ph: "Time, money, people — be honest about gaps…"          },
      { q: "What is a 1-year sign that the movement is real and growing?",        ph: "A concrete indicator you're making progress…"        },
    ],
  },
};

const DRIVE_TO_CAT: Record<DriveType, OBCategory> = {
  learning: "learn",
  building: "build",
  doing:    "execute",
  helping:  "connect",
};

export function OnboardingBanner({
  isGuest, saveState, onComplete, onDone, onCancel, initialDrives, drivesWithGoals,
}: {
  isGuest: boolean;
  saveState: string;
  onComplete: (driveId: DriveType, statement: string, description: string) => void;
  onDone?: (finalDrives: DriveType[]) => void;
  onCancel?: () => void;
  initialDrives?: DriveType[];
  drivesWithGoals?: DriveType[];
}) {
  const [mode,    setMode]    = useState<OBMode>("focused");
  const [cats,           setCats]           = useState<OBCategory[]>(
    () => (initialDrives ?? []).map(d => DRIVE_TO_CAT[d])
  );
  // activeCats: subset that actually need questions (newly added drives only)
  const [activeCats,       setActiveCats]       = useState<OBCategory[]>([]);
  const [currentCatIndex, setCurrentCatIndex] = useState(0);
  const [step,    setStep]    = useState<OBStep>("category");
  const [qIdx,    setQIdx]    = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [dir,     setDir]     = useState<1 | -1>(1);
  const [visible, setVisible] = useState(true);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const [aiHelp,        setAiHelp]        = useState<string[] | null>(null);
  const [aiHelpLoading, setAiHelpLoading] = useState(false);
  const [aiHelpError,   setAiHelpError]   = useState(false);

  // Question flow operates on activeCats, not cats
  const cat = activeCats[currentCatIndex] ?? null;

  const qs   = cat ? (mode === "focused" ? OB_QS_FOCUSED[cat] : OB_QS_ZOOMED[cat]) : null;
  const total = qs?.qs.length ?? 0;

  useEffect(() => {
    if (step === "question") setTimeout(() => textRef.current?.focus(), 280);
  }, [step, qIdx]);

  function slide(direction: 1 | -1, cb: () => void) {
    setDir(direction);
    setVisible(false);
    setAiHelp(null);
    setAiHelpError(false);
    setTimeout(() => { cb(); setVisible(true); }, 200);
  }

  async function fetchAiHelp() {
    if (!cat) return;
    const LIMIT_KEY = "charaivati_ob_ai_count";
    try {
      const raw = localStorage.getItem(LIMIT_KEY);
      const { count = 0, resetAt = 0 } = raw ? JSON.parse(raw) : {};
      const now = Date.now();
      const newCount   = now > resetAt ? 1 : count + 1;
      const newResetAt = now > resetAt ? now + 60 * 60 * 1000 : resetAt;
      if (newCount > 3 && isGuest) {
        setAiHelpError(true);
        return;
      }
      localStorage.setItem(LIMIT_KEY, JSON.stringify({ count: newCount, resetAt: newResetAt }));
    } catch {}

    setAiHelpLoading(true);
    setAiHelp(null);
    setAiHelpError(false);

    function sanitize(s: string) {
      return s.replace(/<[^>]*>/g, "").slice(0, 500).trim();
    }

    if (!cat) { setAiHelpLoading(false); return; }
    const qSet = mode === "focused" ? OB_QS_FOCUSED[cat] : OB_QS_ZOOMED[cat];
    const answersPayload: Record<string, string> = {};
    qSet.qs.forEach((_: { q: string; ph: string }, i: number) => {
      if (answers[i]) answersPayload[`q${i + 1}`] = sanitize(answers[i]);
    });
    if (current.trim()) answersPayload[`q${qIdx + 1}`] = sanitize(current.trim());

    try {
      const resp = await safeFetchJson("/api/self/onboarding-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat, mode, answers: answersPayload }),
      });
      if (!resp.ok || !resp.json?.suggestions) { setAiHelpError(true); return; }
      setAiHelp(resp.json.suggestions as string[]);
    } catch {
      setAiHelpError(true);
    } finally {
      setAiHelpLoading(false);
    }
  }

  function toggleCat(id: OBCategory) {
    setCats(prev => {
      if (prev.includes(id)) return prev.filter(c => c !== id);
      if (prev.length < 2) return [...prev, id];
      return [prev[1], id]; // replace first with second, add new
    });
  }

  function startQuestions() {
    if (cats.length === 0) return;
    const finalDrives = cats.map(c => OB_CATS.find(o => o.id === c)!.driveId);
    // Cats that have no existing goals — these need questions
    const newCats = cats.filter(c => {
      const driveId = OB_CATS.find(o => o.id === c)!.driveId;
      return !(drivesWithGoals ?? []).includes(driveId);
    });
    if (newCats.length === 0) {
      // All selected drives already have goals — just save and close
      onDone?.(finalDrives);
      return;
    }
    setActiveCats(newCats);
    setCurrentCatIndex(0);
    slide(1, () => { setStep("question"); setQIdx(0); setAnswers([]); setCurrent(""); });
  }

  function next() {
    const trimmed = current.trim();
    const nextAnswers = [...answers]; nextAnswers[qIdx] = trimmed;
    if (qIdx + 1 < total) {
      slide(1, () => { setAnswers(nextAnswers); setQIdx(qIdx + 1); setCurrent(nextAnswers[qIdx + 1] ?? ""); });
    } else {
      // Finish current cat
      const catDef = OB_CATS.find(c => c.id === cat)!;
      const stmt   = nextAnswers[0] ?? "";
      const desc   = nextAnswers.slice(1).filter(Boolean).join(" · ");
      onComplete(catDef.driveId, stmt, desc);

      if (activeCats.length === 2 && currentCatIndex === 0) {
        // Advance to second active cat
        slide(1, () => {
          setCurrentCatIndex(1);
          setQIdx(0);
          setAnswers([]);
          setCurrent("");
        });
      } else {
        // All active cats done — pass the full selected drive set
        const finalDrives = cats.map(c => OB_CATS.find(o => o.id === c)!.driveId);
        onDone?.(finalDrives);
      }
    }
  }

  function back() {
    if (qIdx === 0 && currentCatIndex === 0) {
      slide(-1, () => { setStep("category"); setCurrent(""); });
    } else if (qIdx === 0 && currentCatIndex > 0) {
      slide(-1, () => { setCurrentCatIndex(0); setQIdx(0); setAnswers([]); setCurrent(""); });
    } else {
      slide(-1, () => { setQIdx(qIdx - 1); setCurrent(answers[qIdx - 1] ?? ""); });
    }
  }

  const tx = visible
    ? "translate-x-0 opacity-100"
    : dir === 1 ? "-translate-x-6 opacity-0" : "translate-x-6 opacity-0";

  // ── Category screen ────────────────────────────────────────────
  if (step === "category") {
    return (
      <SectionCard>
        <style>{`
          @keyframes ob-fade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
          .ob-in { animation: ob-fade 280ms ease both; }
          @keyframes ob-heading-in { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
          @keyframes ob-heading-line1 { from{opacity:0} to{opacity:1} }
          .ob-line1 { animation: ob-heading-line1 300ms ease both; animation-delay: 100ms; }
          .ob-line2 { animation: ob-heading-in 400ms ease both; animation-delay: 280ms; }
          .ob-philosophy { animation: ob-fade 400ms ease both; animation-delay: 600ms; }
        `}</style>
        <div className="px-5 pt-5 pb-5">

          {/* Mode toggle + optional cancel below */}
          <div className="flex flex-col items-end mb-5 gap-1.5">
            <div className="flex rounded-full border border-gray-800 bg-gray-900 p-0.5 text-xs">
              {(["focused","zoomed"] as OBMode[]).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-full transition-colors ${mode === m ? "bg-white text-gray-950 font-medium" : "text-gray-400 hover:text-gray-200"}`}>
                  {m === "focused" ? "Focused" : "Zoomed out"}
                </button>
              ))}
            </div>
            {onCancel && (
              <button type="button" onClick={onCancel}
                className="text-xs text-gray-600 hover:text-gray-300 transition-colors">
                ✕ Cancel
              </button>
            )}
          </div>

          {/* Animated heading */}
          <div className="mb-5" key={mode}>
            <p className="text-sm text-gray-500 ob-line1">
              {mode === "focused" ? "Right now," : "For the long run,"}
            </p>
            <p className={`text-2xl sm:text-3xl font-bold text-white ob-line2 relative inline-block after:content-[''] after:block after:h-0.5 after:w-full after:mt-1 after:rounded-full ${mode === "focused" ? "after:bg-gradient-to-r after:from-indigo-500 after:via-sky-400 after:to-transparent" : "after:bg-gradient-to-r after:from-violet-500 after:via-purple-400 after:to-transparent"}`}>
              {mode === "focused" ? "What do you want to focus on?" : "What do you want your life to stand for?"}
            </p>
          </div>

          {/* Subtext */}
          <p className="text-xs text-gray-600 mb-4">
            Select up to 2. You can change these anytime.
          </p>

          {/* Category grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {OB_CATS.map(c => {
              const col      = OB_COLORS[c.id];
              const selIdx   = cats.indexOf(c.id);
              const selected = selIdx !== -1;
              const displayLabel = mode === "zoomed" ? c.zoomedLabel : c.label;
              const displayDesc  = mode === "zoomed" ? c.zoomedDesc  : c.desc;
              return (
                <button key={c.id} type="button" onClick={() => toggleCat(c.id)}
                  className={`relative flex flex-col items-start p-4 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    selected
                      ? `border-gray-600 ring-2 ${col.ring} ${col.bg}`
                      : "border-gray-800 bg-gray-950/40 hover:border-gray-600"
                  }`}>
                  {selected && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/90 text-gray-900 text-xs font-bold flex items-center justify-center">
                      {selIdx + 1}
                    </span>
                  )}
                  <span className="text-xl mb-2">{c.icon}</span>
                  <span className={`font-semibold text-sm ${selected ? "text-white" : "text-white"}`}>{displayLabel}</span>
                  <span className="text-gray-500 text-xs mt-0.5 leading-relaxed">{displayDesc}</span>
                </button>
              );
            })}
          </div>

          {/* CTA button */}
          {cats.length > 0 && (() => {
            const newCats = cats.filter(c => {
              const driveId = OB_CATS.find(o => o.id === c)!.driveId;
              return !(drivesWithGoals ?? []).includes(driveId);
            });
            const allExisting = newCats.length === 0;
            const label = allExisting
              ? "Save →"
              : newCats.length === 1
                ? "Add a goal →"
                : "Start with these two →";
            return (
              <div className="mt-4">
                <button type="button" onClick={() => startQuestions()}
                  className="px-5 py-2.5 rounded-lg bg-white text-gray-950 text-sm font-semibold hover:bg-gray-100 transition-colors">
                  {label}
                </button>
              </div>
            );
          })()}

          {/* Philosophy paragraph */}
          <div className="mt-6 pt-5 border-t border-gray-800/60 ob-philosophy">
            <p className="text-sm text-gray-300 font-medium leading-relaxed">
              Love, peace, and freedom come from a life aligned with your inner calling.
            </p>
            <p className="text-xs text-gray-600 italic mt-1.5 leading-relaxed">
              The world finds order when nations do. Nations, when societies do. Societies, when individuals do. That individual — could be you.
            </p>
          </div>

          {/* Guest / save state */}
          <div className="mt-3 flex items-center justify-between">
            {isGuest ? (
              <p className="text-xs text-yellow-600/80">
                Guest mode — <a href="/login" className="underline hover:text-yellow-400">Sign in</a> to sync.
              </p>
            ) : <span />}
            <span className={`text-xs transition-opacity ${saveState === "idle" ? "opacity-0" : saveState === "saving" ? "text-gray-500" : saveState === "saved" ? "text-green-500" : "text-red-400"}`}>
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Error" : "·"}
            </span>
          </div>
        </div>
      </SectionCard>
    );
  }

  // ── Question screen ────────────────────────────────────────────
  if (step === "question" && cat && qs) {
    const q      = qs.qs[qIdx];
    const catDef = OB_CATS.find(c => c.id === cat)!;
    const col    = OB_COLORS[cat];
    const isLast = qIdx === total - 1;

    return (
      <SectionCard>
        <div className="px-5 pt-4 pb-5">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={back}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              {activeCats.length === 2 ? (
                <>
                  <span className={`px-2 py-0.5 rounded-full border ${currentCatIndex === 0 ? "border-gray-600 bg-gray-800 text-gray-200" : "border-gray-800 bg-gray-900 text-gray-600"}`}>
                    {activeCats[0] ? OB_CATS.find(c => c.id === activeCats[0])?.icon : ""} {activeCats[0] ? OB_CATS.find(c => c.id === activeCats[0])?.label : ""}
                  </span>
                  <span className="text-gray-700">+</span>
                  <span className={`px-2 py-0.5 rounded-full border ${currentCatIndex === 1 ? "border-gray-600 bg-gray-800 text-gray-200" : "border-gray-800 bg-gray-900 text-gray-600"}`}>
                    {activeCats[1] ? OB_CATS.find(c => c.id === activeCats[1])?.icon : ""} {activeCats[1] ? OB_CATS.find(c => c.id === activeCats[1])?.label : ""}
                  </span>
                </>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full border border-gray-800 bg-gray-900">
                  {catDef.icon} {catDef.label}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">{qIdx + 1} / {total}</span>
              {onCancel && (
                <button type="button" onClick={onCancel}
                  className="text-xs text-gray-600 hover:text-gray-300 transition-colors px-1.5 py-0.5 rounded hover:bg-gray-800">
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="h-0.5 bg-gray-800 rounded-full mb-5 overflow-hidden">
            {activeCats.length === 2 ? (
              <div className={`h-full rounded-full transition-all duration-500 ${col.bg.replace("bg-", "bg-").replace("/10", "/60")}`}
                style={{ width: `${(currentCatIndex * 50) + ((qIdx + 1) / total) * 50}%` }} />
            ) : (
              <div className={`h-full rounded-full transition-all duration-500 ${col.bg.replace("bg-", "bg-").replace("/10", "/60")}`}
                style={{ width: `${((qIdx + 1) / total) * 100}%` }} />
            )}
          </div>

          {/* Question + input */}
          <div className={`transition-all duration-200 ease-out ${tx}`}>
            {qIdx === 0 && (
              <p className="text-xs text-gray-500 italic mb-2">{qs.prompt}</p>
            )}
            <p className="text-base font-semibold text-white mb-4 leading-snug">{q.q}</p>

            <textarea ref={textRef} value={current} rows={3}
              onChange={e => setCurrent(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); next(); } }}
              placeholder={q.ph}
              className="w-full bg-gray-900 border border-gray-800 focus:border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none resize-none transition-colors text-sm leading-relaxed" />
            <p className="text-xs text-gray-700 mt-1.5">Enter to continue · Shift+Enter for new line</p>
          </div>

          {/* AI Help */}
          <div className="mt-4">
            <button
              type="button"
              onClick={fetchAiHelp}
              disabled={aiHelpLoading}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-400 disabled:opacity-40 transition-colors"
            >
              {aiHelpLoading ? (
                <>
                  <span className="inline-block w-3 h-3 border border-gray-500 border-t-indigo-400 rounded-full animate-spin" />
                  Thinking…
                </>
              ) : aiHelp ? (
                <>✦ Refine with AI</>
              ) : (
                <>✦ Ask AI</>
              )}
            </button>
            {aiHelpError && isGuest && (
              <p className="mt-2 text-xs text-yellow-600/80">
                <a href="/login" className="underline hover:text-yellow-400">Sign in</a> to continue using AI help.
              </p>
            )}
            {aiHelpError && !isGuest && (
              <p className="mt-2 text-xs text-gray-600">AI unavailable — try again.</p>
            )}
            {aiHelp && aiHelp.length > 0 && (
              <div className="mt-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 space-y-1.5">
                {aiHelp.map((s, i) => (
                  <p key={i} className="text-xs text-indigo-300/90 leading-relaxed">{s}</p>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 mt-4">
            <button type="button" onClick={next} disabled={!current.trim() && qIdx === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-gray-950 text-sm font-semibold disabled:opacity-30 hover:bg-gray-100 transition-colors">
              {isLast ? "Done" : "Next"} <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {(!current.trim() && qIdx > 0) && (
              <button type="button" onClick={next} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                Skip
              </button>
            )}
          </div>
        </div>
      </SectionCard>
    );
  }

  return null;
}

// ─── State A: typewriter greeting + full drive grid ───────────────────────────

export function DrivePickerStateA({
  typedLine1, typedLine2, line2Started, typingDone, drivesVisible,
  drives, isGuest, saveState, onToggle,
}: {
  typedLine1: string; typedLine2: string; line2Started: boolean;
  typingDone: boolean; drivesVisible: boolean;
  drives: DriveType[]; isGuest: boolean; saveState: string;
  onToggle: (d: DriveType) => void;
}) {
  return (
    <SectionCard>
      <style>{`
        @keyframes tw-blink{0%,100%{opacity:1}50%{opacity:0}}
        .tw-cursor{animation:tw-blink 0.8s step-start infinite;color:#818cf8}
        @keyframes tw-cursor-fade{to{opacity:0}}
        .tw-cursor-done{animation:tw-cursor-fade 0.4s ease 0.4s forwards;color:#818cf8}
        .drive-card{transition:opacity 300ms ease-out,transform 300ms ease-out}
      `}</style>
      <div className="px-6 pt-8 pb-4 flex items-start justify-between">
        <div className="flex-1 min-h-[6rem]">
          <p className="text-base text-gray-400 tracking-wide">
            {typedLine1}
            {typedLine1 && !line2Started && (
              <span className={typingDone ? "tw-cursor-done" : "tw-cursor"}>|</span>
            )}
          </p>
          {line2Started && (
            <h2 className="text-3xl font-bold text-white mt-2 leading-snug">
              {typedLine2}
              <span className={typingDone ? "tw-cursor-done" : "tw-cursor"}>|</span>
            </h2>
          )}
          {isGuest && (
            <p className="text-sm text-yellow-600 mt-2">
              Guest mode — saved locally for 7 days.{" "}
              <a href="/login" className="underline hover:text-yellow-400">Sign in</a> to sync.
            </p>
          )}
        </div>
        <span className={`text-xs mt-1 transition-opacity ${
          saveState === "idle"   ? "opacity-0"                  :
          saveState === "saving" ? "opacity-100 text-gray-500"  :
          saveState === "saved"  ? "opacity-100 text-green-500" :
                                   "opacity-100 text-red-400"
        }`}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "·"}
        </span>
      </div>
      <div className="px-6 pb-7">
        <DriveGrid drives={drives} onToggle={onToggle} visible={drivesVisible} animated />
      </div>
    </SectionCard>
  );
}

// ─── State B: compact identity + optional inline picker ───────────────────────

const DRIVE_LINE_COLOR: Record<DriveType, string> = {
  learning: "text-sky-300",
  helping:  "text-rose-300",
  building: "text-indigo-300",
  doing:    "text-amber-300",
};

const LINE1 = "Keep moving";
const LINE2 = "चरैवेति चरैवेति";

export function DrivePickerStateB({
  drives, isGuest, saveState, pickerOpen, onToggle, onOpenPicker, mode, onModeChange,
}: {
  drives: DriveType[]; isGuest: boolean; saveState: string;
  pickerOpen: boolean;
  onToggle: (d: DriveType) => void;
  onOpenPicker: () => void;
  mode: "focused" | "zoomed";
  onModeChange: (m: "focused" | "zoomed") => void;
}) {
  const [km, setKm] = useState("");
  const [ch, setCh] = useState("");
  const [activeLine, setActiveLine] = useState<1 | 2 | null>(null);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

    async function loop() {
      while (!cancelled) {
        // type line 1
        setActiveLine(1);
        for (let i = 1; i <= LINE1.length; i++) {
          if (cancelled) return;
          setKm(LINE1.slice(0, i));
          await wait(90);
        }
        await wait(500);
        // type line 2
        setActiveLine(2);
        for (let i = 1; i <= LINE2.length; i++) {
          if (cancelled) return;
          setCh(LINE2.slice(0, i));
          await wait(75);
        }
        setActiveLine(null);
        await wait(2800);
        // reset
        setKm(""); setCh("");
        await wait(350);
      }
    }

    loop();
    return () => { cancelled = true; };
  }, []);

  return (
    <SectionCard className="px-5 py-2.5 sm:py-4">
      <style>{`
        @keyframes drive-glow {
          0%, 100% { filter: brightness(1); }
          50%       { filter: brightness(1.4) drop-shadow(0 0 8px currentColor); }
        }
        @keyframes tw-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .drive-line-1 { animation: drive-glow 3.2s ease-in-out infinite; }
        .drive-line-2 { animation: drive-glow 3.2s ease-in-out infinite 1.6s; }
        .tw-cursor-b  { animation: tw-blink 0.75s step-start infinite; }
      `}</style>

      {/* Content row — minHeight on the ROW forces all children to stretch to it */}
      <div
        className="flex flex-row items-stretch gap-3 sm:gap-4"
        style={{ minHeight: drives.length === 2 ? "4.2rem" : "3.6rem" }}
      >

        {/* Drives */}
        <div
          className="flex-1 min-w-0 space-y-0.5 overflow-hidden flex flex-col justify-center"
        >
          {drives.map((driveId, index) => (
            <p
              key={driveId}
              className={`font-bold leading-tight truncate ${DRIVE_LINE_COLOR[driveId]} ${index === 0 ? "drive-line-1" : "drive-line-2"}`}
              style={{ fontSize: "clamp(1rem, 4vw, 1.6rem)" }}
            >
              {index === 0
                ? `You are ${DRIVE_IDENTITY[driveId]}.`
                : `And ${DRIVE_IDENTITY[driveId]}.`}
            </p>
          ))}
        </div>

        {/* ── MOBILE right block: pencil · divider · compact tagline ── */}
        <div className="sm:hidden flex items-stretch gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenPicker}
            title={pickerOpen ? "Close editor" : "Edit drives"}
            className={`self-center p-1.5 rounded-md transition-colors shrink-0 ${
              pickerOpen ? "text-indigo-400 bg-indigo-500/10" : "text-gray-700 hover:text-indigo-400 hover:bg-gray-800"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.982 9.543A1.75 1.75 0 0 0 3.5 10.78v1.47c0 .414.336.75.75.75h1.47a1.75 1.75 0 0 0 1.237-.513l7.031-7.03a1.75 1.75 0 0 0 0-2.475ZM11.719 3.22a.25.25 0 0 1 .354 0l.707.707a.25.25 0 0 1 0 .354L11.5 5.56l-1.06-1.061 1.279-1.28ZM9.38 5.56l1.06 1.06-5.323 5.323a.25.25 0 0 1-.177.073H4v-.94a.25.25 0 0 1 .073-.177L9.38 5.56Z" />
            </svg>
          </button>
          <div className="w-[3px] rounded-full bg-gradient-to-b from-transparent via-gray-500/50 to-transparent shrink-0" />
          <div style={{ width: "62px", minWidth: "62px", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end" }}>
            <div style={{ height: "1.1rem", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <span className="text-gray-300 font-medium" style={{ fontSize: "0.5rem", lineHeight: 1 }}>
                {km}{activeLine === 1 && <span className="tw-cursor-b text-gray-400">|</span>}
              </span>
            </div>
            <div style={{ height: "0.9rem", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              <span className="text-gray-500" style={{ fontSize: "0.42rem", lineHeight: 1 }}>
                {ch}{activeLine === 2 && <span className="tw-cursor-b text-gray-600">|</span>}
              </span>
            </div>
          </div>
        </div>

        {/* ── DESKTOP right block: fixed at 30% width → divider always sits at 70% ── */}
        <div className="hidden sm:flex items-stretch gap-3 flex-none w-[30%]">
          <button
            type="button"
            onClick={onOpenPicker}
            title={pickerOpen ? "Close editor" : "Edit drives"}
            className={`self-center p-1.5 rounded-md transition-colors shrink-0 ${
              pickerOpen ? "text-indigo-400 bg-indigo-500/10" : "text-gray-700 hover:text-indigo-400 hover:bg-gray-800"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.982 9.543A1.75 1.75 0 0 0 3.5 10.78v1.47c0 .414.336.75.75.75h1.47a1.75 1.75 0 0 0 1.237-.513l7.031-7.03a1.75 1.75 0 0 0 0-2.475ZM11.719 3.22a.25.25 0 0 1 .354 0l.707.707a.25.25 0 0 1 0 .354L11.5 5.56l-1.06-1.061 1.279-1.28ZM9.38 5.56l1.06 1.06-5.323 5.323a.25.25 0 0 1-.177.073H4v-.94a.25.25 0 0 1 .073-.177L9.38 5.56Z" />
            </svg>
          </button>
          <div className="self-stretch w-[3px] rounded-full bg-gradient-to-b from-transparent via-gray-500/25 to-transparent shrink-0" />
          <div className="flex-1 min-w-0" style={{ textAlign: "right", overflow: "hidden" }}>
            <p style={{ fontSize: "clamp(0.9rem, 2.8vw, 1.12rem)", lineHeight: "1.9rem", height: "1.9rem", overflow: "hidden", whiteSpace: "nowrap", color: "rgb(209 213 219)", fontWeight: 500 }}>
              {km}{activeLine === 1 && <span className="tw-cursor-b" style={{ color: "rgb(156 163 175)" }}>|</span>}
            </p>
            <p style={{ fontSize: "clamp(0.75rem, 2.4vw, 0.95rem)", lineHeight: "1.6rem", height: "1.6rem", overflow: "hidden", whiteSpace: "nowrap", color: "rgb(107 114 128)" }}>
              {ch}{activeLine === 2 && <span className="tw-cursor-b" style={{ color: "rgb(75 85 99)" }}>|</span>}
            </p>
          </div>
        </div>

      </div>{/* end content row */}

      {/* Save state + guest notice */}
      {isGuest && (
        <p className="mt-1 text-xs text-yellow-600/80">
          Guest mode —{" "}
          <a href="/login" className="underline hover:text-yellow-400">Sign in</a> to sync.
        </p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {(["focused", "zoomed"] as const).map(m => (
            <button key={m} type="button" onClick={() => onModeChange(m)}
              className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                mode === m
                  ? "bg-white text-gray-950 border-white font-medium"
                  : "border-gray-800 text-gray-500 hover:text-gray-300"}`}>
              {m === "focused" ? "Focused" : "Zoomed Out"}
            </button>
          ))}
        </div>
        <span className={`text-xs transition-opacity ${
          saveState === "idle"   ? "opacity-0"                  :
          saveState === "saving" ? "opacity-100 text-gray-500"  :
          saveState === "saved"  ? "opacity-100 text-green-500" :
                                   "opacity-100 text-red-400"
        }`}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "·"}
        </span>
      </div>

      {/* Inline drive picker (edit mode) */}
      {pickerOpen && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 mb-3">
            {drives.length < 2 ? "Add a second drive, or remove your current one." : "Remove a drive to swap it. Max 2."}
          </p>
          <DriveGrid drives={drives} onToggle={onToggle} visible animated={false} />
        </div>
      )}
    </SectionCard>
  );
}
