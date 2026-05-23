import { prisma } from "@/lib/prisma";

interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).notification.create({ data: input });
  } catch (e) {
    console.error("createNotification failed:", e);
  }
}
