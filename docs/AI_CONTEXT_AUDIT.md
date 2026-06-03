# AI Context Audit

_Last audited: 2026-06-03 (updated after three context injection fixes)_

---

## 1. What context files exist and what does each one cover?

All files live in `/ai-context/` at the project root (gitignored — not committed).

| File | Format | Loader-parseable? | What it covers |
|---|---|---|---|
| `PLATFORM.txt` | `[SECTION: name]...[/SECTION]` | ✅ Yes | Platform mission, 6-layer model, Self layer tabs, AI's role, four entry states (Lost Desire / Lost Hope / In Between / Already Driven), earning philosophy, cosmic purpose, dharma of the user, two-phase journey, irreversible rigidity model |
| `DRIVES.txt` | `[SECTION: name]...[/SECTION]` | ✅ Yes | Four drive archetypes: Seeker (Brahmin), Guardian (Kshatriya), Builder (Vaishya), Keeper (Shudra) — each with core motivation, strengths, decision lens, income paths, risk patterns, and AI tone instructions. Dual-drive combinations. |
| `RESPONSE_GUIDE.txt` | `[SECTION: name]...[/SECTION]` | ✅ Yes | Tone rules, energy gates (1–10 score → response depth), forbidden patterns, language handling for 11 Indian languages, state detection signals, micro-joy recovery path, philosophical foundation (Acharya Prashant / Osho / Alan Watts / UG Krishnamurti / Nietzsche / Zen / Vigyan Bhairav Tantra), phase detection, practical building principles |
| `INITIATIVES.txt` | `[SECTION: name]...[/SECTION]` | ✅ Yes | Initiative types (Store, Service, Education, Helping Initiative), drive-to-initiative alignment, GPS module, funding sources by initiative type, survival-to-drive migration timeline |
| `COMPANION_PHILOSOPHY.txt` | Plain markdown (`##` headers, no `[SECTION:]` blocks) | ❌ Not section-parseable | Companion system purpose, five pillars (Time / Health / Drive / Hobbies / Location), energy state computation, conversation principles (one question per exchange, announce inferences, etc.), arc stages 0–7+, what the companion is not |

---

## 2. How are they loaded?

### The loader: `lib/ai/contextLoader.ts`

All loading goes through this single file. It exports four public functions:

```ts
// Combines PLATFORM.txt + DRIVES.txt + RESPONSE_GUIDE.txt
// Returns all populated [SECTION:] blocks formatted as "## [SECTIONNAME]\ncontent"
export function loadPlatformContext(): string

// Returns raw text of INITIATIVES.txt (all sections as-is)
export function loadInitiativeContext(): string

// Returns the full raw text of any file in ai-context/
// For files without [SECTION:] blocks (e.g. COMPANION_PHILOSOPHY.txt)
export function loadRawFile(filename: string): string

// Returns a single named section from any file
export function loadSection(filename: string, sectionName: string): string
```

**How the parser works:**

1. `readRaw(filename)` — internal; reads the file from disk with `fs.readFileSync`. Path: `path.join(process.cwd(), "ai-context", filename)`.
2. `parseSections(content)` — regex `[SECTION:\s*(\w+)]([\s\S]*?)[/SECTION]` extracts named blocks.
3. `formatFile(filename)` — calls both; returns all non-empty sections as `## [SECTIONNAME]\ncontent`.
4. `loadRawFile(filename)` — public wrapper around `readRaw(filename)`; returns file as-is, no parsing.

**Cache:** Module-level `const cache: Record<string, string> = {}`. Keys are `"filename:__raw__"` (raw text) and `"filename:sectionName"` (parsed sections). Populated on first read, never evicted — persists for the lifetime of the server process. A file changed on disk will not be re-read until the server restarts.

---

## 3. How do context files reach the AI model?

### In `app/api/chat/route.ts` (the only active consumer)

The full injection chain, step by step:

```
POST /api/chat
  │
  ├─ loadPlatformContext()           // PLATFORM.txt + DRIVES.txt + RESPONSE_GUIDE.txt
  ├─ loadInitiativeContext()         // INITIATIVES.txt (raw, all sections)
  ├─ buildCompanionContext(profile)  // app/api/aiClient.ts — profile block string
  ├─ getArcInstruction(arcCtx)       // lib/companion/arcStateMachine.ts
  │   → returns { isCompanionSession, stageInstruction }
  │
  └─ systemPrompt assembled in this order (see §5 for full reconstruction):
      1. companion profile block (when arcStage > 0)
      2. stage instruction (when isCompanionSession)
      3. platform context
      4. initiative context
      5. user data block (hardcoded)
      6. companion philosophy via loadRawFile("COMPANION_PHILOSOPHY.txt") (when isCompanionSession)
      │
      └─ sent as messages[0] = { role: "system", content: systemPrompt }
          → chatCompleteWithMeta() → Ollama / OpenRouter / Groq / Vercel
```

### What is NOT injected into `/api/chat`

- **`loadSection()`** — exported, has zero callers in production code. Only in JSDoc examples and CLAUDE.md.

### In `app/api/council/route.ts`

The council route does **not** call any context loader functions. It imports `callAI` and `buildPersonaPrompt` from `lib/ai/councilPersonas.ts`. None of the five platform context files reach the Council AI.

---

## 4. Where does the companion profile get injected?

It appears as the **first segment** of the system prompt (when `arcStage > 0`), via `buildCompanionContext()` in `app/api/aiClient.ts`.

**What it produces** (when arcStage > 0):

```
--- USER COMPANION PROFILE ---
Energy state: [energyState or 'unknown']
Drive type: [primaryDrive or 'not yet discovered'] ([confirmed/inferred])
Available time: [N] hours/day, peak: [peakWindow or 'unknown']
Active hobbies: [comma-separated active hobbies or 'none recorded']
Arc stage: [number]
Health flags: [comma-separated flags or 'none noted']
--- END PROFILE ---
```

**When arcStage === 0 or no profile exists**, returns `""` — nothing is emitted.

The arc stage instruction from `getArcInstruction()` follows immediately after this block (when `isCompanionSession` is true), before the platform context.

---

## 5. Full reconstructed system prompt for a logged-in user in companion mode

Assuming: platform context files are non-empty, user has drives/goals, companion profile exists with arcStage > 0, `isCompanionSession = true`.

```
--- USER COMPANION PROFILE ---
Energy state: grounded
Drive type: Builder (confirmed)
Available time: 2 hours/day, peak: evening
Active hobbies: cooking, woodworking
Arc stage: 3
Health flags: none noted
--- END PROFILE ---

--- COMPANION SESSION INSTRUCTION ---
You are trying to understand what drives this person. Ask ONE of these: What is something
they did recently that felt meaningful? When life is going well, what are they doing?
After 2 exchanges, announce your inference: 'You sound like a [Type] to me — [one sentence
description]. Does that feel right?' Types: Seeker (drawn to understanding and depth),
Guardian (protects and cares for others), Builder (creates and ships things), Keeper (manages
and sustains systems and resources).
--- END INSTRUCTION ---

--- PLATFORM CONTEXT ---
## [MISSION]
Charaivati (चरैवेति) means "keep moving" — a Vedic exhortation...
[... all non-empty sections from PLATFORM.txt ...]

## [OVERVIEW]
Users select 1 or 2 driving forces from 4 archetypes...
[... all non-empty sections from DRIVES.txt ...]

## [TONE_RULES]
1. Always personalise — use the user's drive...
[... all non-empty sections from RESPONSE_GUIDE.txt ...]
--- END CONTEXT ---

--- INITIATIVE CONTEXT ---
[SECTION: overview]
Initiatives are how users earn within Charaivati...
[... full raw text of INITIATIVES.txt ...]
--- END CONTEXT ---

You are Charaivati Guide. Help the user move forward in their life with clarity and purpose.
You know this about the user:

Drives: Builder, Keeper
Active goals: Launch snack store; Improve delivery speed
Energy score: 65/100
Active initiatives: My Snack Store (store)
Current section: Self

Charaivati has 6 layers: Self → Society → State → Nation → Earth → Universe.
Speak like a wise, grounded mentor. Keep replies concise (3-5 sentences max unless the user asks for detail).
Always connect advice back to the user's own drives and goals.
Never give generic motivational quotes. Be specific to what you know about them.

--- COMPANION PHILOSOPHY ---
# COMPANION_PHILOSOPHY.txt
[... full raw text of COMPANION_PHILOSOPHY.txt ...]
--- END PHILOSOPHY ---
```

**For a regular (non-companion) session** the prompt is identical except:
- Companion profile block still appears when arcStage > 0
- Stage instruction block is absent
- Companion philosophy block is absent

---

## 6. Gaps: files on disk not referenced, or functions with zero callers

### Resolved by the three fixes

| Gap | Status |
|---|---|
| `COMPANION_PHILOSOPHY.txt` not loaded | **Fixed** — `loadRawFile("COMPANION_PHILOSOPHY.txt")` called when `isCompanionSession` |
| `INITIATIVES.txt` / `loadInitiativeContext()` never called | **Fixed** — called alongside `loadPlatformContext()` for all chats |
| Arc stage instruction never reached AI | **Fixed** — `getArcInstruction()` called in `chat/route.ts`; `stageInstruction` injected when `isCompanionSession` |

### Remaining gaps

- **`loadSection()`** — exported, zero callers in production code. Utility function for future use.
- **Council route** — still completely isolated from all context files. The Council AI has no knowledge of platform philosophy, drives, or companion state. This is a separate gap, not addressed by these fixes.
- **COMPANION_PHILOSOPHY.txt format** — still plain markdown (no `[SECTION:]` blocks). It is now loaded via `loadRawFile()` which reads it as-is. If section-level granularity is needed later (e.g., injecting only the "conversation principles" section), the file will need to be reformatted with `[SECTION:]` blocks and the loader call updated.
