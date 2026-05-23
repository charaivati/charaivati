"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";

const A = {
  bg: "#E3E6E6", nav: "#131921", border: "#DDDDDD",
  text: "#0F1111", textMuted: "#565959", accent: "#6366f1",
};

// ── Delivery stepper ──────────────────────────────────────────────────────────
const DELIVERY_STEPS = ["pending", "confirmed", "processing", "out_for_delivery", "delivered"] as const;
type DeliveryStep = typeof DELIVERY_STEPS[number];

const STEP_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type OrderItem = { blockId: string; title: string; price: number; quantity: number };
type Address = { name: string; phone: string; line1: string; city: string; state: string; pincode: string };
type QuoteEntry  = { id: string; stepId: string; partyName: string; amount: number | null; status: string };
type ActiveStep  = { stepId: string; stepName: string; assigneeName: string | null; quoteRequired: boolean };
type StepStatus  = { stepId: string; stepName: string; sequence: number; quoteRequired: boolean; ospStatus: string };
type QueueStep   = { stepId: string; stepName: string };
type Order = {
  id: string; status: string; total: number; createdAt: string;
  invoiceUrl?: string | null;
  invoiceSignedUrl?: string | null;
  items: OrderItem[];
  address: Address;
  user: { name: string | null; email: string | null };
  deliveryStatus?: string | null;
  assignedToId?: string | null;
  deliveryNote?: string | null;
  partnerStatus?: string | null;
  requiresAttention?: boolean;
  agreedAmount?: number | null;
  activeStep?: ActiveStep | null;
  quotes?: QuoteEntry[];
  initiativeId?: string | null;
  subOrderType?: string | null;
  subOrders?: { id: string; subOrderType: string | null; agreedAmount: number | null; userId: string }[];
  allSteps?:  StepStatus[];
};

type DeliveryBlock = {
  id: string;
  title: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
};

type CollabPage = { id: string; title: string; pageType: string };
type Collab = { id: string; role: string; requester: CollabPage; receiver: CollabPage };

type InvoiceState = {
  genStatus: "idle" | "loading" | "done" | "error";
  url?: string;
  signedUrl?: string;
  signStatus: "idle" | "uploading" | "done" | "error";
  signError?: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", confirmed: "#6366f1", shipped: "#3B82F6",
  delivered: "#10B981", cancelled: "#EF4444",
};

// ── InvoiceSection (unchanged) ────────────────────────────────────────────────
function InvoiceSection({ orderId, inv, onSignUpload }: {
  orderId: string;
  inv: InvoiceState;
  onSignUpload: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSignUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/orders/${orderId}/invoice/sign`, {
      method: "POST", credentials: "include", body: fd,
    });
    if (res.ok) {
      const data = await res.json();
      onSignUpload(data.invoiceSignedUrl);
    } else {
      throw new Error("Upload failed");
    }
  }

  if (inv.genStatus === "loading") return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: A.textMuted }}>
      <span className="w-3 h-3 rounded-full border border-indigo-500 border-t-transparent animate-spin inline-block" />
      Generating invoice…
    </div>
  );

  if (inv.genStatus === "error") return (
    <span className="text-xs" style={{ color: "#EF4444" }}>Invoice generation failed. Retry by changing status.</span>
  );

  if (inv.signedUrl || inv.signStatus === "done") return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: "#10B981" }}>✓ Signed invoice ready for buyer</span>
      <a href={`/api/orders/${orderId}/invoice/download`} download={`invoice-${orderId}.pdf`}
        className="text-xs px-3 py-1 rounded-md font-medium w-fit"
        style={{ background: "#F0FDF4", color: "#10B981", border: "1px solid #A7F3D0", textDecoration: "none" }}>
        ⬇ Download Signed Copy
      </a>
    </div>
  );

  if (inv.genStatus === "done" && inv.url) return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <a href={`/api/orders/${orderId}/invoice/download`} download={`invoice-${orderId}.pdf`}
          className="text-xs px-3 py-1 rounded-md font-medium"
          style={{ background: "#EEF2FF", color: A.accent, border: `1px solid ${A.accent}`, textDecoration: "none" }}>
          ⬇ Download Invoice (unsigned)
        </a>
      </div>
      <div className="text-xs" style={{ color: A.textMuted, borderTop: `1px dashed ${A.border}`, paddingTop: 6, marginTop: 4 }}>
        <span className="font-medium">Sign & Re-upload</span> — Download, sign, then upload the signed copy for the buyer.
      </div>
      {inv.signStatus === "uploading" ? (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: A.textMuted }}>
          <span className="w-3 h-3 rounded-full border border-indigo-500 border-t-transparent animate-spin inline-block" />
          Uploading signed invoice…
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try { await handleSignUpload(file); } catch { /* shown via signError */ }
              if (fileRef.current) fileRef.current.value = "";
            }} />
          <button onClick={() => fileRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-md font-medium"
            style={{ background: A.accent, color: "#fff", cursor: "pointer" }}>
            Upload Signed Invoice
          </button>
          {inv.signError && <span className="text-xs" style={{ color: "#EF4444" }}>{inv.signError}</span>}
        </div>
      )}
    </div>
  );

  return null;
}

// ── CountdownBar ──────────────────────────────────────────────────────────────
function CountdownBar({
  stepName,
  remaining,
  index,
  total,
  onCancel,
}: {
  stepName: string;
  remaining: number;
  index: number;
  total: number;
  onCancel: () => void;
}) {
  const pct = Math.round(((5 - remaining) / 5) * 100);
  return (
    <div className="p-3 rounded-lg" style={{ background: "#EEF2FF", border: "1px solid #6366f1" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={{ color: "#6366f1" }}>
            Confirming: <em style={{ fontStyle: "normal" }}>{stepName}</em>
          </span>
          {total > 1 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: "#C7D2FE", color: "#4338CA", fontSize: 10 }}>
              {index + 1} / {total}
            </span>
          )}
        </div>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#6366f1", lineHeight: 1, minWidth: 28, textAlign: "right" }}>
          {remaining}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div style={{ flex: 1, height: 5, background: "#C7D2FE", borderRadius: 99, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%", background: "#6366f1",
            borderRadius: 99, transition: "width 0.95s linear",
          }} />
        </div>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1 rounded-md font-semibold shrink-0"
          style={{ background: "#fff", border: "1px solid #6366f1", color: "#6366f1", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
      {total > 1 && index + 1 < total && (
        <p className="text-xs mt-1.5" style={{ color: "#818CF8" }}>
          Cancelling here stops the entire sequence.
        </p>
      )}
    </div>
  );
}

// ── WorkflowSection ──────────────────────────────────────────────────────────
function WorkflowSection({
  orderId,
  orderStatus,
  initiativeId,
  requiresAttention,
  agreedAmount,
  activeStep,
  allSteps,
  quotes,
  partnerStatus,
  assignedToId,
  partners,
  onReload,
}: {
  orderId: string;
  orderStatus: string;
  initiativeId: string | null;
  requiresAttention: boolean;
  agreedAmount: number | null;
  activeStep: ActiveStep | null;
  allSteps: StepStatus[];
  quotes: QuoteEntry[];
  partnerStatus: string | null;
  assignedToId: string | null;
  partners: Collab[];
  onReload: () => void;
}) {
  const [localQuotes,   setLocalQuotes]   = useState<QuoteEntry[]>(quotes);
  const [accepting,     setAccepting]     = useState<string | null>(null);
  const [retryAssignee, setRetryAssignee] = useState("");
  const [retrying,      setRetrying]      = useState(false);
  const [executing,     setExecuting]     = useState(false); // API call in flight after countdown

  // ── Countdown state ───────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState<{
    queue: QueueStep[];
    index: number;
    remaining: number;
  } | null>(null);

  const countdownRef = useRef(countdown);
  useEffect(() => { countdownRef.current = countdown; }, [countdown]);

  const onReloadRef = useRef(onReload);
  useEffect(() => { onReloadRef.current = onReload; }, [onReload]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  useEffect(() => () => stopTimer(), []);

  const startQueue = useCallback((queue: QueueStep[], index = 0) => {
    stopTimer();
    if (index >= queue.length) { onReloadRef.current(); return; }
    setCountdown({ queue, index, remaining: 5 });

    timerRef.current = setInterval(() => {
      const cur = countdownRef.current;
      if (!cur) { stopTimer(); return; }

      if (cur.remaining > 1) {
        setCountdown({ ...cur, remaining: cur.remaining - 1 });
        return;
      }

      // Countdown reached zero — fire the confirm API
      stopTimer();
      setCountdown(null);
      setExecuting(true);
      fetch(`/api/order/${orderId}/step/${cur.queue[cur.index].stepId}/confirm`, {
        method: "PATCH", credentials: "include",
      }).then((r) => {
        setExecuting(false);
        if (!r.ok) return;
        const nextIdx = cur.index + 1;
        if (nextIdx < cur.queue.length) {
          startQueue(cur.queue, nextIdx);
        } else {
          setTimeout(() => onReloadRef.current(), 1000);
        }
      }).catch(() => setExecuting(false));
    }, 1000);
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  function cancelCountdown() { stopTimer(); setCountdown(null); }

  // Build single-step confirm queue
  function startConfirmStep() {
    if (!activeStep) return;
    startQueue([{ stepId: activeStep.stepId, stepName: activeStep.stepName }]);
  }

  // Build fast-track queue: all pending/active non-quote steps in sequence
  function startFastTrack() {
    const queue = allSteps
      .filter((s) => !s.quoteRequired && (s.ospStatus === "active" || s.ospStatus === "pending"))
      .sort((a, b) => a.sequence - b.sequence)
      .map((s) => ({ stepId: s.stepId, stepName: s.stepName }));
    if (queue.length > 0) startQueue(queue);
  }

  // How many non-quote steps remain (active + pending)
  const remainingNonQuoteSteps = allSteps.filter(
    (s) => !s.quoteRequired && (s.ospStatus === "active" || s.ospStatus === "pending")
  ).length;

  useEffect(() => { setLocalQuotes(quotes); }, [quotes]);

  async function handleRetry() {
    if (!activeStep) return;
    setRetrying(true);
    const body: Record<string, unknown> = {};
    if (retryAssignee) body.assigneeId = retryAssignee;
    const res = await fetch(`/api/order/${orderId}/step/${activeStep.stepId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) onReload();
    setRetrying(false);
  }

  async function handleAccept(quoteId: string) {
    setAccepting(quoteId);
    const res = await fetch(`/api/order/${orderId}/quote/${quoteId}/accept`, {
      method: "POST", credentials: "include",
    });
    if (res.ok) onReload();
    setAccepting(null);
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...localQuotes];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setLocalQuotes(next);
    fetch(`/api/order/${orderId}/quote-order`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: next.map((q) => ({ quoteId: q.id, partyName: q.partyName, amount: q.amount, status: q.status })),
      }),
    }).catch(() => {});
  }

  const showRejection = partnerStatus === "rejected" && activeStep;

  // ── State A: no initiative linked ────────────────────────────────────────
  if (!initiativeId) {
    return (
      <div className="mt-4 pt-4 border-t" style={{ borderColor: "#f0f0f0" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: A.textMuted }}>WORKFLOW</p>
        <p className="text-xs" style={{ color: A.textMuted }}>
          No workflow set up.{" "}
          <a href={`/earn/initiative/${initiativeId}`} style={{ color: A.accent, textDecoration: "underline" }}>
            Go to your Initiative → Workflow tab
          </a>{" "}
          to configure steps.
        </p>
      </div>
    );
  }

  // ── State B: initiative exists but order pending (workflow not yet activated) ──
  if (!activeStep && orderStatus === "pending" && !requiresAttention && quotes.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t" style={{ borderColor: "#f0f0f0" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: A.textMuted }}>WORKFLOW</p>
        <p className="text-xs" style={{ color: A.textMuted }}>
          Confirm the order to activate the workflow.
        </p>
      </div>
    );
  }

  // ── Nothing to show (workflow complete or no steps configured yet) ────────
  if (!requiresAttention && !activeStep && quotes.length === 0 && !showRejection) return null;

  // ── States C & D ──────────────────────────────────────────────────────────
  return (
    <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: "#f0f0f0" }}>
      <p className="text-xs font-semibold" style={{ color: A.textMuted }}>WORKFLOW</p>

      {/* Attention banner */}
      {requiresAttention && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span className="text-xs font-semibold" style={{ color: "#EF4444" }}>
            Action required — a step failed or a quote timed out
          </span>
        </div>
      )}

      {/* State D — Rejection notice + reassign */}
      {showRejection && (
        <div className="p-3 rounded-lg" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "#EF4444" }}>
            ⚠ Delivery partner rejected — reassign or mark failed
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={retryAssignee}
              onChange={(e) => setRetryAssignee(e.target.value)}
              className="text-xs rounded-md px-2 py-1.5"
              style={{ border: "1px solid #DDDDDD", color: "#0F1111", background: "#fff" }}
            >
              <option value="">Re-notify same partner</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.receiver.title} · {p.role.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <button
              disabled={retrying}
              onClick={handleRetry}
              className="text-xs px-3 py-1.5 rounded-md font-medium"
              style={{ background: "#6366f1", color: "#fff", cursor: "pointer", opacity: retrying ? 0.6 : 1 }}
            >
              {retrying ? "…" : "Retry Step"}
            </button>
          </div>
        </div>
      )}

      {/* ── Countdown bar (replaces normal controls while active) ── */}
      {countdown && (
        <CountdownBar
          stepName={countdown.queue[countdown.index].stepName}
          remaining={countdown.remaining}
          index={countdown.index}
          total={countdown.queue.length}
          onCancel={cancelCountdown}
        />
      )}

      {/* ── API executing spinner (between countdown end and API response) ── */}
      {executing && !countdown && (
        <div className="flex items-center gap-2 text-xs" style={{ color: A.textMuted }}>
          <span className="w-3 h-3 rounded-full border border-indigo-400 border-t-transparent animate-spin inline-block" />
          Confirming…
        </div>
      )}

      {/* State C — Active step info (hidden while countdown is running) */}
      {activeStep && !showRejection && !countdown && !executing && (
        <div className="space-y-2">
          <p className="text-xs font-semibold" style={{ color: A.textMuted }}>CURRENT STEP</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: "#EEF2FF", color: A.accent, border: `1px solid ${A.accent}` }}>
              {activeStep.stepName}
            </span>
            {activeStep.assigneeName && (
              <span className="text-xs" style={{ color: A.textMuted }}>→ {activeStep.assigneeName}</span>
            )}
          </div>
          {agreedAmount != null && agreedAmount > 0 && (
            <p className="text-xs" style={{ color: A.textMuted }}>
              Estimated delivery cost: ₹{agreedAmount.toLocaleString("en-IN")}
            </p>
          )}

          {/* Confirm / Fast-track buttons */}
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            {!activeStep.quoteRequired && (
              <button
                onClick={startConfirmStep}
                className="text-xs px-3 py-1.5 rounded-md font-medium"
                style={{ background: "#10B981", color: "#fff", cursor: "pointer" }}
              >
                Confirm Step ✓
              </button>
            )}
            {remainingNonQuoteSteps > 1 && (
              <button
                onClick={startFastTrack}
                className="text-xs px-3 py-1.5 rounded-md font-medium"
                style={{ background: "#1D4ED8", color: "#fff", cursor: "pointer" }}
                title={`Auto-confirm ${remainingNonQuoteSteps} pending steps (5s cancel window each)`}
              >
                ⚡ Complete All ({remainingNonQuoteSteps})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quotes — shown when step requires quotes */}
      {localQuotes.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: A.textMuted }}>
            QUOTES ({localQuotes.filter((q) => q.status === "submitted").length} received)
          </p>
          <div className="space-y-1.5">
            {localQuotes.map((q, idx) => (
              <div key={q.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-xs">▲</button>
                  <button onClick={() => move(idx, 1)} disabled={idx === localQuotes.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none text-xs">▼</button>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium" style={{ color: A.text }}>{q.partyName}</span>
                  {q.amount != null && (
                    <span className="text-xs ml-2" style={{ color: A.accent }}>
                      ₹{q.amount.toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
                {q.status === "pending" && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "#FFFBEB", color: "#D97706", border: "1px solid #FCD34D" }}>
                    Awaiting
                  </span>
                )}
                {q.status === "submitted" && (
                  <button
                    disabled={!!accepting}
                    onClick={() => handleAccept(q.id)}
                    className="text-xs px-3 py-1 rounded-md font-medium"
                    style={{ background: "#10B981", color: "#fff", cursor: "pointer", opacity: accepting ? 0.6 : 1 }}>
                    {accepting === q.id ? "…" : "Accept"}
                  </button>
                )}
                {q.status === "accepted" && (
                  <span className="text-xs font-semibold" style={{ color: "#10B981" }}>✓ Accepted</span>
                )}
                {q.status === "rejected" && (
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>Rejected</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── DeliveryStatusBar ─────────────────────────────────────────────────────────
// Read-only delivery pipeline status — only Cancel remains actionable.
// Assignment dropdown and delivery note are kept for manual override.
const PARTNER_STATUS_BADGE: Record<
  string,
  { label: string; bg: string; color: string; border: string }
> = {
  assigned:  { label: "Pending acceptance",  bg: "#FFFBEB", color: "#D97706", border: "#FCD34D" },
  accepted:  { label: "Partner accepted ✓",  bg: "#F0FDF4", color: "#16A34A", border: "#86EFAC" },
  rejected:  { label: "Partner rejected — reassign", bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
  completed: { label: "Delivered by partner", bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
};

function DeliverySection({
  orderId,
  deliveryStatus,
  assignedToId,
  deliveryNote,
  partnerStatus,
  partners,
  busy,
  onPatch,
}: {
  orderId: string;
  deliveryStatus: string;
  assignedToId: string | null;
  deliveryNote: string;
  partnerStatus: string | null;
  partners: Collab[];
  busy: boolean;
  onPatch: (payload: Record<string, unknown>) => void;
}) {
  const [localNote, setLocalNote] = useState(deliveryNote);

  // Keep localNote in sync if parent resets
  useEffect(() => { setLocalNote(deliveryNote); }, [deliveryNote]);

  const isCancelled = deliveryStatus === "cancelled";
  const currentIdx = DELIVERY_STEPS.indexOf(deliveryStatus as DeliveryStep);
  const showAssignment = !isCancelled && currentIdx >= 1; // confirmed or later

  return (
    <div className="mt-4 pt-4 border-t space-y-4" style={{ borderColor: "#f0f0f0" }}>
      <p className="text-xs font-semibold" style={{ color: A.textMuted }}>DELIVERY TRACKING</p>

      {/* ── Stepper ── */}
      {isCancelled ? (
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA" }}>
            Delivery cancelled
          </span>
          <button
            disabled={busy}
            onClick={() => onPatch({ deliveryStatus: "pending" })}
            className="text-xs px-2.5 py-1 rounded-md"
            style={{ border: `1px solid ${A.border}`, color: A.textMuted, cursor: "pointer" }}>
            Reset to pending
          </button>
        </div>
      ) : (
        /* Read-only stepper — step pills are display only; only Cancel is actionable */
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {DELIVERY_STEPS.map((step, idx) => {
            const isCompleted = currentIdx > idx;
            const isActive    = currentIdx === idx;
            const circleColor = isCompleted ? "#10B981" : isActive ? A.accent : "#D1D5DB";
            const labelColor  = isActive ? A.accent : isCompleted ? "#10B981" : A.textMuted;
            return (
              <div key={step} className="flex items-center">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 72 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: isCompleted || isActive ? circleColor : "#F3F4F6",
                    border: `2px solid ${circleColor}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isCompleted ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? "#fff" : "#9CA3AF" }}>
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: labelColor, textAlign: "center", lineHeight: 1.2 }}>
                    {STEP_LABEL[step]}
                  </span>
                </div>
                {idx < DELIVERY_STEPS.length - 1 && (
                  <div style={{ width: 20, height: 2, flexShrink: 0, marginBottom: 18, background: currentIdx > idx ? "#10B981" : "#E5E7EB" }} />
                )}
              </div>
            );
          })}
          {/* Cancel — only remaining clickable action */}
          <button
            disabled={busy}
            onClick={() => onPatch({ deliveryStatus: "cancelled" })}
            className="text-xs px-2 py-1 rounded ml-3 mb-4 flex-shrink-0"
            style={{ border: "1px solid #FECACA", color: "#EF4444", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      )}

      {/* ── Assignment + note (confirmed or later, not cancelled) ── */}
      {showAssignment && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex items-start gap-4 flex-wrap">
            {/* Assignment dropdown */}
            <div className="flex flex-col gap-1" style={{ minWidth: 200 }}>
              <label className="text-xs font-medium" style={{ color: A.textMuted }}>Assigned to</label>
              <select
                disabled={busy}
                value={assignedToId ?? ""}
                onChange={(e) => onPatch({ assignedToId: e.target.value || null })}
                className="text-xs rounded-md px-2 py-1.5"
                style={{
                  border: `1px solid ${A.border}`, color: A.text,
                  background: "#fff", cursor: "pointer",
                }}>
                <option value="">Deliver myself</option>
                {partners.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.receiver.title} · {c.role.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              {assignedToId && (() => {
                const p = partners.find((c) => c.id === assignedToId);
                return p ? (
                  <span className="text-xs" style={{ color: A.accent }}>
                    → {p.receiver.title}
                  </span>
                ) : null;
              })()}
              {assignedToId && (() => {
                const badge = partnerStatus ? PARTNER_STATUS_BADGE[partnerStatus] : null;
                if (!badge) return (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "#F9FAFB", color: "#6B7280", border: "1px solid #E5E7EB" }}>
                    Unassigned
                  </span>
                );
                return (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                    {badge.label}
                  </span>
                );
              })()}
            </div>

            {/* Delivery note */}
            <div className="flex flex-col gap-1 flex-1" style={{ minWidth: 200 }}>
              <label className="text-xs font-medium" style={{ color: A.textMuted }}>Delivery note</label>
              <div className="flex gap-2 items-start">
                <textarea
                  rows={2}
                  disabled={busy}
                  value={localNote}
                  onChange={(e) => setLocalNote(e.target.value)}
                  placeholder="Instructions for the delivery person…"
                  className="flex-1 text-xs rounded-md px-2 py-1.5 resize-none"
                  style={{ border: `1px solid ${A.border}`, color: A.text, background: "#fff" }}
                />
                {localNote !== deliveryNote && (
                  <button
                    disabled={busy}
                    onClick={() => onPatch({ deliveryNote: localNote })}
                    className="text-xs px-2.5 py-1.5 rounded-md font-medium flex-shrink-0"
                    style={{ background: A.accent, color: "#fff", cursor: "pointer" }}>
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AssignEmployeeSection ─────────────────────────────────────────────────────
function AssignEmployeeSection({
  orderId,
  storeId,
  deliveryBlocks,
  busy,
  onAssigned,
}: {
  orderId: string;
  storeId: string;
  deliveryBlocks: DeliveryBlock[];
  busy: boolean;
  onAssigned: () => void;
}) {
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [assigning, setAssigning] = useState(false);

  async function handleAssign() {
    if (!selectedBlockId) return;
    setAssigning(true);
    const res = await fetch(`/api/order/${orderId}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ partnerAction: "assign_block", blockId: selectedBlockId }),
    });
    setAssigning(false);
    if (res.ok) onAssigned();
  }

  return (
    <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: "#f0f0f0" }}>
      <p className="text-xs font-semibold" style={{ color: A.textMuted }}>ASSIGN EMPLOYEE</p>
      {deliveryBlocks.length === 0 ? (
        <p className="text-xs" style={{ color: A.textMuted }}>
          No delivery blocks set up.{" "}
          <a href={`/store/${storeId}`} style={{ color: A.accent, textDecoration: "underline" }}>
            Add a delivery block in your store
          </a>{" "}
          to assign employees.
        </p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedBlockId}
            onChange={(e) => setSelectedBlockId(e.target.value)}
            disabled={busy || assigning}
            className="text-xs rounded-md px-2 py-1.5"
            style={{ border: `1px solid ${A.border}`, color: A.text, background: "#fff" }}
          >
            <option value="">Select employee…</option>
            {deliveryBlocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} — {b.assignedUserName ?? (b.assignedUserId ? b.assignedUserId.slice(-6) : "You")}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedBlockId || busy || assigning}
            onClick={handleAssign}
            className="text-xs px-3 py-1.5 rounded-md font-medium"
            style={{
              background: selectedBlockId ? "#6366f1" : "#E5E7EB",
              color: selectedBlockId ? "#fff" : A.textMuted,
              cursor: selectedBlockId ? "pointer" : "default",
            }}
          >
            {assigning ? "Assigning…" : "Assign"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StoreOrdersPage() {
  const { id } = useParams<{ id: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [invoiceStates, setInvoiceStates] = useState<Record<string, InvoiceState>>({});

  // Delivery state — keyed by orderId
  const [deliveryStatuses, setDeliveryStatuses] = useState<Record<string, string>>({});
  const [assignedTos, setAssignedTos] = useState<Record<string, string | null>>({});
  const [deliveryNotes, setDeliveryNotes] = useState<Record<string, string>>({});
  const [partnerStatuses, setPartnerStatuses] = useState<Record<string, string | null>>({});
  const [updatingDelivery, setUpdatingDelivery] = useState<string | null>(null);

  // Collaboration partners for this store
  const [partners, setPartners] = useState<Collab[]>([]);
  // Initiative (page) linked to this store — used for workflow state A link
  const [initiativeId, setInitiativeId] = useState<string | null>(null);
  // Delivery blocks for the current store — used by AssignEmployeeSection
  const [deliveryBlocks, setDeliveryBlocks] = useState<DeliveryBlock[]>([]);

  function loadOrders() {
    return fetch(`/api/store/orders?storeId=${id}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data: Order[]) => {
        setOrders(data);

        // Invoice init (unchanged)
        const init: Record<string, InvoiceState> = {};
        for (const o of data) {
          if (o.invoiceSignedUrl) {
            init[o.id] = { genStatus: "done", url: o.invoiceUrl ?? undefined, signedUrl: o.invoiceSignedUrl, signStatus: "done" };
          } else if (o.invoiceUrl) {
            init[o.id] = { genStatus: "done", url: o.invoiceUrl, signStatus: "idle" };
          }
        }
        setInvoiceStates(init);

        // Delivery field init
        const dsMap: Record<string, string> = {};
        const atMap: Record<string, string | null> = {};
        const dnMap: Record<string, string> = {};
        const psMap: Record<string, string | null> = {};
        for (const o of data) {
          dsMap[o.id] = o.deliveryStatus ?? "pending";
          atMap[o.id] = o.assignedToId ?? null;
          dnMap[o.id] = o.deliveryNote ?? "";
          psMap[o.id] = o.partnerStatus ?? null;
        }
        setDeliveryStatuses(dsMap);
        setAssignedTos(atMap);
        setDeliveryNotes(dnMap);
        setPartnerStatuses(psMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  // Load orders on mount
  useEffect(() => { loadOrders(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load store pageId → accepted outbound partners + capture initiativeId + delivery blocks
  useEffect(() => {
    fetch(`/api/store/${id}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((store) => {
        if (store?.pageId) setInitiativeId(store.pageId);

        // Extract delivery blocks from store sections
        const blocks: DeliveryBlock[] = [];
        for (const section of store?.sections ?? []) {
          for (const block of section.blocks ?? []) {
            if (block.serviceType === "delivery") {
              blocks.push({
                id:               block.id,
                title:            block.title,
                assignedUserId:   block.assignedUserId ?? null,
                assignedUserName: block.assignedUserName ?? null,
              });
            }
          }
        }
        setDeliveryBlocks(blocks);

        if (!store?.pageId) return;
        return fetch(
          `/api/collaboration?pageId=${store.pageId}&direction=out&status=accepted`,
          { credentials: "include" }
        )
          .then((r) => r.ok ? r.json() : [])
          .then((collabs: Collab[]) => setPartners(collabs));
      })
      .catch(() => {});
  }, [id]);

  function setInv(orderId: string, patch: Partial<InvoiceState>) {
    setInvoiceStates((prev) => ({ ...prev, [orderId]: { ...prev[orderId], ...patch } }));
  }

  async function updateStatus(orderId: string, status: string) {
    setUpdating(orderId);
    const res = await fetch(`/api/store/orders/${orderId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
      if (status === "confirmed") {
        setTimeout(() => loadOrders(), 1000);
      }
      if (status === "delivered") {
        setInv(orderId, { genStatus: "loading", signStatus: "idle" });
        try {
          const r = await fetch(`/api/orders/${orderId}/invoice`, { method: "POST", credentials: "include" });
          if (r.ok) {
            const d = await r.json();
            setInv(orderId, { genStatus: "done", url: d.invoiceUrl, signStatus: "idle" });
          } else {
            setInv(orderId, { genStatus: "error", signStatus: "idle" });
          }
        } catch {
          setInv(orderId, { genStatus: "error", signStatus: "idle" });
        }
      }
    }
    setUpdating(null);
  }

  async function patchDelivery(orderId: string, payload: Record<string, unknown>) {
    setUpdatingDelivery(orderId);
    const res = await fetch(`/api/order/${orderId}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const updated = await res.json();
      if ("deliveryStatus" in payload)
        setDeliveryStatuses((prev) => ({ ...prev, [orderId]: payload.deliveryStatus as string }));
      if ("assignedToId" in payload)
        setAssignedTos((prev) => ({ ...prev, [orderId]: (payload.assignedToId as string | null) ?? null }));
      if ("deliveryNote" in payload)
        setDeliveryNotes((prev) => ({ ...prev, [orderId]: (payload.deliveryNote as string) ?? "" }));
      // Always sync partnerStatus from the API response (set server-side)
      if (updated?.partnerStatus !== undefined)
        setPartnerStatuses((prev) => ({ ...prev, [orderId]: updated.partnerStatus ?? null }));
    }
    setUpdatingDelivery(null);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: A.bg }}>
      <div className="w-7 h-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: A.bg }}>
      <div className="sticky top-0 z-10 px-6 py-4 border-b bg-white" style={{ borderColor: A.border }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: A.text }}>Orders</h1>
            <p className="text-xs" style={{ color: A.textMuted }}>{orders.length} total orders</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {initiativeId && (
              <a href={`/earn/initiative/${initiativeId}`} className="text-xs px-3 py-1.5 rounded-md font-medium"
                style={{ background: "#EEF2FF", color: "#6366f1", border: "1px solid #C7D2FE" }}>
                Initiative & Workflow →
              </a>
            )}
            <a href={`/store/${id}/orders/delivered`} className="text-xs px-3 py-1.5 rounded-md font-medium"
              style={{ background: "#F0FDF4", color: "#10B981", border: "1px solid #A7F3D0" }}>
              Delivered Orders →
            </a>
            <a href="/store/orders/all" className="text-xs px-3 py-1.5 rounded-md"
              style={{ border: `1px solid ${A.border}`, color: A.textMuted }}>
              ← All Orders
            </a>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {orders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl mb-2">📦</p>
            <p className="text-sm" style={{ color: A.textMuted }}>No orders yet.</p>
          </div>
        ) : orders.map((order) => {
          const inv = invoiceStates[order.id];
          return (
            <div key={order.id} className="bg-white rounded-xl p-5 shadow-sm" style={{ border: `1px solid ${A.border}` }}>
              {/* ── Header ── */}
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold" style={{ color: A.text }}>#{order.id.slice(-8).toUpperCase()}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${STATUS_COLORS[order.status]}20`, color: STATUS_COLORS[order.status] ?? A.textMuted }}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: A.textMuted }}>
                    {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color: A.text }}>₹{order.total.toLocaleString("en-IN")}</div>
                  <div className="text-xs" style={{ color: A.textMuted }}>Cash on Delivery</div>
                </div>
              </div>

              {/* ── Items / Customer / Address grid ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <p className="text-xs font-semibold mb-2" style={{ color: A.textMuted }}>ITEMS</p>
                  <div className="space-y-1">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span style={{ color: A.text }}>{item.title} ×{item.quantity}</span>
                        <span style={{ color: A.textMuted }}>₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: A.textMuted }}>CUSTOMER</p>
                  <p className="text-xs" style={{ color: A.text }}>{order.user.name ?? "—"}</p>
                  <p className="text-xs" style={{ color: A.textMuted }}>{order.user.email ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: A.textMuted }}>DELIVERY</p>
                  <p className="text-xs" style={{ color: A.text }}>{order.address.name}</p>
                  <p className="text-xs" style={{ color: A.textMuted }}>{order.address.line1}</p>
                  <p className="text-xs" style={{ color: A.textMuted }}>{order.address.city}, {order.address.state} {order.address.pincode}</p>
                  <p className="text-xs" style={{ color: A.textMuted }}>📞 {order.address.phone}</p>
                </div>
              </div>

              {/* ── Delivery status bar (read-only pipeline display + Cancel + assignment) ── */}
              <DeliverySection
                orderId={order.id}
                deliveryStatus={deliveryStatuses[order.id] ?? "pending"}
                assignedToId={assignedTos[order.id] ?? null}
                deliveryNote={deliveryNotes[order.id] ?? ""}
                partnerStatus={partnerStatuses[order.id] ?? null}
                partners={partners}
                busy={updatingDelivery === order.id}
                onPatch={(payload) => patchDelivery(order.id, payload)}
              />

              {/* ── Assign Employee — for pending delivery sub-orders in this store ── */}
              {order.subOrderType === "delivery" && order.status === "pending" && (
                <AssignEmployeeSection
                  orderId={order.id}
                  storeId={id}
                  deliveryBlocks={deliveryBlocks}
                  busy={updatingDelivery === order.id}
                  onAssigned={() => {
                    loadOrders();
                  }}
                />
              )}

              {/* ── Workflow section (states A/B/C/D) ── */}
              <WorkflowSection
                orderId={order.id}
                orderStatus={order.status}
                initiativeId={order.initiativeId ?? initiativeId}
                requiresAttention={order.requiresAttention ?? false}
                agreedAmount={order.agreedAmount ?? null}
                activeStep={order.activeStep ?? null}
                allSteps={order.allSteps ?? []}
                quotes={order.quotes ?? []}
                partnerStatus={partnerStatuses[order.id] ?? null}
                assignedToId={assignedTos[order.id] ?? null}
                partners={partners}
                onReload={loadOrders}
              />

              {/* ── Invoice section — only for delivered orders ── */}
              {order.status === "delivered" && inv && (
                <div className="mt-4 pt-3 border-t" style={{ borderColor: "#f0f0f0" }}>
                  <InvoiceSection
                    orderId={order.id}
                    inv={inv}
                    onSignUpload={(url) => setInv(order.id, { signedUrl: url, signStatus: "done" })}
                  />
                </div>
              )}

              {/* ── Cancel order ── */}
              {order.status !== "cancelled" && order.status !== "delivered" && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: "#f0f0f0" }}>
                  <button
                    disabled={updating === order.id}
                    onClick={() => updateStatus(order.id, "cancelled")}
                    className="text-xs px-3 py-1.5 rounded-md"
                    style={{ border: "1px solid #FECACA", color: "#EF4444", cursor: "pointer" }}>
                    Cancel Order
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
