// lib/useCountrySelection.ts
"use client";

/**
 * Local storage format (LS_KEY):
 * {
 *   country: string,
 *   selectedAt: string,
 *   ownerId?: string | null
 * }
 *
 * MIGRATED_FLAG = "1" (string) when we successfully persisted to server
 */

const LS_KEY = "charaivati.selectedCountry";
const MIGRATED_FLAG = "charaivati.selectedCountry.migrated";

/** Read raw object or null */
export function readLocalCountryRaw(): { country: string; selectedAt: string; ownerId?: string | null } | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.country) return parsed;
      return null;
    } catch {
      // legacy plain-string -> normalize
      return { country: String(raw), selectedAt: new Date().toISOString() };
    }
  } catch (e) {
    console.warn("readLocalCountryRaw error", e);
    return null;
  }
}

export function readLocalCountry(): string | null {
  return readLocalCountryRaw()?.country ?? null;
}

/** Read but only if owner matches current user (or owner absent) */
export function readLocalCountryForUser(userId: string | null): string | null {
  const raw = readLocalCountryRaw();
  if (!raw) return null;
  if (!raw.ownerId) return raw.country; // anonymous selection available to anyone
  return raw.ownerId === userId ? raw.country : null;
}

/**
 * Persist to localStorage.
 *
 * - If ownerId === undefined: preserve existing ownerId (do not clear).
 * - If ownerId === null: explicitly remove ownerId (anonymous).
 * - If ownerId === string: set ownerId to that value.
 */
export function writeLocalCountry(country: string, ownerId?: string | null) {
  try {
    const existing = readLocalCountryRaw();
    const payload: any = {
      country,
      selectedAt: new Date().toISOString(),
    };

    if (typeof ownerId === "undefined") {
      // preserve existing ownerId if present
      if (existing && typeof existing.ownerId !== "undefined") payload.ownerId = existing.ownerId;
    } else if (ownerId === null) {
      // explicit remove ownerId -> do nothing (no ownerId field)
    } else {
      // set explicit ownerId string
      payload.ownerId = ownerId;
    }

    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    console.debug("writeLocalCountry ->", payload);
  } catch (e) {
    console.warn("writeLocalCountry error", e);
  }
}

/** Update only ownerId without changing country (preserves country/selectedAt) */
export function setLocalCountryOwner(ownerId: string) {
  try {
    const raw = readLocalCountryRaw();
    if (!raw) return;
    raw.ownerId = ownerId;
    localStorage.setItem(LS_KEY, JSON.stringify(raw));
    console.debug("setLocalCountryOwner ->", ownerId);
  } catch (e) {
    console.warn("setLocalCountryOwner error", e);
  }
}

/** Remove local selection and migrated flag */
export function clearLocalCountry() {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(MIGRATED_FLAG);
    console.debug("clearLocalCountry -> removed keys");
  } catch (e) {
    console.warn("clearLocalCountry error", e);
  }
}

/** Clear only if local selection is owned by a different user than passed in */
export function clearLocalCountryIfDifferentUser(currentUserId: string | null) {
  try {
    const raw = readLocalCountryRaw();
    if (!raw) return;
    if (raw.ownerId && raw.ownerId !== currentUserId) {
      console.debug("clearLocalCountryIfDifferentUser: clearing", raw.ownerId, "current:", currentUserId);
      clearLocalCountry();
    }
  } catch (e) {
    console.warn("clearLocalCountryIfDifferentUser error", e);
  }
}

/** Clear everything on logout or when you want to force remove */
export function clearCountryOnLogout() {
  try {
    clearLocalCountry();
  } catch (e) {
    console.warn("clearCountryOnLogout error", e);
  }
}

export function setMigratedFlag() {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(MIGRATED_FLAG, "1");
  } catch {}
}

export function isMigratedFlagSet(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return Boolean(localStorage.getItem(MIGRATED_FLAG));
  } catch {
    return false;
  }
}

/**
 * Best-effort persist to server.
 * IMPORTANT: The server responds { ok: true, persisted: true, userId: string, country } on success.
 * Returns userId string when persisted, otherwise null.
 */
export async function persistToServer(country: string): Promise<string | null> {
  try {
    const res = await fetch("/api/user/country", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    });
    if (!res.ok) {
      // non-2xx (e.g. not logged-in) -> return null
      return null;
    }
    const j = await res.json().catch(() => null);
    // server returns userId when persisted
    if (j?.ok && j?.persisted && j?.userId) {
      return String(j.userId);
    }
    return null;
  } catch (e) {
    console.warn("persistToServer error", e);
    return null;
  }
}
