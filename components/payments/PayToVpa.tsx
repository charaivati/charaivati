"use client";

// Handoff display atom (REQBCAST-1b): surfaces a provider's UPI VPA to a paying
// party so they can pay directly. DISPLAY ONLY — no payment is initiated or
// verified here. The broadcast engine (REQBCAST-1c) will reuse this component.
import { useState } from "react";
import { useTranslations } from "@/hooks/useTranslations";

const SLUGS = "pay-to-vpa-label,pay-vpa-copy";

export default function PayToVpa({
  vpa,
  payeeName,
  tone = "light",
}: {
  vpa: string;
  payeeName?: string | null;
  tone?: "light" | "dark";
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
  return (
    <div className={`flex items-center gap-2 text-sm ${dark ? "text-gray-200" : "text-gray-800"}`}>
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
  );
}
