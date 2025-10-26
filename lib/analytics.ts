// lib/analytics.ts
import { db } from "./db";

export async function createUsageLog(params: {
  userId?: string | null;
  section: string;
  startedAt?: Date;
}) {
  const started = params.startedAt ?? new Date();
  const rec = await db.usageLog.create({
    data: {
      userId: params.userId ?? null,
      section: params.section,
      startedAt: started,
      endedAt: started,
      durationMs: 0,
      interactions: 0,
    },
  });
  return rec;
}

export async function endUsageLog(params: {
  usageId: string;
  endedAt?: Date;
  interactions?: number;
}) {
  const ended = params.endedAt ?? new Date();
  // fetch record
  const r = await db.usageLog.findUnique({ where: { id: params.usageId } });
  if (!r) throw new Error("UsageLog not found");

  const durationMs = Math.max(0, ended.getTime() - new Date(r.startedAt).getTime());
  return db.usageLog.update({
    where: { id: params.usageId },
    data: {
      endedAt: ended,
      durationMs,
      interactions: params.interactions ?? r.interactions,
    },
  });
}
