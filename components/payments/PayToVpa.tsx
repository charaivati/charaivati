"use client";

// Handoff display atom (REQBCAST-1b / UPI-INTENT-1b / UPI-QR-1): surfaces a provider's
// UPI VPA and, when amount is given, a upi://pay deep-link button (mobile) + QR code
// (desktop). QR and button share one buildUpiIntent() string.
// DISPLAY/HANDOFF ONLY — the platform never touches funds.
import { useState } from "react";
import { useTranslations } from "@/hooks/useTranslations";
import { buildUpiIntent } from "@/lib/upiIntent";
import UpiQr from "@/components/payments/UpiQr";

const SLUGS = "pay-to-vpa-label,pay-vpa-copy,pay-via-upi-btn,pay-qr-scan";

export default function PayToVpa({
  vpa,
  payeeName,
  tone = "light",
  amount,
  note,
}: {
  vpa: string;
  payeeName?: string | null;
  tone?: "light" | "dark";
  amount?: number | null;
  note?: string | null;
}) {
  const t = useTranslations(SLUGS);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(vpa);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable on plain HTTP — ignore */
    }
  }

  const dark = tone === "dark";
  const intentUrl = amount ? buildUpiIntent({ vpa, payeeName, amount, note }) : "";
  return (
    <div className={`flex flex-col gap-2 text-sm ${dark ? "text-gray-200" : "text-gray-800"}`}>{intentUrl && (
        <>
          <a
            href={intentUrl}
            className={`w-full text-center py-2 px-4 rounded-lg font-semibold text-sm ${
              dark ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            {t("pay-via-upi-btn", "Pay via UPI")} ₹{amount!.toLocaleString("en-IN")}
          </a>
          <div className="flex flex-col items-center gap-1 py-1">
            <UpiQr value={intentUrl} size={160} />
            <span className={`text-xs ${dark ? "text-gray-400" : "text-gray-500"}`}>
              {t("pay-qr-scan", "Scan to pay")}
            </span>
          </div>
        </>
      )}
      <div className="flex items-center gap-2">
      <span className={dark ? "text-gray-400" : "text-gray-500"}>
        {t("pay-to-vpa-label", "Pay directly to")}
        {payeeName ? ` ${payeeName}` : ""}:
      </span>
      <code
        className={`font-mono px-2 py-0.5 rounded border ${
          dark ? "border-gray-700 bg-gray-800 text-emerald-300" : "border-gray-300 bg-gray-50 text-emerald-700"
        }`}
      >
        {vpa}
      </code>
      <button
        type="button"
        onClick={copy}
        className={`text-xs underline ${dark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-700"}`}
      >
        {copied ? "✓" : t("pay-vpa-copy", "Copy")}
      </button>
      </div>
    </div>
  );
}
