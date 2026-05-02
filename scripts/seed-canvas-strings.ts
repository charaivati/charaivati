// scripts/seed-canvas-strings.ts
// Seeds all SelfCanvas, block, and self-page UI strings as Tab records.
// Category "ui-canvas" — these are the building blocks of the Self page.
//
// After running this, open /admin/translations to add any language manually,
// or run seed-translations.ts to auto-translate all at once.
//
// Run with: npx tsx scripts/seed-canvas-strings.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ─── Canonical string table ────────────────────────────────────────────────────
// slug                     English title (displayed)                  Description (for translators)
const CANVAS_STRINGS = [
  // ── Partner / block labels ────────────────────────────────────────────────
  { slug: "canvas-health",       title: "Health",          description: "Canvas card label for the health block" },
  { slug: "canvas-goals",        title: "Goals",           description: "Canvas card label for the goals block" },
  { slug: "canvas-skills",       title: "Skills",          description: "Canvas card label for the skills block" },
  { slug: "canvas-energy",       title: "Energy",          description: "Canvas card label for the energy block" },
  { slug: "canvas-environment",  title: "Environ.",        description: "Canvas card label for the environment block (short form)" },
  { slug: "canvas-time",         title: "Time",            description: "Canvas card label for the time/tasks block" },
  { slug: "canvas-funds",        title: "Funds",           description: "Canvas card label for the funds & resources block" },
  { slug: "canvas-network",      title: "Network",         description: "Canvas card label for the social network block" },

  // ── Section headers ───────────────────────────────────────────────────────
  { slug: "section-execution-plan",    title: "Execution plan",    description: "Header for the AI-generated goal execution plan section" },
  { slug: "section-daily-tasks",       title: "Daily tasks",       description: "Header for the daily tasks/time block section" },
  { slug: "section-project-timelines", title: "Project Timelines", description: "Header for the project timelines section" },
  { slug: "section-funds",             title: "Funds & Independence", description: "Header for the funds block section" },

  // ── Goal archetype tabs ───────────────────────────────────────────────────
  { slug: "archetype-learn",   title: "Learn",   description: "Goal archetype: learning and knowledge goals" },
  { slug: "archetype-build",   title: "Build",   description: "Goal archetype: building products, projects, systems" },
  { slug: "archetype-execute", title: "Execute", description: "Goal archetype: executing habits and practices" },
  { slug: "archetype-connect", title: "Connect", description: "Goal archetype: connecting with and serving others" },

  // ── Status / empty-state strings ──────────────────────────────────────────
  { slug: "status-no-goals",      title: "No goals yet",   description: "Empty state when user has no goals" },
  { slug: "status-not-set-up",    title: "Not set up",     description: "Partner block has no data yet" },
  { slug: "status-none-yet",      title: "None yet",       description: "No skills added yet" },
  { slug: "status-no-tasks",      title: "No tasks yet",   description: "No tasks scheduled for today" },
  { slug: "status-tap-to-view",   title: "Tap to view",   description: "Prompt to open a block (e.g. network)" },
  { slug: "status-no-direction",  title: "No driving direction", description: "Empty state when no drive/goal direction set" },

  // ── Action buttons ────────────────────────────────────────────────────────
  { slug: "action-add-goal",     title: "Add goal",        description: "Button to create a new goal" },
  { slug: "action-sign-in",      title: "Sign in",         description: "Call-to-action to sign in (in goal execution section)" },
  { slug: "action-edit-health",  title: "Edit Health Data", description: "Button to open health data editor" },
  { slug: "action-regenerate",   title: "Regenerate",      description: "Button to re-run AI generation" },

  // ── Energy labels ─────────────────────────────────────────────────────────
  { slug: "energy-high",     title: "High energy",  description: "Energy level label — high" },
  { slug: "energy-moderate", title: "Moderate",     description: "Energy level label — moderate" },
  { slug: "energy-low",      title: "Low energy",   description: "Energy level label — low" },

  // ── Drive / identity ──────────────────────────────────────────────────────
  { slug: "drive-keep-moving",   title: "Keep moving",          description: "Motivational tagline on the drive banner" },
  { slug: "drive-no-direction",  title: "No driving direction", description: "Shown when no drive is selected" },
  { slug: "drive-sign-in-guest", title: "Guest mode — Sign in to sync.", description: "Guest mode notice" },

  // ── Health block strings ──────────────────────────────────────────────────
  { slug: "health-no-data",    title: "No health data yet. Add your details to get started.", description: "Health block empty state" },
  { slug: "health-not-set",    title: "Not set", description: "Health metric value not configured" },

  // ── Skills block strings ──────────────────────────────────────────────────
  { slug: "skills-no-skills",   title: "No skills added yet.", description: "Skills block empty state" },
  { slug: "skills-add",         title: "Add skill",            description: "Button to add a skill" },
  { slug: "skills-suggesting",  title: "Suggesting…",          description: "AI is suggesting skills" },
  { slug: "skills-suggest",     title: "Suggest",              description: "Button to request AI skill suggestions" },

  // ── Time block strings ────────────────────────────────────────────────────
  { slug: "time-no-tasks",   title: "No tasks for this day.", description: "Time block empty state for selected day" },

  // ── Day abbreviations ─────────────────────────────────────────────────────
  { slug: "day-mon", title: "Mon", description: "Monday abbreviation" },
  { slug: "day-tue", title: "Tue", description: "Tuesday abbreviation" },
  { slug: "day-wed", title: "Wed", description: "Wednesday abbreviation" },
  { slug: "day-thu", title: "Thu", description: "Thursday abbreviation" },
  { slug: "day-fri", title: "Fri", description: "Friday abbreviation" },
  { slug: "day-sat", title: "Sat", description: "Saturday abbreviation" },
  { slug: "day-sun", title: "Sun", description: "Sunday abbreviation" },

  // ── Execution plan strings ────────────────────────────────────────────────
  { slug: "exec-loading",        title: "Loading your goals…",            description: "Loading state in execution plan" },
  { slug: "exec-error",          title: "Couldn't load execution plans.", description: "Error state in execution plan" },
  { slug: "exec-no-goals",       title: "No active goals yet — create one to see your execution plan here.", description: "Execution plan empty state" },
  { slug: "exec-generating",     title: "Generating execution plan…",     description: "AI is generating the plan" },

  // ── AI / shared UI ────────────────────────────────────────────────────────
  { slug: "ai-unavailable", title: "Our AI suggestions are unavailable right now — we'll get back to you soon.", description: "Fallback banner when AI is down" },
  { slug: "ai-badge",       title: "AI",         description: "Short label on AI-generated content badge" },
];

async function main() {
  console.log(`Seeding ${CANVAS_STRINGS.length} canvas UI strings...\n`);
  let created = 0, updated = 0;

  for (const s of CANVAS_STRINGS) {
    const existing = await prisma.tab.findUnique({ where: { slug: s.slug } });
    if (existing) {
      await prisma.tab.update({
        where: { id: existing.id },
        data: { title: s.title, description: s.description, category: "ui-canvas" },
      });
      updated++;
    } else {
      await prisma.tab.create({
        data: { slug: s.slug, title: s.title, description: s.description, category: "ui-canvas", is_default: false, is_custom: false },
      });
      created++;
      console.log(`  + ${s.slug}  "${s.title}"`);
    }
  }

  console.log(`\nDone: ${created} created, ${updated} updated`);
  console.log("\nNext step: open /admin/translations to add translations for any language,");
  console.log("or run: npx tsx scripts/seed-translations.ts  (auto-translate all)");
}

main().catch(console.error).finally(() => prisma.$disconnect());
