# Flow: Testing Guide

Self-contained. No other file required.

---

## Current State of Testing in This Codebase

**There is no automated test suite.**

- No `jest.config.*`, `vitest.config.*`, or any test runner configuration exists.
- No `*.test.ts`, `*.spec.ts`, or `__tests__/` directories exist in the application code.
- TypeScript errors are suppressed during builds (`ignoreBuildErrors: true`).
- ESLint errors are suppressed during builds (`ignoreDuringBuilds: true`).

The `app/tests/` directory contains **manual browser-side debug pages** — they are
regular Next.js pages that run in the browser, not automated tests. Examples:
- `app/tests/page.tsx` — Google Drive image viewer / debug page
- `app/tests/ai/page.tsx` — AI model test page
- `app/tests/model-env-check/page.tsx` — environment variable checker

These are not test files. They are browser tools for manual verification.

---

## How to Verify Changes Today (No Test Runner)

Without automated tests, use these steps to validate a change:

### Lint
```bash
npm run lint
```
The only automated code-quality check available. Catches ESLint rule violations.
TypeScript and lint errors are **not** caught by `npm run build`.

### Type check (manual)
```bash
npx tsc --noEmit
```
`tsconfig.json` has `"strict"` settings but `next.config.mjs` suppresses build-time
type errors. Run this separately to surface type issues.

### Manual smoke test
```bash
npm run dev
```
Start the dev server and manually exercise the affected route or page in the browser.

### Test pages (browser-only, manual)
Navigate to `/tests/ai` or `/tests/model-env-check` to verify AI and environment config.
These require a running dev server and a valid session.

---

## Setting Up a Test Runner (not yet configured)

If you are adding automated tests to this project for the first time, here is the
recommended setup for a Next.js 15 App Router codebase.

### Option A — Vitest (recommended for unit and integration tests)

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

Minimal `vitest.config.ts` at the project root:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
});
```

`vitest.setup.ts`:
```ts
import "@testing-library/jest-dom";
```

Add to `package.json` scripts:
```json
"test": "vitest",
"test:run": "vitest run"
```

### Option B — Jest (more common in older Next.js stacks)

```bash
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest
```

Requires a `jest.config.ts` and a `jest.setup.ts`. More configuration overhead than
Vitest for this stack. Prefer Vitest.

---

## Writing a Test (once a runner is configured)

### Unit test for a lib utility

```ts
// lib/__tests__/hash.test.ts
import { hashPassword, verifyPassword } from "../hash";

describe("hashPassword", () => {
  it("produces a hash that verifies correctly", async () => {
    const hash = await hashPassword("secret");
    expect(await verifyPassword("secret", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
```

### Unit test for a pure function or type utility

No mocking needed. Import and call directly.

### API route test

API route handlers are plain async functions — import and call them with a mock `Request`:

```ts
// app/api/user/check-name/__tests__/route.test.ts
import { POST } from "../route";

it("returns error when name is missing", async () => {
  const req = new Request("http://localhost/api/user/check-name", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.error).toBeDefined();
});
```

---

## Mocking Strategy

### Database (Prisma)

Do not mock Prisma for integration-style API tests — use a real test database or
Prisma's `$transaction` rollback pattern.

For pure unit tests that happen to call a DB-touching function, mock the module:

```ts
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: "user-1", email: "test@test.com" }),
    },
  },
}));
```

### Auth (`getServerUser`)

Most route tests will need to stub auth:

```ts
vi.mock("@/lib/serverAuth", () => ({
  default: vi.fn().mockResolvedValue({ id: "user-1", email: "test@test.com", status: "active" }),
}));
```

To test unauthenticated behavior:
```ts
vi.mocked(getServerUser).mockResolvedValue(null);
```

### External services (Cloudinary, SendGrid, Twilio)

Always mock at the module level. Never make real network calls in tests:

```ts
vi.mock("@/lib/sendEmail", () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true }),
}));
```

### Redis / rate limiting

```ts
vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99 }),
}));
```

---

## Running a single test (once runner is configured)

**Vitest:**
```bash
npx vitest run path/to/your.test.ts
npx vitest run --reporter=verbose
```

**Matching by name:**
```bash
npx vitest run -t "produces a hash"
```

**Watch mode:**
```bash
npx vitest
```

---

## What to Test vs What Not to Test

**Worth testing:**
- Pure utility functions in `lib/` (hash, token, CSRF, session parsing)
- API route input validation (missing fields, invalid types, ownership checks)
- Auth logic: unauthenticated returns 401, wrong owner returns 403
- Business logic with branching (e.g. canonical ordering for Friendship)

**Not worth testing:**
- Prisma schema structure — trust the generated types
- Next.js routing behavior — trust the framework
- UI rendering fidelity — manual browser testing is sufficient at this stage
- External service integrations — mock them; test your wrapper, not the service

---

## Backlinks
- [[START_HERE.md]] — tech stack, ESLint/TypeScript build suppression
- [[add-new-api-route.md]] — auth boilerplate that should be tested
