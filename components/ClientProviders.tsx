"use client";

import React from "react";
import LanguageProvider from "@/components/LanguageProvider";
import { LayerProvider } from "@/components/LayerContext";

/**
 * ClientProviders wraps all client-side context providers
 */
export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <LayerProvider>
        {children}
      </LayerProvider>
    </LanguageProvider>
  );
}