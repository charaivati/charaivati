
import crypto from "crypto";
import type { SendSmsOpts, SendResult } from "../types";

function signPayload(payload: object, secret: string) {
  const h = crypto.createHmac("sha256", secret);
  h.update(JSON.stringify(payload));
  return h.digest("hex");
}

export default async function localProvider(opts: SendSmsOpts): Promise<SendResult> {
  const base = process.env.LOCAL_GATEWAY_URL;
  const secret = process.env.LOCAL_GATEWAY_TOKEN;
  const deviceId = process.env.LOCAL_GATEWAY_DEFAULT_DEVICE_ID || "";

  if (!base || !secret) {
    return { ok: false, error: "Local gateway not configured", provider: "local" };
  }

  // Decide target URL — you can expand this to pick specific device IDs from DB
  const url = `${base.replace(/\/$/, "")}/api/gateway/send`; // example endpoint

  const payload = {
    id: opts.id ?? `sms-${Date.now()}`,
    to: opts.to,
    body: opts.body,
    deviceId,
    ts: Date.now(),
  };

  const signature = signPayload(payload, secret);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-local-sign": signature,
      },
      body: JSON.stringify(payload),
      // optional timeout or keepalive settings
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, provider: "local", error: `gateway error ${res.status} ${txt}` };
    }

    const data = await res.json().catch(() => ({}));
    // expect { ok: true, providerMessageId: '...' } shape from gateway
    return { ok: true, provider: "local", providerId: data.providerMessageId || data.id };
  } catch (err: any) {
    console.error("localProvider error", err?.message ?? err);
    return { ok: false, provider: "local", error: String(err?.message ?? err) };
  }
}
