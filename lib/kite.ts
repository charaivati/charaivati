// lib/kite.ts — Kite Connect (Zerodha) REST helpers. No SDK: plain fetch + crypto.
// access_token lives only in an httpOnly cookie (KITE_COOKIE), never the DB.
import crypto from "crypto";

const API_KEY = process.env.KITE_API_KEY ?? "";
const API_SECRET = process.env.KITE_API_SECRET ?? "";
const KITE_API = "https://api.kite.trade";

export const KITE_COOKIE = "kite.session";

export function kiteConfigured() {
  return Boolean(API_KEY && API_SECRET);
}

export function kiteLoginUrl() {
  return `https://kite.zerodha.com/connect/login?api_key=${API_KEY}&v=3`;
}

function checksum(requestToken: string) {
  return crypto
    .createHash("sha256")
    .update(API_KEY + requestToken + API_SECRET)
    .digest("hex");
}

export async function exchangeToken(requestToken: string): Promise<string> {
  const res = await fetch(`${KITE_API}/session/token`, {
    method: "POST",
    headers: {
      "X-Kite-Version": "3",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      api_key: API_KEY,
      request_token: requestToken,
      checksum: checksum(requestToken),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data?.access_token) {
    throw new Error(json?.message || "Kite token exchange failed");
  }
  return json.data.access_token as string;
}

export function getKiteToken(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${KITE_COOKIE}=`));
  return m ? decodeURIComponent(m.slice(KITE_COOKIE.length + 1)) : null;
}

// access_token expires daily — Kite returns 403 on a dead token.
export class KiteAuthError extends Error {}

export async function kiteGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${KITE_API}${path}`, {
    headers: {
      "X-Kite-Version": "3",
      Authorization: `token ${API_KEY}:${token}`,
    },
    cache: "no-store",
  });
  if (res.status === 403) throw new KiteAuthError("Kite session expired");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Kite ${path} failed`);
  return json.data;
}
