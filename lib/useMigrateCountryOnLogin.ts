// lib/useMigrateCountryOnLogin.ts
"use client";

import { useEffect } from "react";
import {
  readLocalCountryRaw,
  isMigratedFlagSet,
  setMigratedFlag,
  persistToServer,
  setLocalCountryOwner,
  clearLocalCountryIfDifferentUser,
} from "@/lib/useCountrySelection";

/**
 * Called once profile is available (after login). profile should contain { id }.
 */
export default function useMigrateCountryOnLogin(profile: any) {
  useEffect(() => {
    async function migrate() {
      if (!profile || !profile?.id) {
        // nothing to do
        return;
      }

      try {
        // 1) If local selection belongs to another user, clear it immediately.
        clearLocalCountryIfDifferentUser(profile.id);

        // 2) Read local raw selection
        const raw = readLocalCountryRaw();
        if (!raw) {
          console.debug("useMigrateCountryOnLogin: no local selection present");
          return;
        }

        // If raw.ownerId exists and doesn't match profile.id, skip (we already cleared above if necessary).
        if (raw.ownerId && raw.ownerId !== profile.id) {
          console.debug("useMigrateCountryOnLogin: local selection owned by different user, skipping migration");
          return;
        }

        // If already migrated, nothing to do
        if (isMigratedFlagSet()) {
          console.debug("useMigrateCountryOnLogin: migrated flag set; skipping");
          return;
        }

        // 3) Try persist to server. If server returns userId, set migrated and owner
        const returnedUserId = await persistToServer(raw.country);
        if (returnedUserId) {
          setMigratedFlag();
          setLocalCountryOwner(returnedUserId);
          console.debug("useMigrateCountryOnLogin: migrated local country to server and set owner:", returnedUserId);
        } else {
          console.debug("useMigrateCountryOnLogin: server did not persist (user may not be authenticated)");
        }
      } catch (e) {
        console.warn("useMigrateCountryOnLogin error", e);
      }
    }

    migrate();
  }, [profile]);
}
