// lib/sendSms.ts
import Twilio from "twilio";

const SID = process.env.TWILIO_SID;
const AUTH = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_PHONE_NUMBER;

if (process.env.NODE_ENV === "production") {
  if (!SID || !AUTH || !FROM) {
    throw new Error("TWILIO_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER must be set in production");
  }
}

const client = SID && AUTH ? new Twilio(SID, AUTH) : null;

export default async function sendSms({ to, body }: { to: string; body: string }) {
  if (!client) {
    // dev-time helpful error (do not attempt to send in prod without client)
    throw new Error("Twilio client not configured. Set TWILIO_SID and TWILIO_AUTH_TOKEN.");
  }
  await client.messages.create({
    body,
    from: FROM!,
    to,
  });
}
