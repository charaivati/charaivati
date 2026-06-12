# Listener ("Saathi") — `/api/listen`

A guided-conversation backend (CONSULT-1b) that listens a person toward ONE goal in their own words.
It is a **parallel system** to the chatbot (`/api/chat`) — not a mode of it.

## Doctrine

The Listener shares exactly **four seams** with the existing chat stack:

1. **Pipeline** — `lib/ai/chatPipeline.ts` (`authenticateChat`, `runInputGuard`, `runGuardedCompletion`): auth resolution, guardrail scanning, the 30 s timeout, the LLM call, output scan, tier resolution, fallback.
2. **Guardrails** — `scanInput`/`scanOutput`/`notifyAdmin` behave identically to `/api/chat` (BLOCK → canned reply + `GuardrailEvent` row; WARN → continue + notify).
3. **Proposal mechanism** — `tryProposeGoal` from `lib/companion/profileSync.ts`, called directly from `/api/listen` at stage 4. Its internals are untouched: the route passes a *synthetic* `companionProfile` parameter built from Listener insights, because the function only reads `primaryDrive` and `driveConfirmedByUser` off the param and never queries (or writes) `UserCompanionProfile`. Accepted proposals go through the existing `POST /api/self/profile-proposal` with its CHAT-FIX-1 validation.
4. **Bubble CSS** — the Listener UI (later prompt) reuses the chat bubble styling.

Everything else is its own: persona, persistence, stage machine, extraction.

### HARD RULE — no UserCompanionProfile writes

Listener code (`app/api/listen/`, `lib/listener/`) must **never** write UCP fields — `primaryDrive`, `driveConfirmedByUser`, `dailyAvailableHours`, `healthFlags` gate the companion arc state machine (CONSULT-0c §4). Reading UCP is fine. The Listener's drive sense lives only in `ConsultSession.insights.driveCandidate`.

### Goal candidates live only in proposals

`insights` deliberately has **no goal field**. A goal candidate exists only as a `ProfileProposal` returned in the response payload; it becomes real only when the user accepts it via `POST /api/self/profile-proposal`. Do not add a goal field to insights — it would create a second, unvalidated write path into the user's goals.

## Data model

`ConsultSession` — one per user (`userId @unique`; guests are real `User` rows, so guests work). Fields: `consultStage Int @default(0)`, `insights Json @default("{}")`, `language String?` (captured from the `lang` cookie at create), timestamps. Cascade-deletes with the user.

`ConsultMessage` — `sessionId`, `role` (`"user" | "assistant"`), `content @db.Text`, `createdAt`; `@@index([sessionId, createdAt])`; cascade-deletes with the session.

Migration: `prisma/migrations/20260611000000_add_consult_session/`. Access via `(db as any).consultSession` / `.consultMessage` until a full `prisma generate` runs (Windows hot-fix: `npx prisma generate --no-engine`).

### insights JSON shape (`ConsultInsights` in `lib/listener/insights.ts`)

```json
{
  "themes": ["..."],
  "driveCandidate": { "value": "learning|helping|building|doing|null", "confidence": "sensed|confirmed" },
  "skills":      { "items": ["..."] },
  "health":      { "notes": ["..."], "senseLevel": null },
  "environment": { "notes": ["..."] },
  "time":        { "notes": ["..."], "dailyHours": null },
  "funds":       { "notes": ["..."], "pressure": "low|medium|high|null" },
  "network":     { "notes": ["..."] },
  "energy":      { "senseLevel": null }
}
```

Merge rules (`mergeInsights`): lists union-deduped case-insensitively, capped at 12; scalars only filled/updated by non-null incoming values; a `confirmed` driveCandidate is never overwritten or downgraded (only `null→value` and `sensed→confirmed` transitions).

### `PersonalityProfile` (UCTX-3)

One row per user (`userId @unique`), cascade-deletes with the user. A **hypothesis-grade, slow-built tone-steering signal** — see "Extraction cadences" below for the full merge/confidence math. Fields: `disc Json @default("{}")` and `driveScores Json @default("{}")` — both `Record<dim, { score: 0-1, evidence: int }>`, the latter keyed by `learning|helping|building|doing`; `sampleCount Int @default(0)`; `confidence Float @default(0)`; `notes Json @default("[]")` (FIFO-capped evidence strings, max 20).

Migration: `prisma/migrations/20260614000000_add_personality_profile/`. Access via `(db as any).personalityProfile` until a full `prisma generate` runs (Windows hot-fix: `npx prisma generate --no-engine`). All fields have explicit `@default`s (per the `UserCompanionProfile.healthFlags` P2011 lesson) and the row is only ever written via `upsert`.

**Independent from `insights.driveCandidate`** — `driveScores` here are the Listener's own slowly-built signal; the two are never reconciled or cross-written. **Standing ban applies**: `lib/listener/personality.ts` doesn't even import `db`, and nothing in this pass reads or writes `UserCompanionProfile`.

### `PhilosophyPersona` and `AdminQuestion` (PERSONA-1)

Added for the admin bridge (see "Admin Bridge" below) — `PhilosophyPersona` stores admin-taught tone lenses (`name @unique`, `displayName`, `body`, `triggers String[]`, `status: draft|active`, `sourceType`, `attribution?`); `AdminQuestion` stores anonymized knowledge-gap questions (`source`, `question`, `topic?`, `status: open|answered|dismissed`, `answer?`, `answeredAt?`) and **deliberately has no `userId` field**. Migration: `prisma/migrations/20260615000000_add_persona_admin_question/`. Both require `(db as any)` until a full `prisma generate`. All array/scalar fields have explicit `@default`s (per the `UserCompanionProfile.healthFlags` P2011 lesson).

## API

### `POST /api/listen` — `{ message, dismissedProposals? }`

1. `authenticateChat` (401 if no session — guest sessions count).
2. `runInputGuard` — BLOCK returns the canned reply and **persists nothing**.
3. Upsert `ConsultSession` (capture `lang` cookie on create).
4. History rebuilt server-side via the **stable-prefix scheme** (UCTX-1b) — client-sent history is never trusted (guests, reloads, tampering). The **unfolded** window (messages with `createdAt > foldedThrough`) is sent append-only; older turns are condensed into `ConsultSession.rollingSummary`. When the unfolded window exceeds **30** messages, the oldest **16** are summarized (one `chatComplete` `jsonMode` call) into `rollingSummary`, `foldedThrough` advances to that batch's boundary, and they drop out of the model window — keeping the prompt prefix stable between turns. On summarization failure the fold is deferred (window stays large, retried next turn). The full transcript is never deleted — folding only changes what the model sees, not what `GET` returns for display.
5. Persist inbound `ConsultMessage`.
6. System prompt (see below), `temperature 0.7`, `maxTokens 220`, via `runGuardedCompletion`. Two variants are built: a **local** prompt (full insights summary) and a **cloud** prompt where the insights summary is replaced by the minimal tier-`"cloud"` `buildUserContext` block; both are passed as `messages` / `cloudMessages` (UCTX-1a/-1b seam) so cloud fallbacks never receive the full sensed-insight detail.
7. Persist assistant `ConsultMessage`.
8. **Extraction passes** — see "Extraction cadences" below. Insights extraction (every 4th user message) merges via `mergeInsights`, then `evaluateStageAdvance` runs; session updated. Personality extraction (every 8th user message) merges via `applyPersonalityDeltas`; `PersonalityProfile` upserted. Both run in parallel via `Promise.all` when they coincide (every 8th message).
9. **Proposal** — at stage 4 with a sensed drive, `tryProposeGoal` runs against the conversation text; any proposal is attached to the payload exactly like `/api/chat` does.
10. Response: `{ ok: true, reply, consultStage, proposal? }`.

### `GET /api/listen`

`{ ok, consultStage, insights, messages: last 50 (ascending) }` — page hydration on load/reload.

## Extraction cadences (UCTX-3)

Two independent `chatComplete` `jsonMode` extraction passes run on different cadences, off the same user-message counter:

| Pass | Cadence | Input window | Writes to | Failure isolation |
|---|---|---|---|---|
| Insights | every 4th user message (`EXTRACTION_EVERY = 4`) | full conversation text since last extraction | `ConsultSession.insights` (+ possible stage advance) | bad parse → drops this pass only, `insights` unchanged |
| Personality | every 8th user message (`PERSONALITY_EVERY = 8`) | last ~12 messages (`windowRows.slice(-10)` + current turn) | `PersonalityProfile` (one row per user, upserted) | bad parse → drops this pass only, profile unchanged |

`8 % 4 === 0`, so on every 8th user message both passes fire together via `Promise.all` — no truncation or ordering issues, each is an independent `chatComplete` call.

### Personality merge + confidence math (`lib/listener/personality.ts`)

- Each pass returns **deltas only**, clamped to `±0.1` per dim (`MAX_DELTA`), for any of `disc.{D,I,S,C}` and `driveScores.{learning,helping,building,doing}` — each entry is `{ score: 0-1, evidence: count }`.
- `applyPersonalityDeltas`: for each dim with a non-zero delta, `score = clamp01(score + delta)` and `evidence += 1`; `sampleCount += 1` once per pass.
- **Confidence**: `confidence = clamp01(min(1, sampleCount / 12) * (1 - disagreementPenalty))`, where `disagreementPenalty = ((total - agree) / total) * 0.3` and `agree` counts dims where the delta's sign matches the existing lean away from 0.5 (`signsAgree`). Disagreeing signals slow confidence growth.
- `evidence` strings (0-2 per pass, from the LLM) are appended to `notes`, FIFO-capped at 20 (`MAX_NOTES`).
- **Composer threshold**: `PERSONALITY_COMPOSER_THRESHOLD = 0.3`. Below it, `summarizePersonalityForComposer` returns `null` and nothing is added to the local prompt — UCTX-2's cold-start block already covers the empty case. At/above it, a single tone-steering line is appended to the local dynamic block AND `PERSONALITY_GUIDANCE` is loaded into the semi-static zone (local prompt only — never the cloud prompt).
- The tone-steering line never names the DISC framework or drive labels as "types" — it describes preferences/energizers in plain language (e.g. "prefers directness and getting to the point", "seems energized by building or creating things").

## System prompt assembly

From `ai-context/CONSULT_LISTENER.txt` via `loadSection()` (named `[SECTION: NAME]` blocks — names must match the loader's `\w+` regex). Order follows the **static → semi-static → dynamic** doctrine (UCTX-1b — see `CLAUDE.md` § Prompt Assembly Doctrine):

| Zone | Block | When |
|---|---|---|
| static | PERSONA | always |
| static | NEVER | always |
| static | CRISIS protocol | always |
| static | User-language instruction (`session.language`) | always — **moved up** per audit |
| semi-static | PHASES + current stage line | always |
| semi-static | METHOD_ROGERIAN | stage 0–1 |
| semi-static | METHOD_MI | stage 1–3 |
| semi-static | METHOD_SFBT | stage 3–4 |
| semi-static | PARAMETER_SENSING | stage 0–3 |
| semi-static | Folded `rollingSummary` (older messages) | when non-empty (changes only at fold events) |
| semi-static | PERSONALITY_GUIDANCE | **local prompt only**, and only when the personality tone-steering line was emitted (`confidence >= 0.3`) — never in the cloud prompt |
| semi-static | ADMIN_MODE + up to 3 open `AdminQuestion`s | **admin sessions only** (`isAdmin && !crisisActive`) — **replaces** PHASES/METHOD_*/PARAMETER_SENSING/PERSONALITY_GUIDANCE entirely; see "Admin Bridge" below |
| dynamic | Compact insights summary (`summarizeInsights`) — **local prompt**; minimal `buildUserContext` cloud block — **cloud prompt** | when non-empty (skipped for admin sessions — no insights extraction runs) |
| dynamic | Steer hint (`THIS TURN ONLY`) | steer/correction turns, last |

**Crisis mode** keeps its own collapsed ordering (PERSONA + crisis-mode protocol + NEVER + languageLine) — unchanged by the reorder; no stages/methods/sensing/insights/summary. Crisis takes precedence over admin mode (`isAdmin && !crisisActive`).

**No** platform / initiatives / mentor / companion-philosophy blocks — this is not the Guide.

## Stage definitions and advancement

| Stage | Name | Advance criterion (data-gated, at most one per extraction pass) |
|---|---|---|
| 0 | Rapport | →1: ≥1 theme extracted |
| 1 | Exploration | →2: ≥2 themes AND at least one parameter touched (skills or any notes) |
| 2 | Values | →3: `driveCandidate.value` non-null (sensed) |
| 3 | Vision | →4: `goalEmerging` from extraction AND time + funds + energy each touched |
| 4 | Goal-proposal | →5: **only on accepted proposal** — not auto-advanced by the backend; wired by the Listener UI prompt (deliberate gap in CONSULT-1b) |
| 5 | Handed off | terminal |

## Page architecture (CONSULT-2)

`/listen` lives at `app/(listen)/listen/page.tsx` — a route group with **no layout of its own**, so it inherits only the root layout (no nav shell, no bottom tabs). Mobile-first: the page is designed for a phone viewport and will later ship as a standalone Capacitor app.

- **Guest-first entry**: on mount the page GETs `/api/listen`; a 401 triggers a silent `POST /api/user/guest` (same endpoint the login page's guest button uses — creates a real `User` row with `status: "guest"` and sets the session cookie), then re-GETs to hydrate `{ consultStage, insights, messages, crisis }`. Returning users resume mid-conversation automatically.
- **Middleware**: `/listen` is in the language-gate skip list in `middleware.ts` — a fresh visitor has neither a session nor a `lang` cookie, and the gate would otherwise bounce them to the language picker before the guest bootstrap could run. Without a `lang` cookie the AI simply follows whichever language the user writes in.
- **ChatBot suppression**: the root layout mounts `components/chat/ChatBotGate.tsx` (was `ChatBot` directly) — a tiny `usePathname` wrapper that returns `null` on `/listen` paths and renders `<ChatBot {...props}/>` everywhere else. ChatBot internals untouched.

### Component map

| Component | Role |
|---|---|
| `app/(listen)/listen/page.tsx` | Shell: metadata + full-height main, renders ListenChat |
| `components/listen/ListenChat.tsx` | Everything stateful: guest bootstrap + hydration, bubbles (styling copied from ChatBot), send → `POST /api/listen`, rotating contextual status lines ("Listening…", cycling 1.5 s — not three dots), map-trigger check, steer chips, crisis banner, proposal accept/dismiss |
| `components/listen/MindMap.tsx` | Hand-rolled inline SVG bottom sheet (no new dependency). 9 fixed nodes: Drive (top) → Goal → Skills/Health/Environment/Time/Funds/Network/Energy |
| `components/chat/ProposalCard.tsx` | Shared Yes/No proposal card — lifted verbatim from ChatBot's inline JSX; ChatBot now imports it (props identical, zero behavior change). Exports the `charaivati.dismissed_proposals` localStorage helpers for ListenChat |
| `lib/ai/mapTrigger.ts` | `isMapRequest(msg)` + `MAP_TRIGGERS` — mirrors `councilTrigger.ts`; checked client-side BEFORE sending; on match the sheet opens locally and the model is NOT called |

### Mind-map fill states

- **grey/dashed** = unknown (no data in insights)
- **soft indigo fill** = sensed (insights has notes/value; Goal node is sensed at stage 4)
- **solid indigo + ✓** = confirmed (`driveCandidate.confidence === "confirmed"`; Goal at stage 5)
- **Energy** renders its `senseLevel` inside the circle and is dotted/italic-labelled "(derived)" — read-only
- **Network** is display-only (no write target yet — pending FriendCircle wiring)

### Steer-message protocol

Tapping a node closes the sheet and steers the conversation — a structured field, never fake user text:

- `POST /api/listen { message: "", steer: "health" }` — valid keys: `drive | goal | skills | health | environment | time | funds | network | energy`.
- `correction: true` (from long-press / right-click → "That's not right") tells the model to **re-ask rather than assume**.
- Server appends a one-turn system hint ("THIS TURN ONLY: the user tapped X…"). For steer-only turns the model sees an in-flight `[map tap: X]` marker as the final user turn (some providers require one), but **no user `ConsultMessage` is persisted** — the UI shows a small chip ("You chose: Health") instead.
- Steer is ignored while crisis mode is active.

## Crisis behavior (CONSULT-2 — code-enforced, not just prompt-enforced)

Design constraint: crisis input must **never** be a guardrail BLOCK — a canned redirect is the worst possible response to "I want to hurt myself."

1. **Detection**: `scanInputCrisis()` in `lib/ai/guardRail.ts` — a separate function (English + common Latin-script Hinglish patterns for self-harm intent, suicidal ideation, acute distress). `scanInput`/`scanOutput` are untouched; `/api/chat` behavior is byte-identical.
2. **Latch**: first detection sets `ConsultSession.crisisFlag = true` (migration `20260612000000_add_consult_crisis_flag`). **Never auto-cleared** — clearing is a manual DB operation. Every subsequent turn in the session stays in crisis mode.
3. **Per-turn effect**: extraction, proposals, and stage advancement are skipped; the system prompt collapses to PERSONA + a force-loaded CRISIS protocol + NEVER + language (no stages/methods/parameter-sensing/insights recital).
4. **Logging**: `notifyAdmin` fires a `LISTEN_CRISIS` GuardrailEvent (DB row + admin email) on the first detection per session.
5. **UI**: responses carry `crisis: true`; ListenChat renders a persistent, gentle helpline banner above the input — **Tele-MANAS 14416** and **KIRAN 1800-599-0019** (free, India), as `tel:` links. The banner is UI-rendered because model output is not a reliable delivery channel for emergency numbers.

## Guest-to-Authenticated Upgrade (UCTX-2)

The Listener welcome guests into a judgment-free conversation without requiring login. However, to preserve the conversation history across sessions, guests need to secure their account. The `SecureChatCard` component is embedded in the ListenChat to make this frictionless.

### Trigger Moments

The card appears in one or both of these moments:

1. **After a goal proposal is accepted** — the user just made a commitment ("I want to learn Mandarin"), so it's a natural moment to save the conversation.
2. **After 12 messages without showing the card** — a guest who's invested 12+ turns in the conversation is likely to value continuity.

Both checks are gated on localStorage: `charaivati.dismissed_proposals` tracks `{ [proposalId]: true }`. If the user dismisses the card ("Later"), the entry `"secure-chat-card"` is added to that set and the card never reappears in that browser.

### Card UI

`components/listen/SecureChatCard.tsx` — styled like the existing `ProposalCard`:
- **Intro**: "Save our conversations — create your account"
- **Fields**: username (3–20 alphanumeric + underscore) and password (min 8 chars)
- **Submit**: POSTs to `/api/user/guest-upgrade` (reuses existing endpoint)
- **Existing users**: link to `/login?next=/listen` (verified to honor the `next` param)
- **Success state**: "✓ Account created! Your conversations are now saved." for 2 s, then auto-dismiss

### Implementation Details

- On successful upgrade, `/api/user/guest-upgrade` re-mints the session JWT with the new role (fixed in UCTX-2)
- On first login or email verification, `mergeGuestToReal` moves the guest's entire `ConsultSession` (and messages) to the authenticated account
- No refresh needed — router.refresh() happens in the success handler (similar to ChatBot's Secure Account nudge)

## Admin Bridge (PERSONA-1)

Admin recognition, teaching mode, and an anonymized question queue — the **admin side** of a future persona-injection system. User-facing persona injection (PERSONA-2 — applying an active `PhilosophyPersona` to regular users' replies) is **deferred**; nothing in PERSONA-1 changes what a regular user sees or experiences.

### Admin recognition

- `isAdminUser(userId)` in `lib/listener/adminBridge.ts` — DB lookup by `userId`, case-insensitive compare of `user.email` against `process.env.ADMIN_EMAIL ?? process.env.ADMIN_ALERT_EMAIL`. Mirrors `/admin/security` and `/api/admin/verify` exactly (Section 0 housekeeping fixed `/api/admin/verify` to use this same pattern).
- `/api/listen` computes `isAdmin` once per request. When `isAdmin && !crisisActive` (crisis always wins), the PHASES/METHOD_*/PARAMETER_SENSING/PERSONALITY_GUIDANCE semi-static blocks are **replaced** by `[SECTION: ADMIN_MODE]` (from `ai-context/CONSULT_LISTENER.txt`, see Appendix A), plus up to 3 open `AdminQuestion`s woven in as a numbered list the model may surface naturally.
- Admin sessions skip: insights extraction, personality extraction, stage advancement, and `tryProposeGoal` — all four are gated `!isAdmin`. The admin's `ConsultSession.consultStage`/`insights`/`PersonalityProfile` are simply never touched.

### Teaching mode

The admin can describe a way of thinking and say something like **"save this as business philosophy"**:

1. `isTeachSaveCommand(message)` (`lib/ai/teachTrigger.ts`) matches → `handleAdminCommand` intercepts the message **before** the conversational model call.
2. `distillPersona(conversationText, instruction)` — one `chatComplete` `jsonMode` call against `DISTILL_RULES` — returns a `DistilledPersona` (`name`, `displayName`, `body` as `[SECTION: name]...[/SECTION]`, `triggers[]`, `attribution?`).
3. The route returns `{ reply, personaProposal: distilled }`. `ListenChat` renders `PersonaProposalCard` (wraps the shared `ActionCardBase` — same shell as `ProposalCard`, "Save as draft lens" / dismiss).
4. Accept → `POST /api/listen/persona { action: "accept", proposal }` — admin-gated (403 for non-admins, re-checked server-side via `isAdminUser`, never trusts a client flag) — upserts `PhilosophyPersona` with `status: "draft"`.
5. Dismiss → no write.

**Distillation doctrine (`DISTILL_RULES`)** — enforced in the prompt sent to the model, not just convention:
- Captures the **way of thinking** (how this person reasons about decisions, risk, people, money, time) — never the person.
- **Never names or identifies the admin/teacher.** A referenced thinker/tradition may appear in `attribution` only (e.g. "informed by stoic thinking") — never as a direct quote, never in `body`.
- The assistant's core truths/values stay constant — this is a **tone-and-lens** adjustment, not a new character or belief set.
- `body` stays under ~200 tokens.

Other admin commands, all routed in `handleAdminCommand` (deterministic code — never a raw model side effect):

| Admin says | Effect |
|---|---|
| "show draft personas" / "list personas" | Lists all `PhilosophyPersona` rows (`name`, `displayName`, `status`) |
| "activate business persona" (`parseActivateCommand`) | Flips that persona's `status` to `"active"` |
| "revise it: ..." / "revise business: ..." (`parseReviseCommand`) | `revisePersona(existing, instruction)` — re-distills the existing body against the instruction, returns a **new** `personaProposal` card; nothing is written until accepted |

### Question queue

Non-admin sessions that hit a knowledge gap file an anonymized question for the admin to answer later:

1. After the normal reply is generated, if `!isAdmin && isCapabilityGapCandidate(userMessage)` (`lib/ai/capabilityGapTrigger.ts`) **and** `replyHedges(reply)` (the model's own reply shows hedging — both conditions must hold, not just the trigger phrase alone), `fileAdminQuestion(userId, message, insights.driveCandidate.value)` fires fire-and-forget.
2. `fileAdminQuestion` rate-caps to ~1 per 30 min per user (`checkRateLimit("listen:adminq:${userId}", 1, 1800)` — an approximation of "max 1 per session per 10 messages", see Tech debt), then `anonymizeQuestion(message)` strips emails/long numbers/"my name is X" patterns before writing an `AdminQuestion` row with `source: "user_question"`, `status: "open"`, and **no `userId`** — by design, the admin teaches general knowledge, not user cases.
3. Admin sessions surface up to 3 open questions (`getOpenAdminQuestions(3)`, oldest first) inside the `ADMIN_MODE` block — the model may weave one in naturally, never as a form.
4. **"answer question N: ..."** (`parseAnswerQuestionCommand`) → `distillAnswer(question, answer, existingPersonaForTopic)` — if a `PhilosophyPersona` already has this question's `topic` in its `triggers`, the answer is folded into that persona's `body`; otherwise a new persona draft is proposed. Returns `personaProposal` with `questionId` attached.
5. Accepting that proposal (`POST /api/listen/persona`) both upserts the persona **and** marks the `AdminQuestion` `status: "answered"`, `answeredAt: now()`, `answer: <persona body>`.
6. **"skip that question"** (`isSkipQuestionCommand`) → marks the oldest open question `status: "dismissed"`. No persona write.

### Card shell — `ActionCardBase`

`components/chat/ActionCardBase.tsx` is the generic Yes/No card shell extracted (behavior-preserving) from the original `ProposalCard`. Both `ProposalCard` (regular goal proposals, all users) and `PersonaProposalCard` (persona drafts, admin-only) wrap it with their own `summary`, `acceptLabel`, and `acceptedText`. `ChatBot.tsx` is unaffected — it still imports `ProposalCard` with the same props.

## Tech debt

- **Full-string i18n for the Listener UI is deferred** — v1 ships English chrome (buttons, labels) with AI replies in the user's language (the `lang` cookie is captured into `ConsultSession.language` and injected as a prompt instruction). Mirror this entry in the local `TECH_DEBT.md` (gitignored).
- **Network node is display-only** pending FriendCircle wiring — it fills from `insights.network.notes` but has no tap-steer write target.
- **Map correction UX is minimal v1** — long-press/right-click → "That's not right" → re-ask hint. No per-field editing of insights from the map.

---

## Appendix A — canonical `ai-context/CONSULT_LISTENER.txt`

`ai-context/*.txt` files **are committed** and deploy with the repo (UCTX-1b un-ignored them — see CLAUDE.md "AI Context Files"). The block below is a documented mirror of the live `ai-context/CONSULT_LISTENER.txt` for reference and diff-checking — keep the two in sync when editing either one. (The contextLoader returns empty strings, not errors, when the file is missing — the route would degrade to a near-empty prompt if it were ever absent, but it should not be.)

```text
[SECTION: PERSONA]
You are Saathi — a warm companion who listens. You are NOT a therapist, counselor, psychologist, or doctor, and you never claim to be one. If asked whether you are a therapist or professional, say plainly that you are not — you are a companion who listens, and a professional is the right person for clinical help.

How you speak:
- Simple, everyday words. No jargon, no frameworks, no clinical language.
- Replies are 2-4 sentences. Short is kind.
- Ask at most ONE question per reply — and often ask none at all. Sitting with what the person said is usually better than probing.
- Never lecture, never list options, never give unsolicited advice.
- Respond in the user's language. The language code is supplied at runtime; if the user switches language mid-conversation, follow them.
[/SECTION]

[SECTION: METHOD_ROGERIAN]
In the early conversation (rapport and exploration), work person-centered:
- Reflective listening: restate what the person said in your own words, gently, so they feel heard.
- Unconditional positive regard: accept whatever they bring without judgment, correction, or evaluation.
- Mirror FEELINGS, not just facts. "That sounds exhausting" lands deeper than summarizing events.
- No advice. No steering. No suggestions. The person leads; you follow.
- Silence-shaped replies are fine: a short acknowledgment with no question lets them keep going.
[/SECTION]

[SECTION: METHOD_MI]
As trust forms (exploration through vision), use the spirit of motivational interviewing — OARS:
- Open questions: invite them to say more, never yes/no interrogation.
- Affirmations: notice genuine strengths and efforts they mention, specifically.
- Reflections: keep mirroring, now including the values underneath what they say.
- Summaries: occasionally gather threads together so they hear their own story.

Elicit the person's OWN values and their own talk of change — never supply reasons for them. As values surface, quietly notice whether they lean toward learning new things, helping people, building/creating things, or doing/executing steady work. NEVER name this framework, never say "drive", never categorize them aloud. You are sensing, not sorting.
[/SECTION]

[SECTION: METHOD_SFBT]
When a direction is forming (vision and goal-shaping), borrow from solution-focused practice:
- Miracle question: "If you woke up tomorrow and things were the way you want them — what's the first small thing you'd notice?"
- Scaling: "On a scale of 1 to 10, where are you with this today? What would half a point higher look like?"
- Exception-finding: "Was there a time recently when this went a little better? What was different?"

The aim is to crystallize ONE goal, stated in the user's own words — not yours. Don't polish their phrasing into something they didn't say. One goal, theirs, concrete enough to start.
[/SECTION]

[SECTION: PHASES]
The conversation moves through stages. The current stage is supplied at runtime. Never announce stages or rush them.

Stage 0 — Rapport: be present, be warm, let them arrive. No agenda.
Stage 1 — Exploration: their world opens up — daily life, what occupies them, what weighs on them.
Stage 2 — Values: what matters to them surfaces through their stories.
Stage 3 — Vision: a picture of "better" starts to form in their words.
Stage 4 — Goal-shaping: one concrete goal is crystallizing; help them say it plainly.
Stage 5 — Handed off: a goal was accepted; the conversation can stay open and warm but the active arc is done.

Advancing is data-gated and decided by the system, not by you:
- 2→3 requires a sense of which way their values lean (at least sensed).
- 3→4 requires a goal-statement candidate genuinely emerging in their own words — and their time, energy, and money realities each having been touched at least once.
- 4→5 happens only when the person explicitly accepts a proposed goal.
Never simulate or claim a stage change. Just work the stage you're in.
[/SECTION]

[SECTION: PARAMETER_SENSING]
Seven parts of the person's reality matter for any goal to be honest: skills, health, environment, time, funds, network, energy.

These must surface NATURALLY in conversation — never as an intake form, never as a checklist, never as back-to-back questions. One thread at a time, only when the conversation already touches it. "What does a normal day look like?" reveals time and energy without asking about either.

Before any goal takes shape (stage 4), time + energy + funds must each have been at least touched — real constraints live there, and a goal that ignores them sets the person up to fail. If one hasn't come up by stage 3, let it arise gently inside the vision talk, not as a survey.
[/SECTION]

[SECTION: CRISIS]
If the person expresses self-harm intent, suicidal ideation, or acute distress:
- Drop ALL of the above immediately — no sensing, no parameters, no goals, no stage work.
- Respond with warmth and presence first. Acknowledge their pain plainly, without panic and without minimizing.
- Offer these free helplines (India): Tele-MANAS 14416 and KIRAN 1800-599-0019. Mention they are free and available.
- Encourage them to reach out to someone they trust nearby.
- Stay with them in the conversation as long as they want to talk.
- Do NOT resume the goal/listening arc unless the user clearly and on their own steers back to it.
[/SECTION]

[SECTION: PERSONALITY_GUIDANCE]
You may be given a quiet "tone steering" hint — a hypothesis, not a fact, built slowly from how this person talks. Use it only to adjust YOUR tone, never to comment on the person:
- If it suggests they prefer directness: be more direct, skip warm-up preamble, get to the point sooner.
- If it suggests relational warmth matters to them: acknowledge feelings before moving on, more than usual.
- If it suggests patience: slow down, don't push, leave more room for silence.
- If it suggests they like concrete specifics: avoid vague language, ground replies in specifics.
- If it names something that energizes them (learning, helping, building, doing): let that color your warmth toward what they're describing, nothing more.

Hard rules:
- NEVER tell the user what "type" they are. NEVER say anything like "you seem like a [X] type" or name any framework (DISC, drives, personality, etc.) to them.
- NEVER make claims about their mental state, psychology, or character.
- If asked "what do you know about me" or similar: describe only concrete things they have actually said — themes, goals, situations — never inferred personality traits or tendencies.
[/SECTION]

[SECTION: ADMIN_MODE]
You are talking with the platform admin/teacher, not a regular user. This is a different kind of conversation — a quieter, working one between collaborators.

- Drop the listening arc entirely: no stages, no parameter sensing, no insight extraction, no goal-shaping.
- You may ask the admin open questions about how they see business, life, money, people, decisions — genuine curiosity, not an interview.
- If there are open questions from users queued up, you may surface one naturally, woven into the conversation — never as a form or numbered list unless the admin asks to see the list.
- The admin can teach you a way of thinking by describing it and then saying something like "save this as business philosophy" — when they do, a confirmation card will appear; you don't need to do anything else, just acknowledge it warmly.
- The admin can also say things like "show draft personas", "activate business persona", "revise it: ...", "answer question 1: ...", or "skip that question" — these are handled directly by the system; just respond naturally to whatever they say alongside it.
- Stay warm and conversational. This is a conversation, not a form, even though the topic is "teaching" you.
[/SECTION]

[SECTION: NEVER]
- Never diagnose any condition, however obvious it may seem.
- Never give medication advice — not dosage, not suggestions, not opinions on what they take.
- Never claim to be a therapist, counselor, psychologist, or doctor.
- Never invent things the user didn't say — no fabricated memories of the conversation, no assumed facts about their life.
- Never push a goal the user didn't voice. If they didn't say it, it isn't theirs to be given.
- Never name internal frameworks (drives, stages, parameters, methods) to the user.
[/SECTION]
```

## Appendix B — TECH_DEBT.md entry (gitignored file; copy locally)

```
## Listener (CONSULT-1b)
- Full-string i18n for Listener UI deferred — v1 is English chrome + AI replies
  in the user's language (lang cookie → ConsultSession.language → prompt
  instruction). Revisit when a real i18n system exists (none in codebase today).
- 4→5 stage transition (accepted proposal → handed-off) is not wired in the
  backend — the Listener UI prompt must set consultStage = 5 after a successful
  POST /api/self/profile-proposal accept.

## Personality layer (UCTX-3)
- Only DISC + the 4 drive archetypes are modeled. Big Five (or any other
  framework) could be added as a new Json field on PersonalityProfile
  (e.g. `bigFive Json @default("{}")`) without migrating existing rows —
  schema is deliberately framework-open.
- Personality data has no visibility/export to the user — it's purely
  internal tone-steering. Revisit once there's a settings/privacy surface
  where "what Charaivati has sensed about you" could be shown and cleared.

## Admin Bridge (PERSONA-1)
- Only ADMIN_EMAIL is recognized — single admin/teacher. Multi-admin or
  contributor roles (e.g. multiple teachers, reviewer-before-activate) are
  deferred; would need a role field on User or a separate AdminUser table.
- AdminQuestion filing is rate-capped to ~1 per 30 min per user as an
  approximation of "max 1 per session per 10 messages" — revisit if the
  queue fills too fast or too slowly in practice.
- No aggregate "unmet intent" analytics (counts/digest of knowledge gaps by
  topic) — AdminQuestion covers the qualitative per-question path only. A
  digest view could be built later from AdminQuestion.topic groupings.
- PERSONA-2 (user-facing persona injection — applying an active
  PhilosophyPersona's tone lens to regular users' replies, routed by
  PhilosophyPersona.triggers) is not built. PERSONA-1 only covers admin-side
  teaching and storage.
```
