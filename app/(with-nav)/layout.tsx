// app/(with-nav)/layout.tsx
// Server component — fetches profile before page renders, zero flash.
import React, { Suspense } from "react";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ProfileProvider } from "@/lib/ProfileContext";
import WithNavClient from "./WithNavClient";

async function getProfileFromCookie(): Promise<any | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload?.userId) return null;

    const userId = String(payload.userId);

    const [profile, user] = await Promise.all([
      prisma.profile.findUnique({ where: { userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, avatarUrl: true },
      }),
    ]);

    if (!user) return null;

    return {
      ...(profile ?? {}),
      userId: user.id,
      // surface name/email on the profile object so ProfileMenu can read them
      name: profile?.displayName || user.name || null,
      email: user.email ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

export default async function WithNavLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetched server-side — available before browser receives HTML
  const profile = await getProfileFromCookie();

  return (
    <ProfileProvider profile={profile}>
      <WithNavClient profile={profile}>{children}</WithNavClient>
    </ProfileProvider>
  );
}