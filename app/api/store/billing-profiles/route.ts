import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";
import { requireVerifiedContact } from "@/lib/requireVerifiedContact";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profiles = await db.billingProfile.findMany({
    where: { userId: user.id },
    include: { linkedStore: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const block = await requireVerifiedContact(req);
  if (block) return block;

  const body = await req.json();
  const {
    legalName, companyName,
    gstRegistered, gstin, gstState, annualTurnover,
    addressLine, city, state, pinCode, linkedStoreId,
  } = body;

  if (!legalName?.trim()) {
    return NextResponse.json({ error: "legalName is required" }, { status: 400 });
  }

  if (gstRegistered && gstin) {
    const upper = String(gstin).toUpperCase().trim();
    if (!GSTIN_RE.test(upper)) {
      return NextResponse.json({ error: "Invalid GSTIN format" }, { status: 400 });
    }
  }

  if (linkedStoreId) {
    const store = await db.store.findUnique({ where: { id: linkedStoreId } });
    if (!store || store.ownerId !== user.id) {
      return NextResponse.json({ error: "Invalid store" }, { status: 400 });
    }
  }

  const cleanGstin = gstRegistered && gstin ? gstin.trim().toUpperCase() : null;

  const profile = await (db.billingProfile as any).create({
    data: {
      userId: user.id,
      legalName: legalName.trim(),
      companyName: companyName?.trim() || null,
      gstRegistered: !!gstRegistered,
      gstin: cleanGstin,
      gstState: gstRegistered ? gstState?.trim() || null : null,
      annualTurnover: gstRegistered ? annualTurnover || null : null,
      addressLine: addressLine?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      pinCode: pinCode?.trim() || null,
      linkedStoreId: linkedStoreId || null,
    },
    include: { linkedStore: { select: { id: true, name: true } } },
  });

  return NextResponse.json(profile, { status: 201 });
}
