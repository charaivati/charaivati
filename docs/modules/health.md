---
module: health
type: api + component
source: app/api/health-business/, app/api/ai/generate-health-plan, app/api/ai/health-consult, components/health/
depends_on: [database, auth, pages]
used_by: [navigation-tabs]
stability: evolving
status: active
---

# Module: Health

## Purpose
Enables users to connect with expert health practitioners who publish `HealthBusiness` pages. Practitioners can offer tiered subscriptions, log advice, and deliver AI-assisted consultations. Users track personal health metrics in their `Profile` and can subscribe to experts with explicit consent.

## Responsibilities
- Health business page creation and management (linked to `Page`)
- Expert subscription with tiered access and consent tracking
- Advice logging (manual or AI-delivered)
- AI health consultation chat
- AI-generated health and meal plans
- Personal health metric storage on `Profile` (steps, sleep, water, weight)

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session |
| In | Health business metadata (specialty, credentials, consultation mode, tiers) |
| In | Subscription request with tier and consent fields |
| In | Consultation messages |
| Out | `HealthBusiness` page record |
| Out | `ExpertSubscription` record |
| Out | `ExpertAdviceLog` record |
| Out | AI-generated health plan or meal plan text |

## Dependencies
- **auth** — all health operations are user-scoped
- **database** — HealthBusiness, ExpertSubscription, ExpertAdviceLog models
- **pages** — HealthBusiness is always a sub-model of a `Page` (`pageType: 'health-business'`)
- **AI provider** — health consultation and plan generation (TODO: identify provider)

## Reverse Dependencies (what breaks if this changes)
- `ExpertSubscription.consentGranted` and `consentFields` are the legal basis for data sharing between user and practitioner. Removing or bypassing this check exposes user health data without consent — a compliance and legal risk.
- `ExpertAdviceLog.userStateSnapshot` stores a point-in-time copy of user health data. If the snapshot schema changes, existing logs become uninterpretable without a migration.
- `HealthBusiness.tiers` is stored as JSON. If the tier structure changes, subscription UI and access gating logic must be updated in sync.
- `HealthBusiness.agentConfig` is JSON. If AI agent behavior is configured here, changes to the schema affect how the AI responds to health consultations.

## Runtime Flow

### Practitioner setup
1. User creates a `Page` with `pageType: 'health-business'` via `POST /api/pages` or dedicated route
2. API creates linked `HealthBusiness` record with specialty, credentials, tiers, and agentConfig
3. Practitioner configures subscription tiers and consent requirements

### User subscribing
1. User views a health business page
2. User selects a tier and reviews consent fields
3. Client POSTs to `POST /api/pages/[id]/subscribe` with tier + consent
4. API creates `ExpertSubscription` with `consentGranted: true` and `consentFields`
5. User gains access to tier-gated content

### AI health consultation
1. Subscribed user opens consultation chat
2. Client POSTs messages to `POST /api/ai/health-consult`
3. API constructs prompt with user's `Profile` health data + HealthBusiness `agentConfig`
4. Returns AI response

### Health plan generation
1. Client POSTs to `POST /api/ai/generate-health-plan`
2. API reads user's health profile metrics
3. Returns structured plan (TODO: confirm whether plan is saved to `Profile.aiPlan`)

### Meal plan regeneration
1. Client POSTs to `POST /api/ai/regenerate-meal`
2. API generates a replacement meal plan for a specific slot
3. TODO: Confirm where regenerated meals are saved

## Key API Routes

| Method | Route | Action |
|---|---|---|
| POST | /api/health-business/create | Create health business page |
| GET | /api/health-business/[id]/subscribers | List subscribers |
| POST | /api/health-business/advice | Log advice for a subscriber |
| POST | /api/health-business/suggestions | Get AI suggestions for practitioner |
| GET | /api/health/my-experts | Current user's subscribed experts |
| POST | /api/ai/health-consult | AI consultation chat |
| POST | /api/ai/generate-health-plan | Generate health plan |
| POST | /api/ai/regenerate-meal | Regenerate a meal slot |

## Key Components

| Component | Role |
|---|---|
| `components/health/ConsentModal.tsx` | Consent confirmation before subscribing to an expert |
| `components/health/EditHealthModal.tsx` | Edit personal health metrics (weight, sleep, steps, water) |

## Database Models Used
- `HealthBusiness` — practitioner page: specialty, credentials, consultationMode, tiers (JSON), agentConfig (JSON)
- `ExpertSubscription` — user ↔ expert: tier, status, consentGranted, consentFields
- `ExpertAdviceLog` — consultation record: userStateSnapshot (JSON), advice, adviceType (`manual | ai`), outcomeSnapshot

## Risks & Fragile Areas
- Health data is personally sensitive. Any logging, caching, or exposure of `ExpertAdviceLog.userStateSnapshot` outside of the intended parties is a privacy violation.
- `ExpertSubscription.consentGranted` must be `true` before any health data is shared with a practitioner. Do not add shortcuts or admin overrides that bypass this check.
- AI health consultations use user health data as prompt context. Ensure prompt construction does not include data outside the consented fields.
- `HealthBusiness.tiers` and `agentConfig` are untyped JSON. Malformed values can silently break subscription gating and AI behavior.
- TODO: Confirm whether `ExpertSubscription` has a cancellation or expiry mechanism.

## Backlinks
- [[pages.md]] — HealthBusiness as a Page sub-model
- [[database.md]] — model definitions
- [[auth.md]] — session required; consent is per-user
- [[user.md]] — Profile.health metrics used in consultations
