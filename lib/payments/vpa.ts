// UPI VPA (Virtual Payment Address) = a `name@bank` handle.
// We validate SHAPE ONLY — never resolve it against any bank/PSP.
// ponytail: shape check, not a resolution check — platform never verifies or
// collects payment. The VPA is a display/handoff string and nothing more.

// Handle part: letters/digits/dot/hyphen/underscore. PSP part: letters (e.g.
// @ybl, @paytm, @okhdfcbank). Kept deliberately permissive on length.
export const VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidVpa(v: string): boolean {
  return VPA_RE.test(v.trim());
}

// Trim to a storable value, or null to clear. Returns null for empty/non-string.
export function normalizeVpa(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}
