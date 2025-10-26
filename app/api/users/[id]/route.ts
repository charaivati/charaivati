// app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  // Use include (not select) to bring the profile relation with typed shape.
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
    },
  });

  if (!user) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  // profile may be null/undefined depending on DB
  const profile = user.profile ?? null;

  // Normalise social handles -> links safely (guard types)
  let links: { label: string; href: string }[] = [];
  try {
    const sh = profile?.socialHandles ?? null;
    if (sh) {
      if (Array.isArray(sh)) {
        links = sh
          .map((x: any) => (typeof x === "string" ? { label: x, href: x } : { label: x.label ?? x.type ?? "link", href: x.href ?? x.url ?? "" }))
          .filter((l) => !!l.href);
      } else if (typeof sh === "object") {
        links = Object.entries(sh)
          .filter(([, v]) => typeof v === "string" && v.length > 0)
          .map(([k, v]) => ({ label: k, href: String(v) }));
      }
    }
  } catch (e) {
    links = [];
  }

  const payload = {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    avatar: user.avatarUrl ?? null,
    title: (user as any).title ?? null, // after regen these will be typed; fallback keeps runtime safe
    shortBio: (user as any).shortBio ?? null,
    location: user.selectedCountry ?? null,
    joinedAt: user.createdAt?.toISOString?.() ?? null,
    about: (profile?.bio ?? profile?.learningNotes) ?? null,
    links,
  };

  return NextResponse.json(payload);
}
