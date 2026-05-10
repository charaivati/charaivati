import { toast } from "sonner";

const STORAGE_KEY = "charaivati.writeQueue";
const MAX_ATTEMPTS = 3;
const RETRY_INTERVAL_MS = 30_000;

export type QueuedRequest = {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  label: string;
  addedAt: number;
  attempts: number;
};

type Callbacks = { onSuccess?: (data: unknown) => void };
const callbackRegistry = new Map<string, Callbacks>();
const listeners = new Set<(count: number) => void>();

function loadQueue(): QueuedRequest[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedRequest[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
  } catch {}
  listeners.forEach((fn) => fn(q.length));
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getQueueCount(): number {
  return loadQueue().length;
}

export function subscribeToQueue(fn: (count: number) => void): () => void {
  listeners.add(fn);
  fn(loadQueue().length);
  return () => listeners.delete(fn);
}

async function tryRequest(item: QueuedRequest): Promise<{ ok: boolean; data?: unknown }> {
  try {
    const res = await fetch(item.url, {
      method: item.method,
      headers: item.headers,
      body: item.body ?? undefined,
      credentials: "include",
    });
    if (!res.ok) return { ok: false };
    const data = await res.json().catch(() => null);
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

let flushing = false;

async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    const queue = loadQueue();
    if (!queue.length) return;
    const remaining: QueuedRequest[] = [];
    for (const item of queue) {
      const { ok, data } = await tryRequest(item);
      if (ok) {
        const cb = callbackRegistry.get(item.id);
        cb?.onSuccess?.(data);
        callbackRegistry.delete(item.id);
        toast.success(`Saved: ${item.label}`, { duration: 3000 });
      } else {
        const next = { ...item, attempts: item.attempts + 1 };
        if (next.attempts >= MAX_ATTEMPTS) {
          toast.error(
            `Could not save "${item.label}" after several retries. Please try again.`,
            { duration: 8000 }
          );
          callbackRegistry.delete(item.id);
        } else {
          remaining.push(next);
        }
      }
    }
    saveQueue(remaining);
  } finally {
    flushing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    toast.info("Connection restored — syncing pending changes…", { duration: 3000 });
    flushQueue();
  });
  setInterval(flushQueue, RETRY_INTERVAL_MS);
  // Flush any items queued in a previous session
  setTimeout(flushQueue, 1500);
}

export type ResilientResult =
  | { ok: true; queued: false; data: unknown }
  | { ok: false; queued: true }
  | { ok: false; queued: false };

export async function resilientFetch(
  url: string,
  init: RequestInit,
  opts: { label?: string; onSuccess?: (data: unknown) => void } = {}
): Promise<ResilientResult> {
  const { label = "Change", onSuccess } = opts;
  try {
    const res = await fetch(url, { ...init, credentials: "include" });
    if (res.status >= 500) throw new Error(`Server error ${res.status}`);
    if (!res.ok) return { ok: false, queued: false };
    const data = await res.json().catch(() => null);
    onSuccess?.(data);
    return { ok: true, queued: false, data };
  } catch {
    // Network error or 5xx — enqueue for retry
    const id = uid();
    const hdrs: Record<string, string> = { "Content-Type": "application/json" };
    if (init.headers) {
      new Headers(init.headers as HeadersInit).forEach((v, k) => {
        hdrs[k] = v;
      });
    }
    const item: QueuedRequest = {
      id,
      url,
      method: (init.method ?? "GET").toUpperCase(),
      headers: hdrs,
      body: init.body != null ? String(init.body) : null,
      label,
      addedAt: Date.now(),
      attempts: 0,
    };
    if (onSuccess) callbackRegistry.set(id, { onSuccess });
    saveQueue([...loadQueue(), item]);
    toast.warning(`"${label}" couldn't be saved — will retry automatically.`, {
      duration: 5000,
    });
    return { ok: false, queued: true };
  }
}
