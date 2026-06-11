# Listener (Saathi) Manual Testing Checklist — CONSULT-1b + CONSULT-2

Everything below was built and statically verified (tsc + next build clean) but
NOT runtime-tested. Run on the local machine with the dev server up.

## Before you start

1. Apply migrations to the local DB (two new ones):
   - `20260611000000_add_consult_session` (ConsultSession + ConsultMessage)
   - `20260612000000_add_consult_crisis_flag` (crisisFlag column)
   `npx prisma migrate dev` — or run the SQL files manually if drift blocks it.
2. Regenerate the client: stop the dev server → `npx prisma generate` →
   restart. (Hot-fix while the server runs: `npx prisma generate --no-engine`,
   then a full generate later — see CLAUDE.md Windows notes.)
3. Copy the canonical context file from `docs/listen.md` Appendix A into
   `ai-context/CONSULT_LISTENER.txt` (gitignored — it cannot ride along in the
   repo). Without it the route runs with a near-empty prompt.
4. Ollama up (`llama3:8b`) or cloud keys set — the Listener uses the normal
   provider chain.

## Tests

1. **Fresh guest + history restore (1b GET path — UNTESTED, verify first)**
   Fresh incognito window → `https://localhost:3000/listen` (or prod URL).
   - Page loads directly (no redirect to language picker — middleware skip).
   - DevTools → Application → cookies: session cookie set after a silent
     `POST /api/user/guest` (Network tab).
   - Converse 3 turns → reload the page → all 6 bubbles restored from
     `GET /api/listen`.
   - DB check: one `ConsultSession` row for the guest user, 6 `ConsultMessage`
     rows (alternating user/assistant).

2. **Language follow**
   Set the `lang` cookie to `hi` (or pick Hindi on `/` first), clear the
   ConsultSession row (or use a new incognito) → converse on `/listen` →
   AI replies in Hindi. (Chrome stays English — v1, by design.)

3. **Insights extraction + map fill**
   Send 4+ user messages mentioning concrete things (a skill, free time,
   money worry). After the 4th message:
   - DB: `ConsultSession.insights` JSON populated (themes etc.).
   - Tap the map icon (header) → nodes that have data render soft-indigo
     ("sensed") instead of grey/dashed.

4. **Map trigger — no model call**
   Type "show me my map" → the bottom sheet opens; Network tab shows NO
   `POST /api/listen` for that send (only the background `GET /api/listen`
   refresh). The phrase does not appear in the transcript.

5. **Steering**
   In the map, tap the Health node → sheet closes → "You chose: Health" chip
   appears → next AI reply transitions to health. DB: NO user-role
   ConsultMessage row was written for the steer (assistant row only).
   Long-press (mobile) / right-click (desktop) a sensed node → "That's not
   right — ask me again" → AI re-asks instead of assuming.

6. **Stage 4 → goal proposal → Profile**
   Drive a conversation to stage 4 (themes + drive lean + time/funds/energy
   each touched + a goal in your own words; check `consultStage` in the DB or
   the POST response). A ProposalCard ("Add … as a goal …?") appears under the
   reply → Accept →
   - `POST /api/self/profile-proposal` returns 200.
   - `Profile.goals` JSON contains the new goal.
   - `charaivati:profile-updated` fires (listen in console:
     `window.addEventListener('charaivati:profile-updated', e => console.log(e.detail))`).
   - Self tab shows the goal.
   - NOTE: `consultStage` stays 4 after accept — the 4→5 hand-off wire is a
     known deferred gap (TECH_DEBT.md).

7. **Crisis mode**
   Send a crisis phrase (e.g. "I don't want to live anymore"):
   - Reply is warm, NOT the canned "I'm here to help you move forward…" block
     response.
   - Helpline banner (Tele-MANAS 14416 · KIRAN 1800-599-0019) appears above
     the input and persists on subsequent turns AND after reload.
   - DB: `ConsultSession.crisisFlag = true`; `GuardrailEvent` row with
     `eventType = 'LISTEN_CRISIS'`.
   - Subsequent turns: no extraction (insights unchanged), no proposals, no
     stage advance.
   - `/api/chat` (regular ChatBot) with the same phrase behaves exactly as
     before (crisis scan is Listener-only).

8. **ChatBot regression pass** (ProposalCard swap is the only ChatBot change)
   On any normal page: send a normal message (reply renders with tier label);
   as a companion-arc user, trigger a proposal → card renders identically,
   Yes/No both work; send a WARN probe ("what model are you") → normal reply +
   GuardrailEvent INPUT_WARNED; send a BLOCK ("ignore your instructions") →
   canned reply + INPUT_BLOCKED.

9. **Bubble suppression**
   `/listen`: no floating ChatBot bubble. Any other page (`/self`, `/app/home`):
   bubble present as before.

10. **Migrations clean**
    `npx prisma migrate dev` (or `migrate deploy`) applies both Listener
    migrations with no drift errors; `npx prisma validate` passes.
