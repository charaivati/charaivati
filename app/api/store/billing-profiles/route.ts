import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import getServerUser from "@/lib/serverAuth";

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

  const body = await req.json();
  const { legalName, companyName, gstNumber, addressLine, city, state, pinCode, linkedStoreId } = body;

  if (!legalName?.trim()) {
    return NextResponse.json({ error: "legalName is required" }, { status: 400 });
  }

  if (linkedStoreId) {
    const store = await db.store.findUnique({ where: { id: linkedStoreId } });
    if (!store || store.ownerId !== user.id) {
      return NextResponse.json({ error: "Invalid store" }, { status: 400 });
    }
  }

  const profile = await db.billingProfile.create({
    data: {
      userId: user.id,
      legalName: legalName.trim(),
      companyName: companyName?.trim() || null,
      gstNumber: gstNumber?.trim() || null,
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
