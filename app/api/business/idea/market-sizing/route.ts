// app/api/business/idea/market-sizing/route.ts
// PATCH { ideaId, samPct, somPct } — persist slider adjustments, reconcile todo labels.
// Auth: same session/guest ownership guard as the interview route.
// Math in code: all arithmetic computed here, never by AI.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import type { MarketSizing } from "@/lib/business/runMarketSizing";

const GUEST_COOKIE = "biz-guest";

async function resolveOwnership(req: NextRequest, ideaId: string) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifySessionToken(token) : null;
  const sessionUserId = payload?.userId ?? null;
  const guestSessionId = req.cookies.get(GUEST_COOKIE)?.value ?? null;

  const idea = await (db as any).businessIdea.findUnique({
    where: { id: ideaId },
    select: { id: true, userId: true, guestSessionId: true, marketSizing: true },
  });

  if (!idea) return { allowed: false, idea: null, sessionUserId: null };

  const owned = idea.userId
    ? idea.userId === sessionUserId
    : !!guestSessionId && idea.guestSessionId === guestSessionId;

  return { allowed: owned, idea, sessionUserId };
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { ideaId, samPct: rawSam, somPct: rawSom } = body as {
      ideaId: string;
      samPct: number; // integer 1–80
      somPct: number; // integer 1–50
    };

    if (!ideaId || typeof rawSam !== "number" || typeof rawSom !== "number") {
      return NextResponse.json(
        { ok: false, error: "ideaId, samPct, somPct required" },
        { status: 400 }
      );
    }

    const { allowed, idea, sessionUserId } = await resolveOwnership(req, ideaId);
    if (!allowed || !idea) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const prev = idea.marketSizing as MarketSizing | null;
    if (!prev) {
      return NextResponse.json(
        { ok: false, error: "No market sizing to update" },
        { status: 404 }
      );
    }

    // Clamp to slider bounds
    const samPct = Math.max(1, Math.min(80, Math.round(rawSam)));
    const somPct = Math.max(1, Math.min(50, Math.round(rawSom)));

    // Math in code — same contract as runMarketSizing.ts
    const tam = prev.populationBasis;
    const sam = Math.round(tam * (samPct / 100));
    const som = Math.round(sam * (somPct / 100));

    const samLabel = `${samPct}% of the market is reachable`;
    const somLabel = `${somPct}% of reachable market captured in year 1`;

    const updatedSizing: MarketSizing = {
      ...prev,
      sam,
      som,
      samPct: samPct / 100,
      somPct: somPct / 100,
      assumptions: (prev.assumptions ?? []).map((a: any) => {
        if (a.id === "sam") return { ...a, pct: samPct / 100, label: samLabel };
        if (a.id === "som") return { ...a, pct: somPct / 100, label: somLabel };
        return a;
      }),
    };

    // Persist updated sizing to DB
    await (db as any).businessIdea.update({
      where: { id: ideaId },
      data: { marketSizing: updatedSizing as any },
    });

    // Reconcile linked validation todo labels.
    // Todos are tagged with assumptionKey="sam"/"som" when created (see createValidationTodos).
    // Silently skips todos that have no assumptionKey set.
    if (sessionUserId) {
      const samTodo = await db.todo.findFirst({ where: { ideaId, assumptionKey: "sam" } });
      if (samTodo) {
        await db.todo.update({ where: { id: samTodo.id }, data: { validationLabel: samLabel } });
      }
      const somTodo = await db.todo.findFirst({ where: { ideaId, assumptionKey: "som" } });
      if (somTodo) {
        await db.todo.update({ where: { id: somTodo.id }, data: { validationLabel: somLabel } });
      }
    }

    return NextResponse.json({ ok: true, sizing: updatedSizing });
  } catch (err) {
    console.error("PATCH /api/business/idea/market-sizing", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
