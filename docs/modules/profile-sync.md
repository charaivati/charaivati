# Chat → Profile Sync

The companion chat can propose small, additive updates to the user's `Self`
profile (a drive, a goal, or a health flag) based on what it has learned in
conversation. Proposals are never applied automatically — the user always
sees a Yes/No card first.

## Architecture

```
app/api/chat/route.ts
   └─ after generating `reply`, computes at most ONE ProfileProposal:
        1. buildProfileProposal()  — synchronous, signal-based
        2. tryProposeGoal()        — async, AI-based (only if #1 returned null)
   └─ returns { ..., proposal?: ProfileProposal }

components/chat/ChatBot.tsx
   └─ renders a Yes/No card under the assistant message that carries `proposal`
        - "Yes, add it"  → POST /api/self/profile-proposal { proposal }
                              → applyProfileProposal() writes to Profile
                              → dispatches `charaivati:profile-updated`
        - "No thanks"    → addDismissedProposal(proposal.id) (localStorage)
                              → sent back as context.dismissedProposals on
                                future turns so the same thing is never
                                re-proposed in this browser
```

All logic for building and applying proposals lives in
`lib/companion/profileSync.ts`.

## Proposal types

`ProfileProposal` is a discriminated union on `type`:

```ts
export type ProfileProposal =
  | { id: string; type: "drive";  summary: string; payload: { driveType: DriveType } }
  | { id: string; type: "goal";   summary: string; payload: { driveType: DriveType; statement: string; description: string } }
  | { id: string; type: "health"; summary: string; payload: { field: "sleepQuality" | "stressLevel"; value: string; label: string } };
```

- `DriveType` = `"learning" | "helping" | "building" | "doing"`.
- `id` is a stable string used for de-duplication and dismissal tracking
  (`"drive:learning"`, `"goal:learning"`, `"health:sleepQuality"`,
  `"health:stressLevel"`).
- `summary` is the human-readable sentence shown on the card. For drive/health
  proposals it's built from static templates; for goal proposals it comes
  from the AI (`tryProposeGoal`).

## `buildProfileProposal()` — signal-based, synchronous

`buildProfileProposal({ profile, companionProfile, dismissed, isCompanionSession })`

Returns `null` immediately if `!isCompanionSession || !companionProfile` —
proposals only fire during companion sessions (see
`lib/companion/arcStateMachine.ts` / `getArcInstruction()`).

Checks, **in order**, returning the first match:

1. **Drive proposal** — if `companionProfile.driveConfirmedByUser` is true and
   `companionProfile.primaryDrive` is set, maps the drive *signal*
   (`Seeker | Guardian | Builder | Keeper`) to a `DriveType` via
   `DRIVE_SIGNAL_TO_TYPE`:
   | Signal | DriveType |
   |---|---|
   | Seeker | learning |
   | Guardian | helping |
   | Builder | building |
   | Keeper | doing |

   Skipped if the user's `profile.drives` already contains that `DriveType`,
   or if `"drive:<type>"` is in `dismissed`.

2. **Health — sleep quality** — if `companionProfile.healthFlags` includes
   `"poor_sleep"` or `"fatigue"` and `profile.health.sleepQuality !== "bad"`.
   `id = "health:sleepQuality"`.

3. **Health — stress level** — if `healthFlags` includes `"stress"` and
   `profile.health.stressLevel !== "High"`. `id = "health:stressLevel"`.

If none of these match, `buildProfileProposal()` returns `null` and the route
falls through to `tryProposeGoal()`.

## `tryProposeGoal()` — AI-based, async

`tryProposeGoal({ profile, companionProfile, dismissed, conversationText })`

Only runs if `buildProfileProposal()` returned `null` **and**
`isCompanionSession` is true. Requires
`companionProfile.driveConfirmedByUser && companionProfile.primaryDrive` (same
gate as the drive proposal — a goal needs a confirmed drive to attach to).

- `id = "goal:<driveType>"`. Skipped if dismissed, or if the user already has
  a goal entry under that drive type.
- Calls `chatComplete({ model: SKILLS_MODEL, maxTokens: 150, jsonMode: true })`
  with the full conversation text, asking for:
  ```json
  { "hasGoal": boolean, "statement": "...", "description": "..." }
  ```
- If `hasGoal` is false (or the call fails), returns `null` — silent, no
  proposal that turn.
- On success, `statement` is capped at 200 chars, `description` at 500 chars.
  `SKILLS_MODEL` defaults to `"openai/gpt-4o-mini"` (env: `SKILLS_AI_MODEL`).

## One-proposal-per-turn rule

`app/api/chat/route.ts` computes proposals **after** the reply is generated,
in this exact order:

```ts
let proposal = buildProfileProposal({ profile, companionProfile, dismissed, isCompanionSession });
if (!proposal && isCompanionSession) {
  proposal = await tryProposeGoal({ profile, companionProfile, dismissed, conversationText });
}
if (proposal) responsePayload.proposal = proposal;
```

At most one `proposal` field is ever present on a chat response. If the
synchronous signal-based check finds something, the AI-based goal check is
skipped entirely for that turn (saves a cloud call). This keeps the pacing
deliberate — the user is never shown more than one Yes/No card per message.

## `dismissedProposals` — localStorage mechanism

Client-side only, in `components/chat/ChatBot.tsx`:

- **Key**: `charaivati.dismissed_proposals`
- **Shape**: JSON array of proposal `id` strings (e.g.
  `["drive:learning", "health:sleepQuality"]`)
- **Cap**: `MAX_DISMISSED_PROPOSALS = 50` — oldest entries are dropped
  (`[...current.filter(x => x !== id), id].slice(-50)`)
- `getDismissedProposals()` reads and parses the array, returning `[]` on any
  error (missing key, corrupt JSON, localStorage unavailable)
- `addDismissedProposal(id)` appends (de-duplicating) and writes back,
  swallowing any write errors

Every chat request sends the current list as
`context.dismissedProposals` so the server-side builders can skip anything
the user has already said "No thanks" to — **for the lifetime of that
browser's localStorage**, not server-persisted. Clearing site data resets
dismissals.

Accepting a proposal does **not** add it to `dismissedProposals` — once
applied, `buildProfileProposal()`'s own "already present" checks (drive
already in `profile.drives`, goal already exists for that drive, health field
already at the proposed value) naturally prevent re-proposing it.

## `charaivati:profile-updated` event

When a proposal is accepted and `applyProfileProposal()` succeeds,
`ChatBot.tsx` dispatches:

```ts
window.dispatchEvent(new CustomEvent("charaivati:profile-updated", {
  detail: profile, // the updated Profile object: { drives, goals, health, generalSkills }
}));
```

Any component that displays profile data (drives list, goals list, health
panel) should listen for this event and refresh its local state without a
full page reload — this is the only cross-component signal for "the AI just
changed your profile in the background." There is no payload contract beyond
`detail` being the same shape `applyProfileProposal()` returns.

## `POST /api/self/profile-proposal`

`app/api/self/profile-proposal/route.ts` — applies an accepted proposal.

**Auth**: `getServerUser(req)` — 401 if not logged in.

**Request body**: `{ proposal: ProfileProposal }`

**Validation (added in CHAT-FIX-1)** — all AI-sourced fields are checked
before being passed to `applyProfileProposal()`:

| Check | Failure response |
|---|---|
| `proposal` is an object with `type` and `payload` | `400 { error: "Invalid proposal" }` |
| `proposal.type` is one of `"drive" \| "goal" \| "health"` | `400 { error: "Invalid proposal type" }` |
| `type === "health"` → `payload.field` is `"sleepQuality"` or `"stressLevel"` | `400 { error: "Invalid health field" }` |
| `type === "drive" \| "goal"` → `payload.driveType` is one of `"learning" \| "helping" \| "building" \| "doing"` | `400 { error: "Invalid drive type" }` |
| `type === "goal"` → `payload.statement` is a non-empty string | `400 { error: "Invalid goal statement" }` |

These checks exist because `payload` ultimately originates from an LLM
response (`tryProposeGoal`'s JSON, or signal-derived values) — before
CHAT-FIX-1 these fields were passed to `applyProfileProposal()` unchecked.

**Success**: `200 { ok: true, profile }` — `profile` is
`{ drives, goals, health, generalSkills }` as returned by
`applyProfileProposal()`.

**Failure**: `500 { error: "Failed to apply proposal" }` if the DB write
throws (logged server-side).

## `applyProfileProposal(userId, proposal)`

`lib/companion/profileSync.ts` — performs the actual `Profile` write via
`db.profile.upsert()`.

- `type === "drive"`: appends `driveType` to `profile.drives` (if not already
  present) and sets `profile.drive = drives[0] ?? null`.
- `type === "health"`: merges `{ [field]: value }` into `profile.health`.
- `type === "goal"`: calls `suggestSkillsFor(statement)` (another
  `chatComplete` call, `maxTokens: 300`, asks for 3-5
  `{ name, level, monetize }` skill suggestions, validates `level` against
  `"Beginner" | "Intermediate" | "Advanced"`, defaulting to `"Beginner"`),
  then builds a new goal entry:
  ```ts
  { id: "g" + randomUUID().replace(/-/g, "").slice(0, 20),
    statement, description, driveType,
    linkedBusinessIds: [], saved: true }
  ```
  and appends it to `profile.goals`, also updating `drives`/`drive` as in the
  drive case.

Returns `{ drives, goals, health, generalSkills }` — the shape sent back to
the client and broadcast via `charaivati:profile-updated`.
