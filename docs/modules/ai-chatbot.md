---
module: ai-chatbot
type: api + component
source: app/api/chat/route.ts, components/chat/ChatBot.tsx
depends_on: [auth, database]
used_by: [root-layout]
stability: stable
status: active
---

# Module: AI Chatbot (Charaivati Guide)

## Purpose
A floating chat widget powered by a locally-running Ollama LLM. Shown on every page to logged-in users. Acts as a personal guide that speaks to the user's drives, goals, and energy level rather than giving generic advice.

## Responsibilities
- Render a floating chat bubble (bottom-right) that opens a 380×520 dark panel
- Send authenticated POST requests to `/api/chat` with the user's message and conversation history
- Display typing indicator while waiting for the model response
- Accept an optional `currentSection` prop so parent pages can tell the chatbot which layer the user is in
- Keep conversation history in React state only (no DB persistence)

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session (cookie) |
| In | `{ message, context: { currentSection? }, conversationHistory[] }` POST body |
| Out | `{ reply: string }` on success |
| Out | `{ reply: string, _fallback: true }` when Ollama is unreachable |

## API Route: `POST /api/chat`

**Auth**: manual — `getTokenFromRequest(req)` + `verifySessionToken(token)`. Returns 401 if unauthenticated.

**Server-side data loaded** (never trusted from client):
- `User.drives` — DriveType[] JSON array
- `Profile.goals` — GoalEntry[] JSON array
- `Profile.stepsToday`, `Profile.sleepHours` — used to derive `energyScore` (0–100)
- `Page[]` — up to 5 active pages owned by the user (title + pageType)

**energyScore derivation**: `round((steps/10000)*40 + (sleep/8)*40 + 20)`, capped at 100. Defaults to 50 if no health data exists.

**System prompt**: personalised with drives, goals, energyScore, initiative titles, and currentSection. Instructs the model to be concise (3–5 sentences), grounded, and specific — no generic quotes.

**Ollama call**: `POST {OLLAMA_URL}/api/chat` with `stream: false`. Full message array: `[system, ...conversationHistory, { role: "user", content: message }]`. Fetch timeout: 30 seconds via `AbortSignal.timeout(30000)`.

**Fallback**: any fetch error, connection refused, or non-200 from Ollama returns `{ reply: "...", _fallback: true }` — the widget shows the message normally.

## Component: `components/chat/ChatBot.tsx`

**Props**:
| Prop | Type | Default | Purpose |
|---|---|---|---|
| `isLoggedIn` | `boolean` | `false` | Gates rendering — returns null if false |
| `currentSection` | `string` | `"Self"` | Passed to `/api/chat` as context |

**Integration**: rendered in `app/layout.tsx` (root layout). The layout reads the session cookie server-side and passes `isLoggedIn` — no extra client-side fetch needed.

**UI structure**:
- Closed state: floating circle button with `MessageCircle` icon (indigo, bottom-right, z-50)
- Open state: 380×520 fixed panel, `bg-gray-950 border-gray-800`
- User messages: right-aligned, indigo bubble
- Assistant messages: left-aligned, gray bubble
- Typing indicator: three bouncing dots while `loading = true`
- Header: "Charaivati Guide" label + Trash (clear chat) + X (close) buttons
- Input: resizable textarea (Enter to send, Shift+Enter for newline) + Send button

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Base URL of the Ollama server |
| `OLLAMA_MODEL` | `llama3.2` | Model name to use |

Both are optional — defaults kick in if not set.

## Runtime Flow

1. User opens `/` (or any page) while logged in → `app/layout.tsx` reads session cookie → passes `isLoggedIn=true` to `<ChatBot />`
2. ChatBot renders the floating bubble
3. User clicks bubble → panel opens
4. User types a message → `POST /api/chat` fires with message + conversation history
5. API loads user context from DB, builds system prompt, calls Ollama
6. Ollama returns `{ message: { content: "..." } }` → API returns `{ reply }`
7. Widget appends assistant message and clears the typing indicator

## Risks & Notes
- Ollama must be running locally (or at `OLLAMA_URL`) — if not, every message gets the fallback response. No retry logic.
- Conversation history is in-memory only. Refreshing the page clears it.
- The system prompt is rebuilt from DB on every request — no caching. For users with no profile data, all fields will show "not set" or "none".
- `AbortSignal.timeout` is used instead of a manual timeout — requires Node 18+ (fine on Next.js 15).

## Backlinks
- [[START_HERE.md]] — root layout integration note
- [[auth.md]] — session required; API route uses manual auth pattern
- [[database.md]] — User.drives, Profile.goals/stepsToday/sleepHours, Page model
