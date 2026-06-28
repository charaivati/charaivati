// app/api/admin/context/route.ts
// Admin-only view/edit of ai-context/*.txt files. Edits persist to AiContextFile
// (shared DB) and override the bundled file via lib/ai/contextLoader.ts.
// Gate mirrors app/api/admin/users/route.ts (ADMIN_EMAIL, case-insensitive).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTokenFromRequest, verifySessionToken } from "@/lib/session";
import {
  CONTEXT_FILES,
  loadRawFile,
  primeFileCache,
  listContextFiles,
} from "@/lib/ai/contextLoader";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? process.env.ADMIN_ALERT_EMAIL;

async function requireAdmin(req: Request): Promise<NextResponse | null> {
  const token = getTokenFromRequest(req);
  const payload = await verifySessionToken(token);
  if (!payload?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await db.user.findUnique({
    where: { id: payload.userId },
    select: { email: true },
  });
  if (!ADMIN_EMAIL || !admin?.email || admin.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function isKnownFile(name: string): name is (typeof CONTEXT_FILES)[number] {
  return (CONTEXT_FILES as readonly string[]).includes(name);
}

export async function GET(req: Request) {
  const blocked = await requireAdmin(req);
  if (blocked) return blocked;

  const file = new URL(req.url).searchParams.get("file");
  if (!file) {
    return NextResponse.json({ files: listContextFiles() });
  }
  if (!isKnownFile(file)) {
    return NextResponse.json({ error: "Unknown file" }, { status: 400 });
  }

  // Effective current text: DB override if present, else the bundled file.
  // Raw SQL — AiContextFile is a new model not yet in the generated client.
  const rows = await db
    .$queryRaw<{ body: string }[]>`SELECT "body" FROM "AiContextFile" WHERE "fileName" = ${file}`
    .catch(() => [] as { body: string }[]);
  const row = rows[0];
  const fullText = row?.body ?? loadRawFile(file);
  return NextResponse.json({ fileName: file, fullText, overridden: !!row });
}

export async function POST(req: Request) {
  const blocked = await requireAdmin(req);
  if (blocked) return blocked;

  let body: { fileName?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fileName = String(body.fileName || "");
  const text = typeof body.body === "string" ? body.body : null;
  if (!isKnownFile(fileName)) {
    return NextResponse.json({ error: "Unknown file" }, { status: 400 });
  }
  if (text === null) {
    return NextResponse.json({ error: "body (string) required" }, { status: 400 });
  }

  // Raw SQL upsert — AiContextFile is a new model not yet in the generated client.
  await db.$executeRaw`
    INSERT INTO "AiContextFile" ("fileName", "body", "updatedAt")
    VALUES (${fileName}, ${text}, CURRENT_TIMESTAMP)
    ON CONFLICT ("fileName")
    DO UPDATE SET "body" = ${text}, "updatedAt" = CURRENT_TIMESTAMP`;
  primeFileCache(fileName, text);

  console.info("[admin-context] saved override", { fileName, at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}
