// UPI-INTENT-1b — builds a upi://pay deep-link for mobile app-chooser dispatch.
// Platform never touches funds; this is a handoff link only.

// UPI-QRUPLOAD-1b — parse a upi://pay URL (e.g. decoded from a shopkeeper QR).
// Returns null if the URL is unparseable or not a upi: scheme.
export function parseUpiIntent(url: string): {
  vpa: string | null;
  payeeName: string | null;
  amount: string | null;
  note: string | null;
} | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "upi:") return null;
    return {
      vpa: u.searchParams.get("pa"),
      payeeName: u.searchParams.get("pn"),
      amount: u.searchParams.get("am"),
      note: u.searchParams.get("tn"),
    };
  } catch {
    return null;
  }
}

export function buildUpiIntent({
  vpa,
  payeeName,
  amount,
  note,
}: {
  vpa: string;
  payeeName?: string | null;
  amount?: number | null;
  note?: string | null;
}): string {
  if (!vpa) return "";
  const params = new URLSearchParams();
  params.set("pa", vpa);
  if (payeeName) params.set("pn", payeeName);
  if (amount && amount > 0) params.set("am", String(amount));
  params.set("cu", "INR");
  if (note) params.set("tn", note);
  return `upi://pay?${params.toString()}`;
}
