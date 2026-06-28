"use client";

// Owner setter for a UPI VPA (REQBCAST-1b). PATCHes `{ upiVpa }` to the given
// endpoint (`/api/store/[id]` or `/api/user/profile`). Shape-validated on input;
// the platform never resolves or collects. Renders the saved handle via PayToVpa.
// UPI-QRUPLOAD-1b: QR upload decodes client-side (image never stored).
import { useRef, useState } from "react";
import { isValidVpa, normalizeVpa } from "@/lib/payments/vpa";
import { parseUpiIntent } from "@/lib/upiIntent";
import { decodeQrFromFile } from "@/lib/payments/decodeQrImage";
import { useTranslations } from "@/hooks/useTranslations";
import PayToVpa from "./PayToVpa";

const SLUGS = "pay-vpa-label,pay-vpa-placeholder,pay-vpa-help,pay-vpa-invalid,pay-vpa-save,pay-vpa-saved,pay-qr-upload-btn,pay-qr-prefill-hint,pay-qr-err-read,pay-qr-err-not-upi,pay-qr-err-no-vpa,pay-qr-err-invalid";

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
  const [qrHint, setQrHint] = useState("");
  const [qrBusy, setQrBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function handleQrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setQrHint("");
    setError("");
    setQrBusy(true);
    try {
      const raw = await decodeQrFromFile(file);
      if (!raw) {
        setError(t("pay-qr-err-read", "Couldn't read a QR in that image."));
        return;
      }
      const parsed = parseUpiIntent(raw);
      if (!parsed) {
        setError(t("pay-qr-err-not-upi", "That doesn't look like a UPI QR."));
        return;
      }
      const clean = normalizeVpa(parsed.vpa);
      if (!clean) {
        setError(t("pay-qr-err-no-vpa", "Couldn't find a VPA in that QR — please type it instead."));
        return;
      }
      if (!isValidVpa(clean)) {
        setError(t("pay-qr-err-invalid", "That QR's VPA looks invalid — please type it instead."));
        return;
      }
      setValue(clean);
      setQrHint(t("pay-qr-prefill-hint", "VPA filled from QR — review and save."));
    } finally {
      setQrBusy(false);
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
            onChange={(e) => { setValue(e.target.value); setQrHint(""); }}
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
          {qrHint && <p className="text-xs text-emerald-500">{qrHint}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
            >
              {busy ? "…" : t("pay-vpa-save", "Save UPI ID")}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={qrBusy}
              className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors disabled:opacity-50 ${dark ? "border-gray-600 text-gray-300 hover:border-gray-400" : "border-gray-300 text-gray-600 hover:border-gray-500"}`}
            >
              {qrBusy ? "…" : t("pay-qr-upload-btn", "Upload payment QR")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleQrFile}
            />
          </div>
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
