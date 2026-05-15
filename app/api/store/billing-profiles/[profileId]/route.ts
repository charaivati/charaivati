import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

export async function PATCH(req: NextRequest, { params }: { params: { profileId: string } }) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.billingProfile.findUnique({ where: { id: params.profileId } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { legalName, companyName, gstNumber, addressLine, city, state, pinCode, linkedStoreId } = body;

  if (legalName !== undefined && !legalName?.trim()) {
    return NextResponse.json({ error: "legalName cannot be empty" }, { status: 400 });
  }

  if (linkedStoreId) {
    const store = await db.store.findUnique({ where: { id: linkedStoreId } });
    if (!store || store.ownerId !== user.id) {
      return NextResponse.json({ error: "Invalid store" }, { status: 400 });
    }
  }

  const profile = await db.billingProfile.update({
    where: { id: params.profileId },
    data: {
      ...(legalName !== undefined && { legalName: legalName.trim() }),
      ...(companyName !== undefined && { companyName: companyName?.trim() || null }),
      ...(gstNumber !== undefined && { gstNumber: gstNumber?.trim() || null }),
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
