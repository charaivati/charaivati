import { prisma } from "@/lib/prisma";

interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

// Returns true only if the Notification row was actually written. Never throws —
// callers that only care about "did this notify someone" should still check the
// return value before reporting success to the user (a success/confirmation
// string must be downstream of the operation's real success, never unconditional).
export async function createNotification(input: NotificationInput): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).notification.create({ data: input });
    return true;
  } catch (e) {
    console.error("createNotification failed:", e);
    return false;
  }
}
