// hooks/useAIBlock.ts — generic AI fetch hook shared by goal, skill, and health blocks

import { useState } from "react";

export async function safeFetchJson(input: RequestInfo, init?: RequestInit) {
  const res  = await fetch(input, init);
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

/**
 * Generic hook that encapsulates the loading → POST → fallback → onSuccess pattern.
 *
 * generate(body, onSuccess, fallback):
 *   • Posts `body` as JSON to `route`
 *   • If resp._fallback or !resp.ok → calls onSuccess(fallback())
 *   • Otherwise → calls onSuccess(resp.json)
 */
export function useAIBlock<T>(route: string) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function generate(
    body: object,
    onSuccess: (data: T) => void,
    fallback: () => T,
  ) {
    setLoading(true);
    setError(null);
    try {
      const resp = await safeFetchJson(route, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      if (!resp.ok || resp.json?._fallback) {
        onSuccess(fallback());
      } else {
        onSuccess(resp.json as T);
      }
    } catch {
      setError("Request failed");
      onSuccess(fallback());
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, generate };
}
