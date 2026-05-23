import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(addresses);
}

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, phone, line1, city, state, pincode, isDefault, lat, lng } = await req.json();
  if (!name || !phone || !line1 || !city || !state || !pincode) {
    return NextResponse.json({ error: "All address fields required" }, { status: 400 });
  }

  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: {
      userId: user.id,
      name: name.trim(),
      phone: phone.trim(),
      line1: line1.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      isDefault: isDefault ?? false,
      ...(typeof lat === "number" && { lat }),
      ...(typeof lng === "number" && { lng }),
    },
  });

  return NextResponse.json(address, { status: 201 });
}
