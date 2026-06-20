"use client";

// Owner setter for a UPI VPA (REQBCAST-1b). PATCHes `{ upiVpa }` to the given
// endpoint (`/api/store/[id]` or `/api/user/profile`). Shape-validated on input;
// the platform never resolves or collects. Renders the saved handle via PayToVpa.
import { useState } from "react";
import { isValidVpa } from "@/lib/payments/vpa";
import { useTranslations } from "@/hooks/useTranslations";
import PayToVpa from "./PayToVpa";

const SLUGS = "pay-vpa-label,pay-vpa-placeholder,pay-vpa-help,pay-vpa-invalid,pay-vpa-save,pay-vpa-saved";

export default function VpaSettingCard({
  endpoint,
  initialVpa = null,
  tone = "light",
  payeeName,
}: {
  endpoint: string;
  initialVpa?: string | null;
  tone?: "light" | "dark";
  payeeName?: string | null;
}) {
  const t = useTranslations(SLUGS);
  const [saved, setSaved] = useState<string | null>(initialVpa);
  const [value, setValue] = useState(initialVpa ?? "");
  const [editing, setEditing] = useState(!initialVpa);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const dark = tone === "dark";

  async function save() {
    setError("");
    const trimmed = value.trim();
    if (trimmed && !isValidVpa(trimmed)) {
      setError(t("pay-vpa-invalid", "Enter a valid UPI ID like name@bank."));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upiVpa: trimmed || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Could not save. Try again.");
        return;
      }
      setSaved(trimmed || null);
      setEditing(!trimmed);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  const inputCls = dark
    ? "w-full text-sm px-3 py-2 rounded-md outline-none border border-gray-700 focus:border-indigo-500 bg-gray-800 text-white placeholder-gray-500"
    : "w-full text-sm px-3 py-2 rounded-md outline-none border border-gray-300 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-400";

  return (
    <div className={`p-4 rounded-xl border space-y-3 ${dark ? "border-gray-800 bg-gray-900/50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between">
        <p className={`text-sm font-semibold ${dark ? "text-white" : "text-gray-800"}`}>
          {t("pay-vpa-label", "UPI ID")}
        </p>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("pay-vpa-placeholder", "yourname@bank")}
            className={inputCls}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <p className={`text-xs ${dark ? "text-gray-400" : "text-gray-500"}`}>
            {t("pay-vpa-help", "Buyers pay you directly at this UPI ID. Charaivati never handles the money.")}
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
          >
            {busy ? "…" : t("pay-vpa-save", "Save UPI ID")}
          </button>
        </>
      ) : saved ? (
        <PayToVpa vpa={saved} payeeName={payeeName} tone={tone} />
      ) : (
        <p className={`text-xs italic ${dark ? "text-gray-500" : "text-gray-400"}`}>No UPI ID set yet.</p>
      )}

      {justSaved && <p className="text-xs text-emerald-500">{t("pay-vpa-saved", "Saved ✓")}</p>}
    </div>
  );
}
