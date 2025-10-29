import type { SendSmsOpts, SendResult } from "../types";

export default async function twilioProvider(opts: SendSmsOpts): Promise<SendResult> {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    return { ok: false, error: "Twilio not configured", provider: "twilio" };
  }

  // lazy require so builds don't fail
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Twilio = require("twilio");
  const client = new Twilio(sid, token);

  try {
    const msg = await client.messages.create({
      to: opts.to,
      from,
      body: opts.body,
    });
    return { ok: true, provider: "twilio", providerId: msg.sid };
  } catch (err: any) {
    console.error("twilioProvider error", err?.message ?? err);
    return { ok: false, provider: "twilio", error: String(err?.message ?? err) };
  }
}
