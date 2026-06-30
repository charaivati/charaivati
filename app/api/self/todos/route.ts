// app/api/self/todos/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isChakraKey, isTodoSource } from "@/lib/chakra/keys";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const hobbyId = url.searchParams.get("hobbyId");
  const ideaId = url.searchParams.get("ideaId");

  const where: any = { userId: user.id };
  if (hobbyId) where.hobbyId = hobbyId;
  if (ideaId) where.ideaId = ideaId;

  const todos = await db.todo.findMany({ where, orderBy: { createdAt: "desc" } });
  // chakra/source live in columns the stale Prisma client may not select yet — augment via raw SQL.
  const tags = await db.$queryRaw<{ id: string; chakra: string | null; source: string | null }[]>`
    SELECT id, chakra, source FROM "Todo" WHERE "userId" = ${user.id}`;
  const tagMap = new Map(tags.map((t) => [t.id, t]));
  const data = todos.map((t) => ({ ...t, ...(tagMap.get(t.id) ?? { chakra: null, source: null }) }));
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  if (!title) return NextResponse.json({ ok: false, error: "Missing title" }, { status: 400 });

  const chakra = isChakraKey(body.chakra) ? body.chakra : null;
  const source = isTodoSource(body.source) ? body.source : "manual";

  try {
    const todo = await db.todo.create({
      data: {
        userId: user.id,
        title,
        freq: body.freq ?? null,
        hobbyId: body.hobbyId ?? null,
        ideaId: body.ideaId ?? null,
        validationLabel: body.validationLabel ?? null,
        successThreshold: body.successThreshold ?? null,
        assumptionKey: body.assumptionKey ?? null,
      },
    });
    // chakra/source columns may be unknown to a stale client — set via raw SQL.
    await db.$executeRaw`UPDATE "Todo" SET chakra = ${chakra}, source = ${source} WHERE id = ${todo.id}`;
    return NextResponse.json({ ok: true, data: { ...todo, chakra, source } }, { status: 201 });
  } catch (err) {
    console.error("create todo error", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
