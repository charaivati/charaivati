// app/onboarding/page.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const ONBOARDING_KEY = "charaivati_onboarding_v1";
const GUEST_KEY      = "charaivati_guest_self";
const GUEST_TTL_MS   = 7 * 24 * 60 * 60 * 1000;

type Category = "learn" | "build" | "execute" | "connect";
type Mode      = "focused" | "zoomed";

const CATEGORIES = [
  { id: "learn"   as Category, label: "Learn",   icon: "📖", drive: "learning", description: "Something you want to understand or master" },
  { id: "build"   as Category, label: "Build",   icon: "🔨", drive: "building", description: "A product, project, or system to create"    },
  { id: "execute" as Category, label: "Execute", icon: "⚡", drive: "doing",    description: "A habit, practice, or routine to stay on"   },
  { id: "connect" as Category, label: "Connect", icon: "🤝", drive: "helping",  description: "A cause, person, or group to support"       },
] as const;

const CATEGORY_COLORS: Record<Category, { border: string; bg: string; active: string; dot: string }> = {
  learn:   { border: "border-sky-500/40",    bg: "bg-sky-500/5",     active: "border-sky-400 bg-sky-500/15",     dot: "bg-sky-400"    },
  build:   { border: "border-indigo-500/40", bg: "bg-indigo-500/5",  active: "border-indigo-400 bg-indigo-500/15", dot: "bg-indigo-400" },
  execute: { border: "border-amber-500/40",  bg: "bg-amber-500/5",   active: "border-amber-400 bg-amber-500/15",  dot: "bg-amber-400"  },
  connect: { border: "border-emerald-500/40",bg: "bg-emerald-500/5", active: "border-emerald-400 bg-emerald-500/15", dot: "bg-emerald-400" },
};

type QuestionSet = { entryPrompt: string; questions: { q: string; placeholder: string }[] };

const FOCUSED: Record<Category, QuestionSet> = {
  learn: {
    entryPrompt: "What do you want to learn?",
    questions: [
      { q: "What specifically do you want to learn?",                            placeholder: "e.g. Machine learning, guitar, public speaking…" },
      { q: "Why now — what triggered this?",                                     placeholder: "e.g. A new job, a conversation, long-time curiosity…" },
      { q: "How much time can you give this per week?",                          placeholder: "e.g. 1 hour daily, weekends only…" },
      { q: "How will you know you've learned it?",                               placeholder: "e.g. Build something, pass a test, teach someone…" },
    ],
  },
  build: {
    entryPrompt: "What do you want to build?",
    questions: [
      { q: "What are you building?",                                             placeholder: "e.g. A SaaS product, a community, a restaurant…" },
      { q: "Who is it for?",                                                     placeholder: "e.g. Small business owners, students, my city…" },
      { q: "What's your first concrete step?",                                   placeholder: "e.g. Write a spec, talk to 10 users, build an MVP…" },
      { q: "When do you want something to show for it?",                         placeholder: "e.g. 3 months, end of year, no deadline yet…" },
    ],
  },
  execute: {
    entryPrompt: "What do you want to get done consistently?",
    questions: [
      { q: "What are you trying to execute on?",                                 placeholder: "e.g. Exercise 4x/week, write daily, ship every Friday…" },
      { q: "What's been stopping you so far?",                                   placeholder: "e.g. Procrastination, no structure, too much on my plate…" },
      { q: "How often do you need to show up for this?",                         placeholder: "e.g. Daily, 3 times a week, every morning…" },
      { q: "What does 'done well' look like for you?",                           placeholder: "e.g. Consistent 30-day streak, a finished product…" },
    ],
  },
  connect: {
    entryPrompt: "Who or what do you want to support?",
    questions: [
      { q: "What cause, person, or group are you showing up for?",               placeholder: "e.g. My family, climate change, local youth…" },
      { q: "What does your support look like practically?",                      placeholder: "e.g. Volunteering, funding, advocacy, showing up…" },
      { q: "How much time or resource can you commit?",                          placeholder: "e.g. 2 hours/week, ₹5k/month, weekends…" },
      { q: "What would meaningful progress look like?",                          placeholder: "e.g. 50 people helped, a project launched…" },
    ],
  },
};

const ZOOMED: Record<Category, QuestionSet> = {
  learn: {
    entryPrompt: "What domain are you trying to master?",
    questions: [
      { q: "What is the core question or problem driving your learning?",        placeholder: "The deeper reason, not just the topic…" },
      { q: "What already exists in this field — who are the key thinkers?",      placeholder: "Books, institutions, people you know of…" },
      { q: "What's missing or wrong with current knowledge you want to fix?",    placeholder: "The gap you sense, even if you can't fully name it…" },
      { q: "What level of mastery are you aiming for?",                          placeholder: "Practitioner, expert, or original contributor?" },
      { q: "What does a 1-year and 3-year milestone look like?",                 placeholder: "Be specific — what can you do, create, or show?" },
      { q: "How much time per week can you protect for this — non-negotiably?",  placeholder: "e.g. 10 hours/week, every morning 6–8am…" },
      { q: "What is the output — skill, body of work, credential, publication?", placeholder: "What you want to have made or become…" },
    ],
  },
  build: {
    entryPrompt: "What are you building and why does it need to exist?",
    questions: [
      { q: "What problem are you solving? Who suffers from this today?",         placeholder: "Name the pain and the people who feel it…" },
      { q: "Who else is working on this — competitors, potential allies?",       placeholder: "What's out there? What's missing?" },
      { q: "What is your specific angle — why you, why this approach?",          placeholder: "Your unfair advantage or unique insight…" },
      { q: "What does the structure look like — venture, verticals, movement?",  placeholder: "Single thing or portfolio of bets?" },
      { q: "What are your success parameters at 6 months, 2 years, 5 years?",   placeholder: "Revenue, users, impact — be concrete…" },
      { q: "What is your current resource base — time, capital, team?",          placeholder: "Hours/week, funding, co-founders, network…" },
      { q: "What is the first version that proves the idea works?",              placeholder: "The smallest thing that validates everything…" },
    ],
  },
  execute: {
    entryPrompt: "What does a well-functioning life look like for you?",
    questions: [
      { q: "What does financial stability mean for you — a number, a lifestyle?", placeholder: "e.g. ₹2L/month, no debt, own a home…" },
      { q: "What is your current income structure and what needs to change?",    placeholder: "Job, freelance, business — what's working, what's not?" },
      { q: "What do you want freedom for — what would you do with more time?",   placeholder: "What would you do if money wasn't the reason you woke up?" },
      { q: "What are the 2–3 things you must execute consistently?",             placeholder: "Your non-negotiables to keep everything moving…" },
      { q: "What has historically derailed your consistency?",                   placeholder: "Your known failure modes, honestly…" },
      { q: "What does a good week look like, concretely?",                       placeholder: "Day by day, what happened?" },
      { q: "When do you want this stability locked in by?",                      placeholder: "A date or milestone, not a feeling…" },
    ],
  },
  connect: {
    entryPrompt: "What change are you trying to create in the world?",
    questions: [
      { q: "What is the problem or injustice you're responding to?",             placeholder: "What makes you angry or sad enough to act?" },
      { q: "Who is already working on this — allies, are they sufficient?",      placeholder: "What exists? What's missing from their efforts?" },
      { q: "What is your specific contribution?",                                placeholder: "Organizing, funding, advocacy, infrastructure?" },
      { q: "Who are you trying to reach or mobilize?",                           placeholder: "Voters, youth, local community, policymakers?" },
      { q: "What does meaningful scale look like — local, national, systemic?",  placeholder: "Your scope and ambition…" },
      { q: "What resources do you have and need — time, money, people?",         placeholder: "Be honest about gaps…" },
      { q: "What is a 1-year sign that the movement is real and growing?",       placeholder: "A concrete indicator you're making progress…" },
    ],
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type StepKind = "category" | "question" | "done";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

async function saveToProfile(drives: string[], goals: object[]) {
  try {
    await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ drives, goals }),
    });
  } catch {}
}

function saveToGuest(drives: string[], goals: object[]) {
  try {
    const existing = localStorage.getItem(GUEST_KEY);
    const prev = existing ? JSON.parse(existing).data ?? {} : {};
    localStorage.setItem(GUEST_KEY, JSON.stringify({
      data: { ...prev, drives, goals },
      ts: Date.now(),
    }));
  } catch {}
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  // If already done, fast-redirect
  useEffect(() => {
    try {
      if (localStorage.getItem(ONBOARDING_KEY)) {
        router.replace("/self");
      }
    } catch {}
  }, [router]);

  const [mode,     setMode]     = useState<Mode>("focused");
  const [category, setCategory] = useState<Category | null>(null);
  const [step,     setStep]     = useState<StepKind>("category");
  const [qIndex,   setQIndex]   = useState(0);
  const [answers,  setAnswers]  = useState<string[]>([]);
  const [current,  setCurrent]  = useState("");
  const [saving,   setSaving]   = useState(false);

  // slide direction: 1 = forward (right→left), -1 = backward (left→right)
  const [dir,     setDir]     = useState<1 | -1>(1);
  const [visible, setVisible] = useState(true);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const qs = category ? (mode === "focused" ? FOCUSED[category] : ZOOMED[category]) : null;
  const totalQ = qs?.questions.length ?? 0;

  // Focus input when question changes
  useEffect(() => {
    if (step === "question") {
      setTimeout(() => {
        inputRef.current?.focus();
        textareaRef.current?.focus();
      }, 350);
    }
  }, [step, qIndex]);

  function slide(direction: 1 | -1, cb: () => void) {
    setDir(direction);
    setVisible(false);
    setTimeout(() => {
      cb();
      setVisible(true);
    }, 220);
  }

  function pickCategory(cat: Category) {
    slide(1, () => {
      setCategory(cat);
      setStep("question");
      setQIndex(0);
      setAnswers([]);
      setCurrent("");
    });
  }

  function nextQuestion() {
    const trimmed = current.trim();
    const nextAnswers = [...answers];
    nextAnswers[qIndex] = trimmed;

    if (qIndex + 1 < totalQ) {
      slide(1, () => {
        setAnswers(nextAnswers);
        setQIndex(qIndex + 1);
        setCurrent(nextAnswers[qIndex + 1] ?? "");
      });
    } else {
      slide(1, () => {
        setAnswers(nextAnswers);
        setStep("done");
      });
    }
  }

  function prevQuestion() {
    if (qIndex === 0) {
      slide(-1, () => {
        setStep("category");
        setCurrent("");
      });
    } else {
      slide(-1, () => {
        setQIndex(qIndex - 1);
        setCurrent(answers[qIndex - 1] ?? "");
      });
    }
  }

  const finish = useCallback(async () => {
    if (!category || !qs) return;
    setSaving(true);

    const drive = CATEGORIES.find(c => c.id === category)!.drive;
    const goalId = uid();
    const goal = {
      id: goalId,
      driveId: drive,
      statement: answers[0] ?? "",
      description: answers.slice(1).filter(Boolean).join(" · "),
      skills: [{ id: uid(), name: "", level: "Beginner", monetize: false }],
      linkedBusinessIds: [],
      saved: true,
    };

    // Check if logged in
    try {
      const r = await fetch("/api/user/profile", { credentials: "include" });
      if (r.ok) {
        const d = await r.json().catch(() => null);
        if (d?.ok && d.profile) {
          await saveToProfile([drive], [goal]);
        } else {
          saveToGuest([drive], [goal]);
        }
      } else {
        saveToGuest([drive], [goal]);
      }
    } catch {
      saveToGuest([drive], [goal]);
    }

    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch {}
    setSaving(false);
    router.replace("/self");
  }, [category, qs, answers, router]);

  function skip() {
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch {}
    router.replace("/self");
  }

  // ── Slide classes ────────────────────────────────────────────────────────
  const slideClass = visible
    ? "translate-x-0 opacity-100"
    : dir === 1
      ? "-translate-x-8 opacity-0"
      : "translate-x-8 opacity-0";

  // ── Category screen ──────────────────────────────────────────────────────
  if (step === "category") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Skip */}
        <div className="flex justify-end p-5">
          <button onClick={skip} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Skip for now →
          </button>
        </div>

        <div className={`flex-1 flex flex-col items-center justify-center px-6 transition-all duration-200 ease-out ${slideClass}`}>
          <div className="w-full max-w-lg">
            {/* Mode toggle */}
            <div className="flex justify-center mb-10">
              <div className="flex rounded-full border border-gray-800 bg-gray-900 p-0.5 text-sm">
                <button
                  onClick={() => setMode("focused")}
                  className={`px-4 py-1.5 rounded-full transition-colors ${mode === "focused" ? "bg-white text-gray-950 font-medium" : "text-gray-400 hover:text-gray-200"}`}
                >
                  Focused
                </button>
                <button
                  onClick={() => setMode("zoomed")}
                  className={`px-4 py-1.5 rounded-full transition-colors ${mode === "zoomed" ? "bg-white text-gray-950 font-medium" : "text-gray-400 hover:text-gray-200"}`}
                >
                  Zoomed out
                </button>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-center mb-2">
              {mode === "focused" ? "What do you want to focus on right now?" : "What keeps you moving?"}
            </h1>
            <p className="text-gray-400 text-center mb-10 text-sm">
              {mode === "focused"
                ? "Pick your current priority. You can change anytime."
                : "This shapes your journey over time. Take your time with these."}
            </p>

            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map(cat => {
                const c = CATEGORY_COLORS[cat.id];
                return (
                  <button
                    key={cat.id}
                    onClick={() => pickCategory(cat.id)}
                    className={`flex flex-col items-start p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${c.border} ${c.bg} hover:${c.active}`}
                  >
                    <span className="text-2xl mb-3">{cat.icon}</span>
                    <span className="text-white font-semibold text-base">{cat.label}</span>
                    <span className="text-gray-400 text-xs mt-1 leading-relaxed">{cat.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Question screen ──────────────────────────────────────────────────────
  if (step === "question" && category && qs) {
    const q       = qs.questions[qIndex];
    const cat     = CATEGORIES.find(c => c.id === category)!;
    const c       = CATEGORY_COLORS[category];
    const isLast  = qIndex === totalQ - 1;
    const isZoomedLongQ = mode === "zoomed" && q.q.length > 60;

    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between p-5">
          <button onClick={prevQuestion} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border ${c.border} ${c.bg} text-gray-300`}>
              {cat.icon} {cat.label}
            </span>
          </div>
          <button onClick={skip} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
            Skip →
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5">
          <div className="h-0.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${c.dot}`}
              style={{ width: `${((qIndex + 1) / totalQ) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1.5">{qIndex + 1} of {totalQ}</p>
        </div>

        {/* Question */}
        <div className={`flex-1 flex flex-col justify-center px-6 transition-all duration-200 ease-out ${slideClass}`}>
          <div className="w-full max-w-lg mx-auto">
            {qIndex === 0 && (
              <p className="text-sm text-gray-500 mb-3 italic">{qs.entryPrompt}</p>
            )}
            <h2 className={`font-bold text-white mb-8 leading-snug ${isZoomedLongQ ? "text-xl" : "text-2xl"}`}>
              {q.q}
            </h2>

            <textarea
              ref={textareaRef as any}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && current.trim()) {
                  e.preventDefault();
                  nextQuestion();
                }
              }}
              placeholder={q.placeholder}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 focus:border-gray-500 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none resize-none transition-colors text-sm leading-relaxed"
            />
            <p className="text-xs text-gray-600 mt-2">Press Enter to continue, Shift+Enter for new line</p>

            <button
              onClick={nextQuestion}
              disabled={!current.trim()}
              className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-gray-950 font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              {isLast ? "Finish" : "Next"}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Allow skipping individual questions */}
            {!current.trim() && (
              <button
                onClick={nextQuestion}
                className="mt-3 text-sm text-gray-600 hover:text-gray-400 transition-colors"
              >
                Skip this question
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (step === "done" && category && qs) {
    const cat = CATEGORIES.find(c => c.id === category)!;
    const c   = CATEGORY_COLORS[category];

    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-6">
        <div className={`w-full max-w-md transition-all duration-300 ease-out ${slideClass}`}>
          {/* Icon */}
          <div className={`w-16 h-16 rounded-2xl border ${c.border} ${c.bg} flex items-center justify-center text-3xl mx-auto mb-6`}>
            {cat.icon}
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">You're set.</h1>
          <p className="text-gray-400 text-center mb-8 text-sm">
            Your first {cat.label.toLowerCase()} goal is saved. Let's build from here.
          </p>

          {/* Summary */}
          {answers[0] && (
            <div className={`rounded-xl border ${c.border} ${c.bg} px-4 py-3.5 mb-6`}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{cat.label}</p>
              <p className="text-white font-medium text-sm leading-relaxed">{answers[0]}</p>
            </div>
          )}

          <button
            onClick={finish}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-gray-950 font-semibold transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" /> Saving…</>
            ) : (
              <>Go to your dashboard <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
