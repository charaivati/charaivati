"use client";

// Checkout payment chooser (manual reconciliation — platform never auto-verifies).
// COD → order placed unpaid, owner decides whether to accept. UPI → buyer pays via the
// QR/link, then shares a transaction ref and/or a screenshot as proof; owner confirms
// receipt manually on the order page. The QR is just a pre-filled handoff — scanning it
// does NOT tell the platform anything (no callback), hence the proof step.
import { useState } from "react";
import PayToVpa from "@/components/payments/PayToVpa";

export type PaymentChoice = {
  method: "cod" | "upi";
  ref?: string;
  proofUrl?: string;
};

// A UPI order can't be placed until the buyer gives at least one piece of proof.
export function isPaymentReady(c: PaymentChoice): boolean {
  return c.method === "cod" || !!(c.ref?.trim() || c.proofUrl);
}

async function uploadProof(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", "posts_unsigned");
  fd.append("folder", "payment-proofs");
  const res = await fetch("https://api.cloudinary.com/v1_1/dyphnp3oc/image/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!data.secure_url) throw new Error("upload failed");
  return data.secure_url as string;
}

export default function CheckoutPayment({
  vpa, amount, payeeName, note, value, onChange,
}: {
  vpa?: string | null;
  amount: number;
  payeeName?: string | null;
  note?: string | null;
  value: PaymentChoice;
  onChange: (c: PaymentChoice) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const Option = ({ m, label, sub }: { m: "cod" | "upi"; label: string; sub: string }) => (
    <button type="button" onClick={() => onChange({ method: m })}
      className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-3"
      style={{ border: `1px solid ${value.method === m ? "#4f46e5" : "#e5e7eb"}`, background: value.method === m ? "#eef2ff" : "#fff" }}>
      <span className="w-4 h-4 rounded-full shrink-0" style={{ border: `2px solid ${value.method === m ? "#4f46e5" : "#cbd5e1"}`, background: value.method === m ? "#4f46e5" : "transparent" }} />
      <span>
        <span className="block text-sm font-semibold text-gray-800">{label}</span>
        <span className="block text-xs text-gray-500">{sub}</span>
      </span>
    </button>
  );

  return (
    <div className="space-y-2">
      <Option m="cod" label="💵 Cash on Delivery" sub="Pay when your order arrives" />
      {vpa && <Option m="upi" label="📲 Pay now via UPI" sub="GPay / PhonePe / any UPI app, then share proof" />}

      {value.method === "upi" && vpa && (
        <div className="px-3 py-3 rounded-lg space-y-3" style={{ border: "1px solid #e5e7eb", background: "#fafafa" }}>
          <PayToVpa vpa={vpa} amount={amount} payeeName={payeeName} note={note} />
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-gray-600">After paying, share proof so the store can confirm:</p>
            <input
              value={value.ref ?? ""}
              onChange={(e) => onChange({ ...value, ref: e.target.value })}
              placeholder="UPI transaction / reference no."
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-300"
            />
            <label className="text-xs text-indigo-600 underline cursor-pointer inline-block">
              {uploading ? "Uploading…" : value.proofUrl ? "✓ Screenshot attached — replace" : "📎 Attach payment screenshot"}
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  try { onChange({ ...value, proofUrl: await uploadProof(f) }); }
                  catch { alert("Couldn't upload screenshot — try the reference number instead."); }
                  finally { setUploading(false); }
                }} />
            </label>
            {!isPaymentReady(value) && (
              <p className="text-xs text-amber-600">Add a transaction number or screenshot to place the order.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
