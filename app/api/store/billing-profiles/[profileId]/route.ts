import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export async function PATCH(req: NextRequest, { params }: { params: { profileId: string } }) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.billingProfile.findUnique({ where: { id: params.profileId } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    legalName, companyName,
    gstRegistered, gstin, gstState, annualTurnover,
    addressLine, city, state, pinCode, linkedStoreId,
  } = body;

  if (legalName !== undefined && !legalName?.trim()) {
    return NextResponse.json({ error: "legalName cannot be empty" }, { status: 400 });
  }

  const isGstOn = gstRegistered !== undefined ? !!gstRegistered : (existing as any).gstRegistered;
  if (isGstOn && gstin) {
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

  const cleanGstin = gstin !== undefined
    ? (isGstOn && gstin ? gstin.trim().toUpperCase() : null)
    : undefined;

  const profile = await (db.billingProfile as any).update({
    where: { id: params.profileId },
    data: {
      ...(legalName !== undefined && { legalName: legalName.trim() }),
      ...(companyName !== undefined && { companyName: companyName?.trim() || null }),
      ...(gstRegistered !== undefined && { gstRegistered: !!gstRegistered }),
      ...(cleanGstin !== undefined && { gstin: cleanGstin }),
      ...(gstState !== undefined && { gstState: isGstOn ? gstState?.trim() || null : null }),
      ...(annualTurnover !== undefined && { annualTurnover: isGstOn ? annualTurnover || null : null }),
      ...(addressLine !== undefined && { addressLine: addressLine?.trim() || null }),
      ...(city !== undefined && { city: city?.trim() || null }),
      ...(state !== undefined && { state: state?.trim() || null }),
      ...(pinCode !== undefined && { pinCode: pinCode?.trim() || null }),
      ...(linkedStoreId !== undefined && { linkedStoreId: linkedStoreId || null }),
    },
    include: { linkedStore: { select: { id: true, name: true } } },
  });

  return NextResponse.json(profile);
}

export async function DELETE(req: NextRequest, { params }: { params: { profileId: string } }) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.billingProfile.findUnique({ where: { id: params.profileId } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.billingProfile.delete({ where: { id: params.profileId } });
  return NextResponse.json({ ok: true });
}
