// lib/self/buildProfileReview.ts — periodic per-user profile reviewer.
//
// Reads a user's structured Profile (+ owned pages), runs ONE local-first AI pass
// (chatComplete), and upserts a compiled per-user context doc into UserContext
// (kind="profile-review"). The chat reads this so the next session opens already
// understanding the person. Synthesis only — the raw fields stay on Profile.
//
// Called by the cron sweep (app/api/cron/profile-review) and opportunistically by
// the chat route when the review is stale. Returns null on no-profile / AI failure
// (callers log and move on — a missing review just omits the chat block).

import { db } from "@/lib/db";
import { chatComplete, safeJsonParse } from "@/app/api/aiClient";

const REVIEW_MODEL = process.env.REVIEW_AI_MODEL ?? process.env.OLLAMA_MODEL ?? "llama3:8b";

export interface ProfileReview {
  summary: string;
  gaps: string[];
  conflicts: string[];
  suggestedFocus: string;
  chatGuidance: string;
  businessSuggestion: string;
  saathiSuggestion: string;
  adminNotes: string;
}

function compactProfile(profile: any, pages: { title: string; pageType: string | null }[]): string {
  const drives = Array.isArray(profile?.drives) ? profile.drives : [];
  const goals = Array.isArray(profile?.goals)
    ? profile.goals
        .filter((g: any) => g?.statement?.trim())
        .map((g: any) => ({
          statement: g.statement,
          drive: g.driveId,
          skills: (Array.isArray(g.skills) ? g.skills : [])
            .filter((s: any) => s?.name?.trim())
            .map((s: any) => ({ name: s.name, status: s.status ?? "untriaged" })),
        }))
    : [];
  const general = Array.isArray(profile?.generalSkills)
    ? profile.generalSkills.filter((s: any) => s?.name?.trim()).map((s: any) => s.name)
    : [];
  const ws = profile?.weekSchedule;
  return JSON.stringify({
    drives,
    goals,
    generalSkills: general,
    health: profile?.health ?? null,
    funds: profile?.fundsProfile ?? null,
    environment: profile?.environmentProfile ?? null,
    weekSchedule: ws ? { tasks: (ws.tasks ?? []).length, slots: (ws.slots ?? []).length } : null,
    pages: pages.map((p) => ({ title: p.title, type: p.pageType })),
  });
}

function renderBody(r: ProfileReview): string {
  return [
    r.summary,
    r.gaps.length ? `\nGaps:\n${r.gaps.map((g) => `- ${g}`).join("\n")}` : "",
    r.conflicts.length ? `\nConflicts:\n${r.conflicts.map((c) => `- ${c}`).join("\n")}` : "",
    r.suggestedFocus && r.suggestedFocus !== "none" ? `\nSuggested focus: ${r.suggestedFocus}` : "",
    r.chatGuidance ? `\nChat guidance: ${r.chatGuidance}` : "",
    r.businessSuggestion ? `\nBusiness: ${r.businessSuggestion}` : "",
    r.saathiSuggestion ? `\nSaathi: ${r.saathiSuggestion}` : "",
    r.adminNotes ? `\nAdmin notes: ${r.adminNotes}` : "",
  ].filter(Boolean).join("\n");
}

export async function buildProfileReview(userId: string): Promise<ProfileReview | null> {
  const [profile, pages] = await Promise.all([
    db.profile.findUnique({
      where: { userId },
      select: {
        drives: true, goals: true, health: true, generalSkills: true,
        fundsProfile: true, environmentProfile: true, weekSchedule: true,
      },
    }),
    db.page.findMany({
      where: { ownerId: userId, status: "active" },
      select: { title: true, pageType: true },
      take: 10,
    }),
  ]);
  if (!profile) return null;

  // Nothing meaningful to review yet — skip the AI call for empty profiles.
  const hasDrives = Array.isArray(profile.drives) && profile.drives.length > 0;
  const hasGoals = Array.isArray(profile.goals) && (profile.goals as any[]).some((g) => g?.statement?.trim());
  if (!hasDrives && !hasGoals && pages.length === 0) return null;

  let review: ProfileReview;
  try {
    const raw = await chatComplete({
      model: REVIEW_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You review a person's life-structure data for the Charaivati platform and return ONLY valid JSON, no markdown. Be concise, specific, and honest. The Charaivati structure is: a DRIVE (learning/helping/building/doing) → GOALS → SKILLS per goal → HEALTH (which powers their energy) → FUNDS → TIME.",
        },
        {
          role: "user",
          content: `User structure:\n${compactProfile(profile, pages)}\n\nReturn ONLY this JSON. For "suggestedFocus" pick EXACTLY ONE word from: drive, goal, skills, health, funds, time, none.\n{"summary":"2-3 sentence picture of this person right now","gaps":["what's missing or unset, most important first"],"conflicts":["where goal vs funds vs time vs health don't add up; [] if none"],"suggestedFocus":"one word","chatGuidance":"1-2 sentences telling the guide chat how to open and what to clarify next time","businessSuggestion":"should they start or improve a business/store page, and what — or empty string","saathiSuggestion":"would the Saathi listener help right now (stress, stuck, lonely) and why — or empty string","adminNotes":"anything notable for an admin reviewing this account — or empty string"}`,
        },
      ],
      maxTokens: 600,
      jsonMode: true,
    });
    const p = safeJsonParse<Partial<ProfileReview>>(raw);
    if (!p?.summary) return null;
    // Normalize to a single valid focus — weaker local models sometimes echo the
    // whole "drive|goal|…" option list instead of picking one.
    const FOCI = ["drive", "goal", "skills", "health", "funds", "time", "none"];
    const rawFocus = String(p.suggestedFocus ?? "none").trim().toLowerCase();
    const suggestedFocus = FOCI.includes(rawFocus) ? rawFocus : "none";
    review = {
      summary: String(p.summary).slice(0, 800),
      gaps: Array.isArray(p.gaps) ? p.gaps.map(String).slice(0, 8) : [],
      conflicts: Array.isArray(p.conflicts) ? p.conflicts.map(String).slice(0, 8) : [],
      suggestedFocus,
      chatGuidance: String(p.chatGuidance ?? "").slice(0, 600),
      businessSuggestion: String(p.businessSuggestion ?? "").slice(0, 400),
      saathiSuggestion: String(p.saathiSuggestion ?? "").slice(0, 400),
      adminNotes: String(p.adminNotes ?? "").slice(0, 400),
    };
  } catch (err) {
    console.error("[buildProfileReview] AI pass failed:", (err as Error).message);
    return null;
  }

  const body = renderBody(review);
  const metaJson = JSON.stringify(review);
  // Raw SQL — UserContext is a new model not yet in the generated client.
  await db.$executeRaw`
    INSERT INTO "UserContext" ("userId", "kind", "body", "meta", "updatedAt")
    VALUES (${userId}, 'profile-review', ${body}, ${metaJson}::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId", "kind")
    DO UPDATE SET "body" = ${body}, "meta" = ${metaJson}::jsonb, "updatedAt" = CURRENT_TIMESTAMP`;

  return review;
}
