import { prisma } from "@/lib/prisma";
import { verifySessionToken, getTokenFromRequest } from "@/lib/session";

export default async function getServerUser(req?: Request) {
  if (!req) return null;

  const token = getTokenFromRequest(req);

  if (!token) return null;

  const payload = await verifySessionToken(token);

  if (!payload?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      avatarStorageKey: true,
      status: true,
    },
  });

  return user ?? null;
}