import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getServerUser from "@/lib/serverAuth";
import { generateSlug, randomSuffix } from "@/lib/store/generateSlug";

export async function POST(req: NextRequest) {
  const user = await getServerUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const store = await prisma.store.create({
    data: { name: name.trim(), description: description?.trim() ?? null, ownerId: user.id },
  });

  // Assign slug after creation so we can use store.id as fallback suffix
  let candidate = generateSlug(name.trim());
  if (!candidate) candidate = store.id.slice(-8);

  let slug: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const try_ = attempt === 0 ? candidate : `${candidate}-${randomSuffix()}`;
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Store" WHERE slug = ${try_} LIMIT 1
    `;
    if (!rows.length) { slug = try_; break; }
  }

  if (slug) {
    await prisma.$executeRaw`UPDATE "Store" SET slug = ${slug} WHERE id = ${store.id}`;
  }

  return NextResponse.json({ ...store, slug }, { status: 201 });
}
