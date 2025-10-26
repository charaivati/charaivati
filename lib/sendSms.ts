// lib/sendSms.ts
type SendSmsOpts = { to: string; body: string };

function getTwilioClient() {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    // Return null if not configured; do NOT throw at module load time.
    return null;
  }

  // require lazily to avoid module evaluation during Next.js build
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Twilio = require("twilio");
  const client = new Twilio(sid, token);
  return { client, from };
}

export default async function sendSms(opts: SendSmsOpts) {
  const tw = getTwilioClient();
  if (!tw) {
    // In production you may want to return a failure object or throw an error
    // but DO NOT throw at import time. Throwing here returns a runtime error only.
    throw new Error("SMS provider not configured (TWILIO_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER)");
  }

  const { client, from } = tw;
  try {
    const msg = await client.messages.create({
      to: opts.to,
      from,
      body: opts.body,
    });
    return { ok: true, sid: msg.sid };
  } catch (err) {
    console.error("sendSms error", (err as any)?.message || err);
    throw err;
  }
}
