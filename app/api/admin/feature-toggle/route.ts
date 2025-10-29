// app/api/admin/feature-toggle/route.ts
import { NextResponse } from "next/server";
import { upsertFeatureFlag } from "@/lib/featureFlags";
import { getUserFromReq } from "@/lib/auth";

async function isAdminRequest(req: Request) {
  const user = await getUserFromReq(req);
  if (!user) return false;
  if ((user as any).role === "admin") return true;
  const adminList = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (user.email && adminList.includes(user.email)) return true;
  return false;
}

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const key = String(body.key ?? "");
  const enabled = Boolean(body.enabled === true || body.enabled === "true");
  const meta = body.meta ?? null;

  if (!key) return NextResponse.json({ ok: false, error: "missing key" }, { status: 400 });

  try {
    const res = await upsertFeatureFlag(key, enabled, meta);
    return NextResponse.json({ ok: true, flag: res });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "error" }, { status: 500 });
  }
}
