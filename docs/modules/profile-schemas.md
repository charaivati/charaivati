---
module: profile-schemas
type: reference
source: types/self.ts, prisma/schema.prisma (Profile model), app/api/user/profile/route.ts
depends_on: [database, user]
used_by: [goals-ai, health, timeline, navigation-tabs]
stability: evolving
status: active
---

# Profile JSON Field Schemas

The `Profile` model stores several `Json?` fields whose shapes are not enforced at the
database level. This document records the canonical TypeScript types, the validation that
actually executes on write, and which routes touch each field.

**Canonical type file:** `types/self.ts`
**Primary read/write route:** `GET` / `PATCH /api/user/profile`

All five fields are optional (`Json?` in Prisma). A profile row may not exist at all for a
new user — the PATCH route uses `upsert`.

---

## 1. `drives`

### Shape
```ts
// types/self.ts
type DriveType = "learning" | "helping" | "building" | "doing";

// Profile.drives is:
DriveType[]  // e.g. ["learning", "building"]
```

### What It Is
An array of the user's selected "drives" — motivational archetypes. The UI enforces a
maximum of 1–2 selected at a time. There is also a legacy scalar column `Profile.drive`
(a single `String?`) kept in sync with `drives[0]`.

### Validation on Write
The PATCH route explicitly validates drive values:
```ts
const VALID_DRIVES = new Set(["learning", "helping", "building", "doing"]);
drives = rawDrives.filter(d => VALID_DRIVES.has(d));
patch.drive = drives[0] ?? null;  // legacy scalar kept in sync
```
Invalid strings are silently dropped. Empty arrays are accepted. The legacy `drive` field
is always updated to match `drives[0]`.

### Routes That Read/Write

| Method | Route | Notes |
|---|---|---|
| GET | /api/user/profile | Returns full `profile` object including `drives` |
| PATCH | /api/user/profile | Accepts `body.drives` (array) or `body.drive` (string or array) |

### Legacy Notes
`body.drive` (string) is accepted and coerced to `[drive]`. `body.drive` (array) is also
accepted. New code should always send `body.drives` as an array.

---

## 2. `goals`

### Shape
```ts
// types/self.ts

type SkillEntry = {
  id: string;
  name: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  monetize: boolean;
};

type Phase = {
  id: string;
  name: string;
  duration: string;
  actions: string[];
};

type DayPlan = {
  day: string;   // e.g. "Monday"
  tasks: string[];
};

type Suggestion = {
  id: string;
  text: string;
  type: "skill" | "health" | "network" | "execution";
  priority: "low" | "medium" | "high";
};

type AIRoadmap = {
  phases: Phase[];
  suggestions: Suggestion[];
  weekPlans?: Record<string, DayPlan[]>;  // keyed by `${phaseId}-${availableDays}`
  fallback?: boolean;
};

type GoalEntry = {
  id: string;
  driveId: DriveType;
  statement: string;
  description: string;
  skills: SkillEntry[];
  linkedBusinessIds: string[];
  saved: boolean;
  plan?: AIRoadmap | null;
};

// Profile.goals is:
GoalEntry[]
```

### What It Is
A flat array of all the user's goals across all drives. Each goal carries its `driveId` so
it can be filtered by drive in the UI. Each goal optionally carries an AI-generated roadmap
in its `plan` field. The array is capped at 20 entries.

### Validation on Write
The PATCH route sanitizes the array but does **not** validate `plan` at all:

```ts
// Validated:
id: String(g.id).slice(...)           // cast to string
driveId: must be in VALID_DRIVES      // defaults to "learning" if invalid
statement: String(...).slice(0, 500)  // 500 char cap
description: String(...).slice(0, 2000)  // 2000 char cap
saved: Boolean(g.saved)
skills: validated per-entry (name ≤100, level must be "Beginner"/"Intermediate"/"Advanced")
linkedBusinessIds: String[] cast, capped at 20

// NOT validated (passed through as-is):
plan: any object is accepted verbatim
```

The local `GoalEntry` type in the PATCH handler also declares a `horizon: string` field but
the output mapping does NOT write `horizon`. A `horizon` field sent in the request body is
silently dropped.

### Routes That Read/Write

| Method | Route | Notes |
|---|---|---|
| GET | /api/user/profile | Returns full `profile` including `goals` array |
| PATCH | /api/user/profile | Replaces entire `goals` array (max 20 entries) |
| POST | /api/ai/generate-timeline | Generates `AIRoadmap`; caller writes result back via PATCH |
| POST | /api/ai/generate-week-plan | Generates `DayPlan[]`; stored in `goals[n].plan.weekPlans` |
| POST | /api/goal-ai/reflect | Provides reflection on a goal; TODO: confirm whether it writes back |

### Notes
- `goals` is **replaced in full** on every PATCH. There is no merge — send the entire array.
- `plan` is any object; no structural validation. A malformed AI response is stored verbatim.
- `weekPlans` keys use the format `"${phaseId}-${availableDays}"` to cache multiple week
  variants without regenerating.

---

## 3. `health`

### Shape
```ts
// types/self.ts

type MealCard = {
  id: string;
  meal: "Breakfast" | "Lunch" | "Snack" | "Dinner";
  name: string;
  ingredients: string[];
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  prep_minutes: number;
};

type AIHealthPlan = {
  meals: MealCard[];
  health_targets: {
    target_bmi: number;
    target_body_fat_pct: number | null;
    daily_calories_kcal: number;
    notes: string;
    insight?: string;
  };
  mealAlternatives?: Record<string, MealCard[]>;  // keyed by MealCard.id
  fallback?: boolean;
};

type FrequencyType = "daily" | "few_per_week" | "weekly" | "rarely";
type JoySection = { types: string[]; frequency: FrequencyType };
type JoyProfile = {
  hobbies: JoySection;
  sports:  JoySection;
  social:  JoySection;
  rest:    JoySection;
};

type HealthProfile = {
  // Required (sanitized on write)
  food: string;               // e.g. "Vegetarian", "Non-vegetarian"
  exercise: string;           // e.g. "Mixed", "Cardio"
  sessionsPerWeek: number;    // 1–7, clamped
  heightCm: string;           // stored as string from form input
  weightKg: string;           // stored as string from form input
  age: string;                // stored as string from form input

  // Optional extended fields
  sleepQuality?: "bad" | "moderate" | "good";
  mood?: "😞" | "😐" | "🙂" | "😄";
  stressLevel?: "Low" | "Mid" | "High";
  bodyFatPct?: string;
  waistCm?: string;
  hipCm?: string;
  bicepCm?: string;
  chestCm?: string;
  medicalConditions?: string;
  healthIssues?: string[];
  focusClarity?: "Low" | "Mid" | "High";
  socialInteraction?: "Low" | "Mid" | "High";
  energyLevel?: "Low" | "Mid" | "High";
  availableFoods?: string[];
  joy?: JoyProfile;

  // AI-generated subfields (stored embedded in health)
  healthPlan?: AIHealthPlan | null;
  healthPlanGeneratedAt?: string | null;  // ISO date string
};

// Profile.health is:
HealthProfile
```

### Important: Duplicate height/weight Fields
`heightCm` and `weightKg` exist in **two places** on `Profile`:
- `Profile.heightCm: Int?` and `Profile.weightKg: Float?` — typed scalar columns, the
  validated numeric store
- `Profile.health.heightCm: string` and `Profile.health.weightKg: string` — raw string
  inputs from the form, stored inside the JSON blob

The schema comment on the `health` field states: *"heightCm / weightKg here are string inputs
from the form; the scalar heightCm / weightKg columns above are the validated numeric store."*
These are not kept in sync automatically. The profile PATCH route only writes the JSON blob;
the scalar columns are updated separately (TODO: confirm which route updates the scalar columns).

### Validation on Write
The PATCH route uses a spread-then-override pattern — unknown fields are preserved:
```ts
patch.health = {
  ...h,                                           // all unknown fields pass through untouched
  food:            String(h.food || "Vegetarian").slice(0, 50),
  exercise:        String(h.exercise || "Mixed").slice(0, 50),
  sessionsPerWeek: Math.min(Math.max(Number(h.sessionsPerWeek) || 3, 1), 7),
  heightCm:        String(h.heightCm || "").slice(0, 10),
  weightKg:        String(h.weightKg || "").slice(0, 10),
  age:             String(h.age || "").slice(0, 5),
};
```
Only 6 fields are sanitized. All other `HealthProfile` fields — including `healthPlan`,
`mood`, `joy`, `medicalConditions` — are stored verbatim with no validation.

### Routes That Read/Write

| Method | Route | Notes |
|---|---|---|
| GET | /api/user/profile | Returns `profile.health` |
| PATCH | /api/user/profile | Replaces entire `health` object (spread + sanitize 6 core fields) |
| POST | /api/ai/generate-health-plan | Generates `AIHealthPlan`; caller writes back via PATCH with `healthPlan` embedded |
| POST | /api/ai/regenerate-meal | Regenerates one `MealCard`; stored in `health.healthPlan.meals` or `mealAlternatives` |
| POST | /api/ai/health-consult | Reads `health` as context for consultation prompt |

---

## 4. `aiPlan`

### Shape
```ts
// types/self.ts — same AIRoadmap type as goals[n].plan

type AIRoadmap = {
  phases: Phase[];
  suggestions: Suggestion[];
  weekPlans?: Record<string, DayPlan[]>;
  fallback?: boolean;
};

// Profile.aiPlan is:
AIRoadmap
```

### What It Is
A **top-level cached AI roadmap** for the user as a whole — distinct from `goals[n].plan`
which is per-goal. The schema comment calls it "Cached AI roadmap — { phases, suggestions }".

This is a separate field from `goals[n].plan`. A user has one `aiPlan` (global) and
potentially one `plan` per `GoalEntry` (per-goal).

### Validation on Write
No structural validation. The PATCH route accepts any object:
```ts
if ("aiPlan" in body && body.aiPlan && typeof body.aiPlan === "object") {
  patch.aiPlan = body.aiPlan;
}
```
Only checks that the value is a non-null object. Shape is not verified.

### Routes That Read/Write

| Method | Route | Notes |
|---|---|---|
| GET | /api/user/profile | Returns `profile.aiPlan` |
| PATCH | /api/user/profile | Accepts `body.aiPlan`; replaces the entire field |

TODO: Confirm which AI route generates and writes `aiPlan` at the top level. The per-goal
`goals[n].plan` is generated by `/api/ai/generate-timeline`, but it is unclear whether
`Profile.aiPlan` is separately generated, a copy of a specific goal's plan, or a legacy
field no longer written by current code. No write path to `aiPlan` was found outside of
the generic PATCH route.

---

## 5. `weekSchedule`

### Shape
```ts
// types/self.ts

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

type TimeSlot = {
  id: string;
  day: DayKey;
  startHour: number;    // 0–23
  endHour: number;      // 0–23
  goalId: string;       // links to a GoalEntry.id
  activity: string;     // display label
  isFlexible: boolean;
};

type Task = {
  id: string;
  title: string;
  done: boolean;
  day: DayKey;
  goalId?: string;      // optional link to a GoalEntry.id
};

type WeekSchedule = {
  slots: TimeSlot[];
  tasks: Task[];
};

// Profile.weekSchedule is:
WeekSchedule
```

### What It Is
The user's weekly time schedule. `slots` are fixed blocks on the calendar (linked to a goal).
`tasks` are to-do items assigned to a day (optionally linked to a goal). Both reference
goals by `GoalEntry.id`.

### Validation on Write
Minimal validation — only checks that `slots` and `tasks` are arrays:
```ts
patch.weekSchedule = {
  slots: Array.isArray(ws.slots) ? ws.slots : [],
  tasks: Array.isArray(ws.tasks) ? ws.tasks : [],
};
```
Individual slot and task objects are passed through with no field-level validation. Invalid
`day` keys, non-integer hours, and missing `id` fields are accepted silently.

### Default Value
`useSelfState.ts` initializes this field to `{ slots: [], tasks: [] }` for new users.

### Routes That Read/Write

| Method | Route | Notes |
|---|---|---|
| GET | /api/user/profile | Returns `profile.weekSchedule` |
| PATCH | /api/user/profile | Accepts `body.weekSchedule`; validates only that `slots`/`tasks` are arrays |
| POST | /api/ai/generate-week-plan | Generates schedule suggestions; TODO: confirm whether result is written back via PATCH automatically or returned for the client to save |
| POST | /api/self/optimize-schedule | Takes goals and current slots; returns optimization suggestions; TODO: confirm write behavior |

---

## Cross-Cutting Notes

### All five fields are written via a single PATCH
`PATCH /api/user/profile` accepts all five fields in one request body. The route does a
partial update — only fields present in the body are applied. Fields absent from the body
are left unchanged.

```
PATCH /api/user/profile
{ drives, goals, health, aiPlan, weekSchedule }
→ upsert on Profile.userId
```

### The PATCH route uses upsert
If no `Profile` row exists for the user, the PATCH creates one. This means a user's first
profile write creates the row.

### `goals` replaces the entire array on every PATCH
There is no merge endpoint. To update a single goal, the client must read the full goals
array, mutate the target entry, and write the entire array back.

### Client-side persistence for unauthenticated users
`useSelfState.ts` falls back to `localStorage` for unauthenticated (guest) users with a
7-day TTL. The same field names and shapes are used in `localStorage` as in the DB.

### Validation asymmetry in `health`
`health` uses a spread-first approach: unknown fields are stored verbatim. `goals` uses
an explicit allowlist: unknown fields on a `GoalEntry` are dropped. These two approaches
are inconsistent — code that adds new fields to `HealthProfile` does not need to touch the
route, but code that adds new fields to `GoalEntry` must update the PATCH mapping.

### `horizon` is a ghost field
The profile route's local `GoalEntry` type includes `horizon: string` but the PATCH mapping
does not write it. `types/self.ts`'s `GoalEntry` does not include `horizon`. Any `horizon`
value submitted in `body.goals[n].horizon` is silently dropped.

---

## Summary Table

| Field | Canonical Type | Validated | Pass-through | Array capped |
|---|---|---|---|---|
| `drives` | `DriveType[]` | Yes — invalid values dropped | No | No |
| `goals` | `GoalEntry[]` | Partial — shape enforced, `plan` not | No | 20 entries |
| `health` | `HealthProfile` | 6 core fields only | Yes — all others pass through | No |
| `aiPlan` | `AIRoadmap` | Not-null object check only | Yes | No |
| `weekSchedule` | `WeekSchedule` | Arrays confirmed only | Yes — slot/task fields pass through | No |

## Backlinks
- [[database.md]] — Profile model definition
- [[user.md]] — profile update flow
- [[goals-ai.md]] — generates goals[n].plan and possibly aiPlan
- [[health.md]] — generates and reads health.healthPlan
- [[START_HERE.md]] — Profile JSON fields flagged as undocumented risk
