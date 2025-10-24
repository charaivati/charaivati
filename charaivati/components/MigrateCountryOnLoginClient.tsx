// components/MigrateCountryOnLoginClient.tsx
"use client";

import React from "react";
import useMigrateCountryOnLogin from "@/lib/useMigrateCountryOnLogin";

export default function MigrateCountryOnLoginClient({ profile }: { profile: any }) {
  useMigrateCountryOnLogin(profile);
  return null;
}
