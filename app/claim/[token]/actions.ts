"use server";
// app/claim/[token]/actions.ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/token";
import { createSessionToken, COOKIE_NAME } from "@/lib/session";

export async function claimInvite(rawToken: string) {
  const tokenHash = hashToken(rawToken);

  const invite = await (db as any).invite.findFirst({
    where: {
      tokenHash,
      status: "pending",
      expiresAt: { gte: new Date() },
      attempts: { lt: 5 },
    },
    select: { id: true, shellUserId: true, claimedUserId: true },
  });

  if (!invite || invite.claimedUserId) {
    // Increment attempts on failure (best-effort; ignore if record vanished)
    await (db as any).invite.updateMany({
      where: { tokenHash },
      data: { attempts: { increment: 1 } },
    }).catch(() => {});
    redirect("/claim-error");
  }

  // Atomic claim: mark invite + upgrade shell user in one transaction
  const sessionUserId = invite.shellUserId as string;

  await db.$transaction([
    (db as any).invite.update({
      where: { id: invite.id },
      data: {
        status: "claimed",
        claimedUserId: sessionUserId,
        claimedAt: new Date(),
      },
    }),
    db.user.update({
      where: { id: sessionUserId },
      data: {
        status: "lite",
        contactVerified: true,
        emailVerified: true,
      },
    }),
  ]);

  const sessionToken = await createSessionToken({ userId: sessionUserId });

  const jar = await cookies();
  jar.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/self");
}
