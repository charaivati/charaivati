import type { SendSmsOpts, SendResult } from "./sms/types";
import twilioProvider from "./sms/providers/twilioProvider";
import localProvider from "./sms/providers/localProvider";

const SMS_SEND_RETRY = Number(process.env.SMS_SEND_RETRY || 1);

async function _sendVia(providerName: string, opts: SendSmsOpts): Promise<SendResult> {
  if (providerName === "twilio") return twilioProvider(opts);
  if (providerName === "local") return localProvider(opts);
  if (providerName === "noop") {
    console.log("[sendSms noop]", opts);
    return { ok: true, provider: "noop", providerId: "noop" };
  }
  return { ok: false, error: "Unknown sms provider", provider: providerName };
}

export default async function sendSms(opts: SendSmsOpts): Promise<SendResult> {
  const provider = process.env.SMS_PROVIDER || "local";

  // Lightweight idempotency: if caller didn't pass id, we create one
  const id = opts.id ?? `sms-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const payload = { ...opts, id };

  let lastError = null;
  for (let attempt = 0; attempt < SMS_SEND_RETRY; attempt++) {
    const res = await _sendVia(provider, payload);
    if (res.ok) return res;
    lastError = res.error ?? res;
    // small backoff
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }

  // final failure
  return { ok: false, provider, error: `Failed after ${SMS_SEND_RETRY} attempts: ${String(lastError)}` };
}
