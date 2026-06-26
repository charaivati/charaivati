# UCTX-2: New-User Safety (Rate Limiting & Guest Hardening)

<!-- Moved from CLAUDE.md (2026-06-26) -->


Implemented June 2026 to protect against guest-creation abuse, limit AI message spam, and provide safe guest-to-authenticated upgrade in `/listen`.

### Environment Variables
Set in `.env.local`:
```env
GUEST_DAILY_CAP=500              # Global daily cap on new guest accounts
LISTEN_MSG_LIMIT_5MIN=20         # Per-user /api/listen messages per 5 min
LISTEN_MSG_LIMIT_DAY=200         # Per-user /api/listen messages per day
CHAT_MSG_LIMIT_5MIN=20           # Per-user /api/chat messages per 5 min
CHAT_MSG_LIMIT_DAY=200           # Per-user /api/chat messages per day
```

### Guest-Creation Protection (`POST /api/user/guest`)

**Rate limiting doctrine (shared with other abuse-sensitive routes):**
- **Redis-based rate limit** (`checkRateLimit`) is permissive on Redis failure (returns `ok: true`) — always pair with a DB backstop
- Two-window rate limit per IP: 3 creations / 10 min, 20 / day; prevents request storms
- **DB backstop** (global): count guests created in last 24h; return 503 if >= `GUEST_DAILY_CAP`
- **Idempotency guard**: if the request has a valid session cookie, return the existing session instead of creating a duplicate

Key changes:
- Reads `x-forwarded-for` header (Vercel sets this; takes first hop for client IP)
- Blocks with 429 (rate limit) or 503 (daily cap)
- See `app/api/user/guest/route.ts`

### JWT Re-Issue on Guest-Upgrade (`POST /api/user/guest-upgrade`)

**Problem:** After guest-to-lite upgrade, the JWT still claimed `role: "guest"` until the next login.

**Fix:** After successfully updating the user to `status: "lite"`, the route now calls `createSessionToken` with the new role and re-sets the session cookie. This is critical for:
- ChatBot's "Secure Account" nudge to work (it calls `router.refresh()` and expects the new role)
- Client-side checks like `user.status === "guest"` to reflect the upgrade immediately
- Proposal system to work correctly (proposals check the current session role)

See `app/api/user/guest-upgrade/route.ts`.

### Message Rate Caps

Both `/api/chat` and `/api/listen` now enforce per-user message limits:
- **Short window** (5 min): stricter limit to catch spam/load attacks
- **Daily window** (24 h): softer limit for legitimate users
- **On limit**: return an in-character message (e.g., "Let's take a small pause") **not** a 429/error. This keeps the UX graceful.
- **Steer-only turns in `/api/listen`** are excluded from the count (only real message text increments the counter)

Changes:
- `app/api/chat/route.ts`: added `CHAT_MSG_LIMIT_5MIN`/`CHAT_MSG_LIMIT_DAY` env vars; rate-limit check after input guard
- `app/api/listen/route.ts`: added `LISTEN_MSG_LIMIT_5MIN`/`LISTEN_MSG_LIMIT_DAY` env vars; rate-limit check after input guard (message-only)

### Guest-to-Real Merge Handles ConsultSession

**Problem:** When a guest upgraded and merged into a real account, their Listener (Saathi) consultation history was silently lost.

**Fix:** `lib/mergeGuest.ts` now handles ConsultSession and ConsultMessage:
- Deletes any existing real user's ConsultSession first (safeguard; should be rare)
- Moves the guest's ConsultSession (and all messages via cascade) to the real user
- Uses `(db as any)` and `.catch(() => null)` to gracefully degrade if the model isn't in the stale client yet

See `lib/mergeGuest.ts` lines that handle ConsultSession.

### Cold-Start Explicit Mode

**Problem:** When a new user had no profile data, `buildUserContext` returned an empty line. The AI made assumptions about their personality, goals, and background based on nothing.

**Fix:** `lib/ai/userContext.ts` now detects cold-start (no drives, goals, initiatives, or companion data) and returns an explicit block:
```
You know nothing about this person yet.
Listen openly. Make no assumptions about their personality, goals, circumstances, or background.
Let them define themselves through the conversation.
Avoid suggesting changes to their profile or goals — ask first.
```

This is placed in the dynamic user-context block where all AI providers see it. Avoids early proposals and unsafe profiling.

### SecureChatCard Component

New component `components/listen/SecureChatCard.tsx` for guest-to-lite upgrade in `/listen`. Triggered after:
- (i) A goal proposal is accepted
- (ii) The session reaches 12+ messages without the card ever being shown
- Both checks gated on localStorage: `charaivati.dismissed_proposals` tracks dismissal (same pattern as proposals)

Card features:
- Username validation: 3–20 chars, alphanumeric + underscore
- Password validation: min 8 chars
- POST to `/api/user/guest-upgrade`
- Success state for 2s then dismisses
- Existing-user path: link to `/login?next=/listen`
- Graceful error handling with user-facing messages

### Verification Checklist

- [ ] Hammer `/api/user/guest` from curl: 4th request in 10 min → 429; valid-cookie request → no new row
- [ ] `/api/listen` message past rate cap → in-character pause message
- [ ] Guest-upgrade → decode new cookie, claims show `lite` role
- [ ] ChatBot nudge regression test (ensure it still works)
- [ ] `/listen`: accept goal proposal → SecureChatCard appears; dismiss → never reappears
- [ ] Guest-upgrade flow end-to-end (username/password validation, success state)
- [ ] Login with `?next=/listen` merge preserves ConsultSession
- [ ] Fresh guest first message: log shows cold-start block in prompt
