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
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload?.userId) return null;

    const profile = await prisma.profile.findUnique({
      where: { userId: String(payload.userId) },
    });
    return profile ?? null;
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