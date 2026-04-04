// app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  // Relationship status between viewer and this profile
  let relationship: "self" | "friends" | "outgoing" | "incoming" | "none" = "none";
  try {
    const viewer = await getCurrentUser(req as any);
    if (viewer?.id) {
      if (viewer.id === id) {
        relationship = "self";
      } else {
        const [friendship, outgoing, incoming] = await Promise.all([
          prisma.friendship.findFirst({
            where: {
              OR: [
                { userAId: viewer.id, userBId: id },
                { userAId: id, userBId: viewer.id },
              ],
            },
          }),
          prisma.friendRequest.findFirst({
            where: { senderId: viewer.id, receiverId: id, status: "pending" },
          }),
          prisma.friendRequest.findFirst({
            where: { senderId: id, receiverId: viewer.id, status: "pending" },
          }),
        ]);

        if (friendship) relationship = "friends";
        else if (outgoing) relationship = "outgoing";
        else if (incoming) relationship = "incoming";
      }
    }
  } catch {
    // relationship stays "none"
  }

  const payload = {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    avatar: user.avatarUrl ?? null,
    title: (user as any).title ?? null,
    shortBio: (user as any).shortBio ?? null,
    location: user.selectedCountry ?? null,
    joinedAt: user.createdAt?.toISOString?.() ?? null,
    about: (profile?.bio ?? profile?.learningNotes) ?? null,
    links,
    relationship,
  };

  return NextResponse.json(payload);
}
