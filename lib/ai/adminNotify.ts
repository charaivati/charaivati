import sendEmail from '@/lib/sendEmail';
import { db } from '@/lib/db';

export interface GuardrailEvent {
  userId?: string;
  sessionId?: string;
  eventType: 'INPUT_BLOCKED' | 'INPUT_WARNED' | 'OUTPUT_BLOCKED';
  userMessage: string;
  reason: string;
  matchedPattern: string;
  timestamp: string;
  ipAddress?: string;
}

export async function notifyAdmin(event: GuardrailEvent): Promise<void> {
  // Persist to DB first — fire-and-forget caller pattern:
  // notifyAdmin(event).catch(console.error);
  try {
    await (db as any).guardrailEvent.create({
      data: {
        userId: event.userId ?? null,
        sessionId: event.sessionId ?? null,
        eventType: event.eventType,
        userMessage: event.userMessage,
        reason: event.reason,
        matchedPattern: event.matchedPattern,
        ipAddress: event.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error('[guardRail] DB persist failed:', err);
  }

  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (!adminEmail) return;

  const subject = `[Charaivati Security] ${event.eventType} — ${event.timestamp}`;
  const text = [
    `Event Type : ${event.eventType}`,
    `Timestamp  : ${event.timestamp}`,
    `User ID    : ${event.userId ?? 'unknown'}`,
    `IP Address : ${event.ipAddress ?? 'unknown'}`,
    `Reason     : ${event.reason}`,
    `Pattern    : ${event.matchedPattern}`,
    `Message    : ${event.userMessage}`,
  ].join('\n');

  try {
    await sendEmail({ to: adminEmail, subject, text });
  } catch (err) {
    console.error('[guardRail] Admin email failed:', err);
  }
}
