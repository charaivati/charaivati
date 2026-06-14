/**
 * UNFRIEND-1 verification script.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/test-unfriend.ts
 *
 * Requires the Next.js dev server running at BASE_URL (default http://localhost:3000).
 * Creates/reuses two real users (Alice/Bob), mints session cookies via createSessionToken,
 * and exercises: profile-page-style remove (POST /api/friends/remove), chat-based
 * unfriend via /api/listen ("unfriend Bob"), repeatable add/remove cycles, and
 * unfriend-of-a-non-friend (friendly not-found message, no error).
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import { createSessionToken, COOKIE_NAME } from "../lib/session";

const prisma = new PrismaClient({ log: ["error"] });
const BASE = (process.env.BASE_URL ?? "http://localhost:3000").trim();

type Result = { name: string; passed: boolean; error?: string };
const results: Result[] = [];

function rec(name: string, passed: boolean, error?: string) {
  results.push({ name, passed, error });
  const icon = passed ? "  ✓" : "  ✗";
  const tag = passed ? "PASS" : "FAIL";
  console.log(`${icon} ${name}: ${tag}${error ? ` — ${error}` : ""}`);
}

async function api(
  method: string,
  url: string,
  cookie: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function upsertUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email, name, status: "active", verified: true, emailVerified: true },
  });
}

async function cookieFor(userId: string, email: string) {
  const token = await createSessionToken({ userId, email, role: "active" });
  return `${COOKIE_NAME}=${token}`;
}

async function areFriends(aId: string, bId: string): Promise<boolean> {
  const f = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userAId: aId, userBId: bId },
        { userAId: bId, userBId: aId },
      ],
    },
  });
  return !!f;
}

async function clearFriendState(aId: string, bId: string) {
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { userAId: aId, userBId: bId },
        { userAId: bId, userBId: aId },
      ],
    },
  });
  await prisma.friendRequest.deleteMany({
    where: {
      OR: [
        { senderId: aId, receiverId: bId },
        { senderId: bId, receiverId: aId },
      ],
    },
  });
}

async function becomeFriends(aCookie: string, aId: string, bCookie: string, bId: string) {
  // FriendRequest has @@unique([senderId, receiverId]) — clear any leftover
  // accepted/rejected rows from a previous cycle so create() doesn't P2002.
  await prisma.friendRequest.deleteMany({
    where: {
      OR: [
        { senderId: aId, receiverId: bId },
        { senderId: bId, receiverId: aId },
      ],
    },
  });

  const reqRes = await api("POST", "/api/friends/request", aCookie, { receiverId: bId });
  if (!reqRes.data?.ok) throw new Error("friend request failed: status=" + reqRes.status + " " + JSON.stringify(reqRes.data));
  const requestId = reqRes.data.request.id;
  const acceptRes = await api("POST", "/api/friends/accept", bCookie, { requestId });
  if (!acceptRes.data?.ok) throw new Error("friend accept failed: " + JSON.stringify(acceptRes.data));
}

async function main() {
  const alice = await upsertUser("unfriend-test-alice@example.com", "Alice Unfriendtest");
  const bob = await upsertUser("unfriend-test-bob@example.com", "Bob Unfriendtest");

  const aliceCookie = await cookieFor(alice.id, alice.email!);
  const bobCookie = await cookieFor(bob.id, bob.email!);

  // Clean slate
  await clearFriendState(alice.id, bob.id);
  await prisma.consultSession.deleteMany({ where: { userId: alice.id } }).catch(() => {});

  // ── 1. Profile-page-style remove (POST /api/friends/remove) ─────────────────
  await becomeFriends(aliceCookie, alice.id, bobCookie, bob.id);
  rec("Setup: Alice & Bob become friends", await areFriends(alice.id, bob.id));

  const removeRes = await api("POST", "/api/friends/remove", aliceCookie, { friendId: bob.id });
  rec(
    "Profile-page remove: POST /api/friends/remove returns ok + deletedCount=1",
    removeRes.data?.ok === true && removeRes.data?.deletedCount === 1,
    JSON.stringify(removeRes.data)
  );
  rec("Profile-page remove: friendship gone (Alice<->Bob)", !(await areFriends(alice.id, bob.id)));

  // ── 2. Re-add via friend request, then chat-based unfriend ──────────────────
  await becomeFriends(aliceCookie, alice.id, bobCookie, bob.id);
  rec("Re-add: Alice & Bob friends again", await areFriends(alice.id, bob.id));

  // bootstrap ConsultSession for Alice
  const hydrate = await api("GET", "/api/listen", aliceCookie);
  rec("Listen GET hydrates for Alice", hydrate.status === 200 && hydrate.data?.ok === true, JSON.stringify(hydrate.data));

  const unfriendMsg = await api("POST", "/api/listen", aliceCookie, { message: "Please unfriend Bob Unfriendtest" });
  rec(
    "Chat 'unfriend Bob' returns unfriend_confirm action",
    unfriendMsg.data?.action?.type === "unfriend_confirm" && unfriendMsg.data?.action?.friend?.id === bob.id,
    JSON.stringify(unfriendMsg.data)
  );

  if (unfriendMsg.data?.action?.type === "unfriend_confirm") {
    const friendId = unfriendMsg.data.action.friend.id;
    const confirmRes = await api("POST", "/api/friends/remove", aliceCookie, { friendId });
    rec(
      "Chat confirm -> POST /api/friends/remove succeeds",
      confirmRes.data?.ok === true && confirmRes.data?.deletedCount === 1,
      JSON.stringify(confirmRes.data)
    );
    rec("Chat unfriend: friendship gone (Alice<->Bob)", !(await areFriends(alice.id, bob.id)));
  }

  // ── 3. Repeatability: add/remove cycle again ─────────────────────────────────
  await becomeFriends(aliceCookie, alice.id, bobCookie, bob.id);
  rec("Cycle 2: Alice & Bob friends again", await areFriends(alice.id, bob.id));

  const removeRes2 = await api("POST", "/api/friends/remove", aliceCookie, { friendId: bob.id });
  rec(
    "Cycle 2: profile-style remove again succeeds",
    removeRes2.data?.ok === true && removeRes2.data?.deletedCount === 1,
    JSON.stringify(removeRes2.data)
  );
  rec("Cycle 2: friendship gone again", !(await areFriends(alice.id, bob.id)));

  // ── 4. Unfriend a non-friend via chat -> friendly not-found, no error ────────
  // Note: name extraction is AI-based and can vary — the hard requirement is
  // "ok:true, friendly reply, no error", whether or not the extractor produced
  // a name (action.type === "unfriend_not_found" if it did).
  const notFoundMsg = await api("POST", "/api/listen", aliceCookie, { message: "unfriend Someone Nonexistent" });
  rec(
    "Chat 'unfriend <non-friend>' -> friendly reply, ok:true, no error",
    notFoundMsg.status === 200 &&
      notFoundMsg.data?.ok === true &&
      typeof notFoundMsg.data?.reply === "string" &&
      notFoundMsg.data.reply.length > 0,
    JSON.stringify(notFoundMsg.data)
  );

  // Bob is genuinely not a friend right now, so "unfriend Bob" should also be not_found
  const bobNotFriendMsg = await api("POST", "/api/listen", aliceCookie, { message: "unfriend Bob Unfriendtest" });
  rec(
    "Chat 'unfriend Bob' when not friends -> unfriend_not_found",
    bobNotFriendMsg.status === 200 &&
      bobNotFriendMsg.data?.ok === true &&
      bobNotFriendMsg.data?.action?.type === "unfriend_not_found",
    JSON.stringify(bobNotFriendMsg.data)
  );

  // ── Summary ───────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error("FATAL:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
