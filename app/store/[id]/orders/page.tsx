"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";

const A = {
  bg: "#E3E6E6", nav: "#131921", border: "#DDDDDD",
  text: "#0F1111", textMuted: "#565959", accent: "#6366f1",
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
  assignedToId?: string | null;
  partnerStatus?: string | null;
  requiresAttention?: boolean;
  agreedAmount?: number | null;
  activeStep?: ActiveStep | null;
  quotes?: QuoteEntry[];
  initiativeId?: string | null;
  deliveryStatus?: string | null;
  vehicleId?: string | null;
  subOrders?: { id: string; subOrderType: string | null; agreedAmount: number | null; userId: string }[];
  allSteps?:  StepStatus[];
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
  onConfirmOrder,
  onStepConfirmed,
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
  onConfirmOrder: () => void;
  onStepConfirmed: () => void;
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

  const onStepConfirmedRef = useRef(onStepConfirmed);
  useEffect(() => { onStepConfirmedRef.current = onStepConfirmed; }, [onStepConfirmed]);

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
        onStepConfirmedRef.current();
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
      <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: "#f0f0f0" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: A.textMuted }}>WORKFLOW</p>
        <p className="text-xs" style={{ color: A.textMuted }}>
          Confirm the order to activate the workflow.
        </p>
        <button
          onClick={onConfirmOrder}
          className="text-xs px-3 py-1.5 rounded-md font-medium"
          style={{ background: "#10B981", color: "#fff", cursor: "pointer" }}
        >
          Confirm Order
        </button>
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StoreOrdersPage() {
  const { id } = useParams<{ id: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [invoiceStates, setInvoiceStates] = useState<Record<string, InvoiceState>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Delivery partner/assignment state — keyed by orderId
  const [assignedTos, setAssignedTos] = useState<Record<string, string | null>>({});
  const [partnerStatuses, setPartnerStatuses] = useState<Record<string, string | null>>({});
  const [selfAssigning, setSelfAssigning] = useState<string | null>(null);

  // Collaboration partners for this store
  const [partners, setPartners] = useState<Collab[]>([]);
  // Initiative (page) linked to this store — used for workflow state A link
  const [initiativeId, setInitiativeId] = useState<string | null>(null);

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

        // Assignment/partner state init
        const atMap: Record<string, string | null> = {};
        const psMap: Record<string, string | null> = {};
        for (const o of data) {
          atMap[o.id] = o.assignedToId ?? null;
          psMap[o.id] = o.partnerStatus ?? null;
        }
        setAssignedTos(atMap);
        setPartnerStatuses(psMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  // Load orders on mount
  useEffect(() => { loadOrders(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOrdersRef = useRef(loadOrders);
  useEffect(() => { loadOrdersRef.current = loadOrders; });

  // SSE auto-refresh: silently reload on relevant notification events
  useEffect(() => {
    const REFRESH_TYPES = new Set([
      "order_assigned", "step_confirmed", "delivery_complete",
      "workflow_attention", "quote_submitted",
    ]);
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/notifications/stream", { withCredentials: true });
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (REFRESH_TYPES.has(data.type)) loadOrdersRef.current();
        } catch { /* ignore malformed events */ }
      };
      es.onerror = () => { es?.close(); es = null; };
    } catch { /* SSE unavailable — page works normally without it */ }
    return () => { es?.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load store pageId → accepted outbound partners + capture initiativeId
  useEffect(() => {
    fetch(`/api/store/${id}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((store) => {
        if (store?.pageId) setInitiativeId(store.pageId);
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
      if (status === "confirmed") {
        setOrders((prev) => prev.map((o) =>
          o.id === orderId
            ? { ...o, status: "confirmed", activeStep: { stepId: "", stepName: "Activating workflow...", assigneeName: "", quoteRequired: false } }
            : o
        ));
        setToast("Order confirmed — activating workflow...");
        setTimeout(() => setToast(null), 3000);
        setTimeout(() => loadOrders(), 1000);
      } else {
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
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

  async function selfAssign(orderId: string) {
    setSelfAssigning(orderId);
    const res = await fetch(`/api/order/${orderId}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ partnerAction: "self_assign" }),
    });
    if (res.ok) {
      setPartnerStatuses((prev) => ({ ...prev, [orderId]: "accepted" }));
      setToast("You're now the delivery person — open Deliveries Dashboard to start GPS");
      setTimeout(() => setToast(null), 4000);
    }
    setSelfAssigning(null);
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
            {(() => {
              const pendingCount = orders.filter(
                (o) => o.status === "pending" || o.status === "confirmed"
              ).length;
              const attentionCount = orders.filter((o) => o.requiresAttention).length;
              if (pendingCount === 0 && attentionCount === 0) return null;
              return (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {pendingCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#FEF3C7", color: "#D97706", border: "1px solid #FCD34D" }}>
                      {pendingCount} pending
                    </span>
                  )}
                  {attentionCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA" }}>
                      ⚠ {attentionCount} need attention
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadOrders}
              className="text-xs px-2.5 py-1.5 rounded-md font-medium"
              style={{ background: "#F8F9FA", color: A.textMuted, border: `1px solid ${A.border}`, cursor: "pointer" }}
            >
              ↻ Refresh
            </button>
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
                onConfirmOrder={() => updateStatus(order.id, "confirmed")}
                onStepConfirmed={() => {
                  setOrders((prev) => prev.map((o) =>
                    o.id === order.id
                      ? { ...o, activeStep: { stepId: "", stepName: "Advancing...", assigneeName: "", quoteRequired: false } }
                      : o
                  ));
                  setToast("Step confirmed — advancing...");
                  setTimeout(() => setToast(null), 3000);
                }}
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

              {/* ── Track partner (shown when partner GPS is live) ── */}
              {order.deliveryStatus === "out_for_delivery" && order.vehicleId &&
                (partnerStatuses[order.id] === "accepted" || partnerStatuses[order.id] === "assigned") && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: "#f0f0f0" }}>
                  <a
                    href={`/order/${order.id}/track`}
                    className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold"
                    style={{ background: "#0F766E", color: "#fff", textDecoration: "none" }}
                  >
                    📍 Track partner →
                  </a>
                </div>
              )}

              {/* ── Deliver myself + Cancel ── */}
              {order.status !== "cancelled" && order.status !== "delivered" && (
                <div className="mt-4 pt-4 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: "#f0f0f0" }}>
                  {order.status === "confirmed" && !partnerStatuses[order.id] && (
                    <button
                      disabled={selfAssigning === order.id}
                      onClick={() => selfAssign(order.id)}
                      className="text-xs px-3 py-1.5 rounded-md font-medium"
                      style={{ background: "#EEF2FF", color: A.accent, border: `1px solid ${A.accent}`, cursor: "pointer", opacity: selfAssigning === order.id ? 0.6 : 1 }}>
                      {selfAssigning === order.id ? "…" : "🚴 Deliver myself"}
                    </button>
                  )}
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

      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%",
          transform: "translateX(-50%)",
          background: "#1a1a1a", color: "white",
          padding: "10px 20px", borderRadius: 8,
          zIndex: 9999, fontSize: 14,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
