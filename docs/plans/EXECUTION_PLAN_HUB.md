# EXECPLAN — Making the Execution Plan the Center of the Site

Status: EXECPLAN-1 … 7 IMPLEMENTED on this branch (2026-07-05); EXECPLAN-8 deferred as planned. Workstream prefix: `EXECPLAN-`.
Deviation from plan: EXECPLAN-2's "seed requirements.skills into the goal's skill list" was deferred — profile-goal ↔ AiGoal identity matching is fragile JSON surgery; the skills surface in the EXECPLAN-4 requirements strip instead. GOAL-UNIFY-1 (follow-up) later created the stable link (profile mirror entry id = AiGoal.id via `lib/goals/createGoalRecord.ts`), so the seed is now buildable for goals created after it.
Author context: investigation of the current flow on 2026-07-05, branch `claude/site-flow-execution-plan-elliec`.

---

## 1. What exists today (investigation findings)

### The two landing surfaces
- **`/self` (SelfCanvas)** — `components/self/SelfCanvas.tsx`. Top row: Health · Goals · Skills. Partner row: Energy · Environment · Time · Funds · Network. One expanded panel at a time, **Time is the default** and contains `GoalExecuteSection` (the execution plan), `TimeSection` (daily tasks), and Project Timelines. Drive is set via `DriveBlock` (`OnboardingBanner` / `DrivePickerStateB`) at the top of `SelfTab`.
- **`/chakra/landing`** (+ `/simple` variant) — the scroll journey; per-chakra detail pages at `/chakra/[key]` with `DEEP_LINKS` / `SIGNAL_LINKS` (`app/chakra/meta.ts`) pointing back into `/self` tabs, `/earn`, `/app/initiatives`, `/society`, `/listen`. Chakra scores already consume goal/todo data (`root.action` counts AiGoals; any chakra with tagged todos gains a `todos` completion signal).

### The execution plan machinery
- `AiGoal.executionPlan` JSON (`lib/site/executionPlanTypes.ts`): `nextAction`, `minimumViableSession`, 3 phases with tasks, `relevantSections`, `honestLimitations`.
- Generated in two AI steps (`POST /api/goal-ai/execution-plan`, `step: skeleton | tasks`). Tasks carry a `sectionKey` validated against **`lib/site/capabilityRegistry.ts` (SECTIONS)** — the routing registry ("never link users to a planned section").
- Rendered by `ExecuteBlock` inside the Time panel: next action, current phase checklist, `SectionPill` links ("Open Time →"), graduation/advance, inline editing.
- On the `tasks` step, tasks are mirrored into `Todo` rows (`source="execution_plan"`, chakra from `ARCHETYPE_CHAKRA`).
- The Listener (`/listen`) already bridges clueless users: `insights.driveCandidate` → `ProfileProposal` → drive/goal saved via `POST /api/self/profile-proposal`. The chatbot's `ai-context/STRUCTURE.txt` already encodes the order Drive → Goal → Health → Skills → Funds → Time.
- `/business` already links to goals: `BusinessIdeaGoal` join (BIZDOC-5) ties a BusinessIdea to an AiGoal.
- Funds and Environment blocks already have their own AI routes (`/api/self/generate-funds-plan`, `/api/self/generate-environment-cues`).
- Chatbot/Listener site awareness: `lib/site/siteAwareness.ts` summarizes SECTIONS into prompts.

### The gaps (why the plan is not yet "the center")
| # | Gap | Evidence |
|---|-----|----------|
| G1 | **The registry is too coarse to route anywhere useful.** Only 5 self tab keys + planned outer layers. `/business`, `/app/initiatives`, `/listen`, `/earn`, `/chakra`, and the individual blocks (health, skills, funds, environment, energy) are not addressable, so the AI literally cannot send a task to "build your pitch deck" or "talk it out in Listen". | `lib/site/capabilityRegistry.ts` |
| G2 | **Plan progress is not persisted.** `ExecuteBlock.doneTasks` is `useState(new Set())` — checkmarks vanish on reload/goal-switch. The Todo mirror is one-way at creation; checking a plan task never completes the Todo, so chakra scores and the plan disagree. | `ExecuteBlock.tsx:167`, execution-plan route todo loop |
| G3 | **The plan doesn't know what the goal *needs*.** No structured skills-needed / funds-needed / environment / social / support output — those dimensions live in separate blocks with no link from the plan. The plan is a task list, not a hub. | `executionPlanTypes.ts` |
| G4 | **No chakra parity.** The chakra pages show todo completion but never the plan itself (next action, phase). The user wants both landings to carry the same flow. | `app/chakra/landing`, `meta.ts` |
| G5 | **Chatbots don't see the plan.** `buildUserContext` local tier includes drives/goals/energy/initiatives but not the execution plan or next action — the guide can't say "your next action is X, it lives on page Y". | `lib/ai/userContext.ts` |
| G6 | **Pre-drive entry is buried.** The clueless user ("I'm afraid", "I'm in love") has a working path (Listener → driveCandidate → proposal) but neither landing page offers it as the explicit alternative to goal creation. | landing pages |
| G7 | Mechanical debt: `currentPhaseIndex` can go stale on regenerate; goal-ai routes have no rate limit. | `docs/modules/goals-ai.md` risks |

---

## 2. Doctrine (the target shape)

1. **The execution plan is the router.** Every plan task carries a `sectionKey` into an *expanded* registry that covers every real surface. The user never roams; the plan (and the chatbots reading it) always points at the one next page.
2. **Health is a gate, not a plan dimension.** Health stays its own block, rendered *above* the plan as a standing energy gate ("Energy 3/10 — steady this first"), never generated inside plan phases. A drive is a necessity; realizing it needs a working body first.
3. **Time is the plan's home.** The Time panel stays the default expanded panel; the plan is its first card. Anti-procrastination = persisted progress + one visible next action + minimum viable session.
4. **Dimensions are links, not copies.** Skills/Funds/Environment/Social/Energy blocks keep owning their data; the plan holds only *requirements* pointing into them. Funds requirements route to `/business` (pitch deck / plan docs); "set up a venture" routes to `/app/initiatives`; "needs support/therapy first" routes to `/listen`. Social sits inside Environment's requirement group for now (per MK: may split later).
5. **One truth for progress.** Plan task ↔ Todo become two views of the same row, so chakra scores, the daily task list, and the plan agree.
6. **Both landings, one flow.** `/self` and `/chakra/landing` are toggleable skins over the same data: drive → goal → health gate → execution plan → dimension surfaces. Chakra ordering: root = survival (health/funds/environment), sacral = creativity+social, solar = learning/overcoming barriers, heart = compassion/social movements, throat = speak & share, third_eye = consciousness (`/listen`), crown = later.
7. **Two kinds of arrivals.** Knows-what-they-want → goal creation flow directly. Clueless (pre-drive) → Listener/chat first; drive proposal → goal → same plan pipeline. Both landings must offer both doors.
8. **Outer layers come later but are already representable.** A political/social-movement goal is just a goal whose tasks tag `society.*` / `nation.*` keys — the `SectionPill` planned-state rendering (label + ETA + interim) already handles this honestly. No new machinery needed now, only a `layer` classification on the plan.

---

## 3. Workstream — numbered prompts

Ordered so each prompt is small, independently shippable, and later prompts build on earlier ones.

### EXECPLAN-1 — Expand the capability registry (data only, no UI)
`lib/site/capabilityRegistry.ts`:
- Add live entries: `self.health`, `self.skills`, `self.funds`, `self.environment`, `self.energy`, `self.network` (all `/self?tab=personal` + a `panel` hint — see below), `business.evaluate` (`/business/idea`), `business.plan` (`/business/plan`), `earn.initiatives` (`/app/initiatives`), `earn.hub` (`/earn`), `listen.consult` (`/listen`), `chakra.landing` (`/chakra/landing`).
- Add two optional fields to `SectionInfo`: `dimension?: 'health'|'skills'|'funds'|'environment'|'social'|'energy'|'time'|'business'|'support'` and `panel?: string` (which SelfCanvas partner panel to auto-open, e.g. `funds`).
- SelfCanvas reads a `?panel=` query param to auto-open the matching partner panel (tiny change, ~10 lines) so `self.funds` can deep-link to the open Funds panel, not just the page.
- Nothing else changes; the AI prompts already serialize SECTIONS, so routing quality improves immediately.

### EXECPLAN-2 — Plan schema: add `requirements` (what the goal needs)
- Extend `ExecutionPlan` with optional `requirements`: `{ skills: {name, status: 'have'|'learn'}[], funds: {estimate?: string, note: string, businessNeeded: boolean} | null, environment: string[], social: string[], support: 'none'|'consider_listen', layer: 'self'|'society'|'nation'|'earth' }`.
- Generate it in the existing **skeleton** step (extend the prompt + validator; keep token budget by trimming — or add a third `step: 'requirements'` if the skeleton call gets too heavy; decide by testing output quality at 400 maxTokens).
- Fallback-safe: missing/invalid `requirements` → `undefined`, UI renders nothing. Backward compatible with every stored plan.
- When `requirements.skills` exists, seed them into the goal's skill list via the existing per-goal skills mechanism (the same data `onSuggestSkills` fills) — add-only, never overwrite user-entered skills.

### EXECPLAN-3 — Persist progress: plan task ↔ Todo two-way sync
The highest-leverage fix (G2).
- Give each generated task a stable `id` (cuid at generation time) in the plan JSON; write it onto the mirrored Todo via the existing raw-SQL update (new nullable `Todo.planTaskId` column — add via `prisma db execute` per the current drift caution, read/write via raw SQL).
- `ExecuteBlock` checkbox → `PATCH /api/self/todos/[id]` completion (route exists for the todo list) *and* stamps `done: true` on the task in the plan JSON via the existing goal PATCH. On load, done-state comes from the plan JSON (no extra query).
- Chakra `todos` signal, the daily task list, and the plan now agree by construction.
- Include the G7 fixes here: clamp `currentPhaseIndex` to `phases.length - 1` on read; `checkRateLimit` on the three goal-ai routes.

### EXECPLAN-4 — Hub UI: dimension strip + health gate in ExecuteBlock
- **Health gate**: above the plan card, render a slim banner from `computeEnergy` (already available in SelfCanvas): green ≥7 pass silently, amber/red → "Health first — Energy N/10" linking to the Health panel (`?panel=health`). Display-only; never blocks.
- **"What this goal needs" strip** under Next Action, driven by `requirements`:
  - Skills chip → opens Skills panel with this goal highlighted (mechanism exists: `highlightGoalId`).
  - Funds chip → Funds panel; if `businessNeeded`, a second CTA "Build the business case →" to `/business/idea`, and if a `BusinessIdeaGoal` link already exists, deep-link to that idea's plan page instead.
  - Environment chip (social items listed inside it) → Environment panel; Network sub-link → Network panel.
  - Support chip (only when `support === 'consider_listen'`) → `/listen`, worded gently.
  - "Set up a venture" (when the plan's tasks tag `earn.initiatives`) → `/app/initiatives`.
- Energy pill on the strip shows the composite score and links to the Energy panel — the visual reminder that every dimension feeds energy.
- All links resolve through the registry — no hardcoded routes in the component.

### EXECPLAN-5 — Chakra parity + landing toggle
- `/chakra/[key]` detail pages: below tagged todos, render a compact "Execution plan" card (goal title, next action, phase N/3, link to `/self?tab=time`) for goals whose `ARCHETYPE_CHAKRA` maps to that chakra. Data from `GET /api/self/goals` (already returns plans).
- `/chakra/landing` stage cards: when the stage's chakra has an active plan, the card's CTA line shows the plan's next action instead of the generic remark.
- **Toggle**: a small persistent switch (localStorage `charaivati.landing`) rendered on both `/self` and `/chakra/landing` headers — "🪷 Chakra view / ▦ Canvas view". Pure navigation; no data change.

### EXECPLAN-6 — Chatbots understand the plan
- `lib/ai/userContext.ts` local tier: append an "ACTIVE PLAN" block — goal title, current phase title, next action text + resolved route, requirements one-liner, done/total task counts. Cloud tier gets at most `Active plan: phase 2/3` (keep the minimal-block doctrine).
- New context file `ai-context/EXECUTION_PLAN.txt` (sections must match `\w+` — e.g. `[SECTION: doctrine]`, `[SECTION: routing]`, `[SECTION: predrive]`): the doctrine of §2 written for the model — plan is the center, health first, time second, always point at the single next action's page, bridge pre-drive users toward a drive without forcing. Loaded by `/api/chat` (always) and `/listen` (semi-static zone), same `contextLoader` pattern.
- Update `ai-context/STRUCTURE.txt` flow section to insert Environment (+ social) after Funds and to mention the `/business` handoff for funds-heavy goals.
- **These context files live on MK's local drive — MK adds/edits the .txt content; the prompts only wire loading.**

### EXECPLAN-7 — Pre-drive doors on both landings
- Goal creation entry (`GoalsCompact` / `GoalsExpanded`) gains a second door: "Not sure yet? Talk it out →" → `/listen` (and the chat widget's companion mode as the lighter alternative). Same door on the chakra landing's root/third-eye stages.
- When a drive proposal is accepted from Listener/chat (`charaivati:profile-updated` event already fires), the landing surfaces a one-time nudge: "Drive set — shape your first goal?" → opens goal creation. Closes the loop clueless → drive → goal → plan.

### EXECPLAN-8 (deferred) — Outer-layer goals
- Add `layer` classification (from EXECPLAN-2's `requirements.layer`) to plan display: a societal/national goal gets a badge and its tasks naturally tag `society.*`/`nation.*` planned sections (interim guidance already renders). Revisit when the social layer is built; no code beyond the badge now.

---

## 4. Sequencing rationale
1 (registry) unlocks everything and risks nothing → 2 (schema) gives the hub its data → 3 (persistence) makes the hub trustworthy → 4 (UI) makes it visible → 5 (chakra) mirrors it → 6 (AI) makes the guides speak it → 7 (pre-drive) opens the second door. Each prompt = one fresh chat per CLAUDE.md workflow.

## 5. Open decisions for MK
1. **Requirements generation**: extend skeleton step vs third AI step — recommend trying skeleton-extension first (one less round trip), fall back to a third step if quality drops.
2. **Social placement**: inside Environment chip for now (per your note), split later if it earns its own block.
3. **Context files**: EXECPLAN-6 needs `EXECUTION_PLAN.txt` (new) and a `STRUCTURE.txt` flow tweak — confirm you'll add these on the local drive when that prompt lands.
4. **Toggle default**: which landing is default for new users — `/self` canvas (current) or chakra journey?
