// lib/sendSms.ts
import Twilio from 'twilio';
const client = new Twilio(process.env.TWILIO_SID!, process.env.TWILIO_AUTH_TOKEN!);

export default async function sendSms({ to, body }: { to: string; body: string }) {
  if (!process.env.TWILIO_SID || !process.env.TWILIO_AUTH_TOKEN) throw new Error('Twilio creds not set');
  await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to
  });
}
